package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/proda-nexus/sovereign-trading/internal/crypto"
	"github.com/proda-nexus/sovereign-trading/internal/db"
)

type NewsEvent struct {
	Title            string  `json:"title"`
	Impact           string  `json:"impact"` // "HIGH", "MEDIUM", "LOW"
	Currency         string  `json:"currency"`
	Forecast         string  `json:"forecast"`
	Previous         string  `json:"previous"`
	Actual           string  `json:"actual"`
	MinutesRemaining int     `json:"minutesRemaining"`
	SentimentScore   float64 `json:"sentimentScore"`
}

type NewsArticle struct {
	Source    string    `json:"source"`
	Title     string    `json:"title"`
	URL       string    `json:"url"`
	Time      string    `json:"time"`
	Sentiment float64   `json:"sentiment"`
}

type PlatformStatus struct {
	Status        string `json:"status"`
	ErrorMessage  string `json:"errorMessage"`
	LastFetchTime string `json:"lastFetchTime"`
}

type SentimentData struct {
	Score      float64 `json:"score"`
	Confidence float64 `json:"confidence"`
	Count      int     `json:"count"`
	LastFetch  string  `json:"lastFetch"`
}

type AggregatedSentimentState struct {
	Score        float64       `json:"score"`
	Disagreement bool          `json:"disagreement"`
	Breakdown    []interface{} `json:"breakdown"`
	MinScore     float64       `json:"minScore"`
	MaxScore     float64       `json:"maxScore"`
}

var (
	newsMutex                  sync.RWMutex
	currentNewsEvents          = []NewsEvent{}
	minutesUntilHighImpactNews = 999
	sentimentScore             = 0.0
	aggregatedNewsFeed         = []NewsArticle{}
	platformStatusCache        = map[string]PlatformStatus{
		"news_api":          {Status: "NOT_CONFIGURED"},
		"finnhub":           {Status: "NOT_CONFIGURED"},
		"trading_economics": {Status: "NOT_CONFIGURED"},
		"alpha_vantage":     {Status: "NOT_CONFIGURED"},
		"market_aux":        {Status: "NOT_CONFIGURED"},
		"fred":              {Status: "NOT_CONFIGURED"},
		"bloomberg":         {Status: "LICENSED_ONLY", ErrorMessage: "Requires enterprise licensing — not available via public API"},
		"reuters":           {Status: "LICENSED_ONLY", ErrorMessage: "Requires enterprise licensing — not available via public API"},
	}
	individualSentiments = map[string]SentimentData{}
)

// StartNewsScheduler boots up the background polling loop
func StartNewsScheduler(ctx context.Context, pgDB *db.DB) {
	log.Println("[NEWS-SCHEDULER] Starting background economic calendar & news platforms poller...")
	
	// Initial poll
	go func() {
		// Small initial delay to let server start up
		time.Sleep(5 * time.Second)
		UpdateNewsAndCalendar(ctx, pgDB)
	}()

	// Poller runs every 15 minutes
	ticker := time.NewTicker(15 * time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				UpdateNewsAndCalendar(ctx, pgDB)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// UpdateNewsAndCalendar matches the TS updateNewsAndCalendar logic exactly
func UpdateNewsAndCalendar(ctx context.Context, pgDB *db.DB) {
	newsMutex.Lock()
	defer newsMutex.Unlock()

	log.Println("[NEWS-SCHEDULER] Querying news configuration from DB...")
	var (
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc string
	)
	
	// Query credentials
	err := pgDB.Pool.QueryRow(ctx, "SELECT news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc FROM news_config WHERE id = 1").Scan(
		&newsApiKeyEnc, &finnhubKeyEnc, &tradingEconomicsKeyEnc, &alphaVantageKeyEnc, &marketAuxKeyEnc, &fredKeyEnc,
	)
	if err != nil {
		log.Printf("[NEWS-SCHEDULER-ERROR] Failed to query news_config: %v", err)
		return
	}

	newsApiKey, _ := crypto.Decrypt(newsApiKeyEnc)
	finnhubKey, _ := crypto.Decrypt(finnhubKeyEnc)
	tradingEconomicsKey, _ := crypto.Decrypt(tradingEconomicsKeyEnc)
	alphaVantageKey, _ := crypto.Decrypt(alphaVantageKeyEnc)
	marketAuxKey, _ := crypto.Decrypt(marketAuxKeyEnc)
	fredKey, _ := crypto.Decrypt(fredKeyEnc)

	negativeWords := []string{"crash", "drop", "inflation", "hike", "recession", "hawkish", "down", "deficit", "warns"}
	positiveWords := []string{"grow", "rise", "dovish", "easing", "boost", "surplus", "up", "recovery", "strong"}

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. NewsAPI
	if newsApiKey != "" {
		url := fmt.Sprintf("https://newsapi.org/v2/everything?q=forex+OR+inflation+OR+cpi+OR+fed&sortBy=publishedAt&pageSize=5&apiKey=%s", newsApiKey)
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result struct {
				Articles []struct {
					Title       string `json:"title"`
					URL         string `json:"url"`
					PublishedAt string `json:"publishedAt"`
				} `json:"articles"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
				titles := ""
				for _, art := range result.Articles {
					titles += " " + art.Title
				}
				score := 0.0
				for _, w := range negativeWords {
					if strings.Contains(strings.ToLower(titles), w) {
						score -= 0.15
					}
				}
				for _, w := range positiveWords {
					if strings.Contains(strings.ToLower(titles), w) {
						score += 0.15
					}
				}
				finalScore := math.Max(-1.0, math.Min(1.0, score))

				individualSentiments["news_api"] = SentimentData{
					Score:      finalScore,
					Confidence: 0.8,
					Count:      len(result.Articles),
					LastFetch:  time.Now().Format(time.RFC3339),
				}

				for _, art := range result.Articles {
					itemScore := 0.0
					for _, w := range negativeWords {
						if strings.Contains(strings.ToLower(art.Title), w) {
							itemScore -= 0.2
						}
					}
					for _, w := range positiveWords {
						if strings.Contains(strings.ToLower(art.Title), w) {
							itemScore += 0.2
						}
					}
					aggregatedNewsFeed = append([]NewsArticle{{
						Source:    "NewsAPI",
						Title:     art.Title,
						URL:       art.URL,
						Time:      art.PublishedAt,
						Sentiment: math.Max(-1.0, math.Min(1.0, itemScore)),
					}}, aggregatedNewsFeed...)
				}

				platformStatusCache["news_api"] = PlatformStatus{
					Status:        "CONNECTED",
					LastFetchTime: time.Now().Format(time.RFC3339),
				}
			}
			resp.Body.Close()
		} else {
			status := "ERROR"
			errMsg := "Request failed"
			if resp != nil {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				resp.Body.Close()
			} else if err != nil {
				errMsg = err.Error()
			}
			platformStatusCache["news_api"] = PlatformStatus{
				Status:        status,
				ErrorMessage:  errMsg,
				LastFetchTime: time.Now().Format(time.RFC3339),
			}
		}
	}

	// 2. Finnhub
	if finnhubKey != "" {
		url := fmt.Sprintf("https://finnhub.io/api/v1/news?category=forex&token=%s", finnhubKey)
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result []struct {
				Headline string `json:"headline"`
				URL      string `json:"url"`
				Datetime int64  `json:"datetime"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && len(result) > 0 {
				limit := 5
				if len(result) < limit {
					limit = len(result)
				}
				slice := result[:limit]

				titles := ""
				for _, art := range slice {
					titles += " " + art.Headline
				}
				score := 0.0
				for _, w := range negativeWords {
					if strings.Contains(strings.ToLower(titles), w) {
						score -= 0.15
					}
				}
				for _, w := range positiveWords {
					if strings.Contains(strings.ToLower(titles), w) {
						score += 0.15
					}
				}
				finalScore := math.Max(-1.0, math.Min(1.0, score))

				individualSentiments["finnhub"] = SentimentData{
					Score:      finalScore,
					Confidence: 0.85,
					Count:      limit,
					LastFetch:  time.Now().Format(time.RFC3339),
				}

				for _, art := range slice {
					itemScore := 0.0
					for _, w := range negativeWords {
						if strings.Contains(strings.ToLower(art.Headline), w) {
							itemScore -= 0.2
						}
					}
					for _, w := range positiveWords {
						if strings.Contains(strings.ToLower(art.Headline), w) {
							itemScore += 0.2
						}
					}
					aggregatedNewsFeed = append([]NewsArticle{{
						Source:    "Finnhub",
						Title:     art.Headline,
						URL:       art.URL,
						Time:      time.Unix(art.Datetime, 0).Format(time.RFC3339),
						Sentiment: math.Max(-1.0, math.Min(1.0, itemScore)),
					}}, aggregatedNewsFeed...)
				}

				platformStatusCache["finnhub"] = PlatformStatus{
					Status:        "CONNECTED",
					LastFetchTime: time.Now().Format(time.RFC3339),
				}
			}
			resp.Body.Close()
		} else {
			status := "ERROR"
			errMsg := "Request failed"
			if resp != nil {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				resp.Body.Close()
			} else if err != nil {
				errMsg = err.Error()
			}
			platformStatusCache["finnhub"] = PlatformStatus{
				Status:        status,
				ErrorMessage:  errMsg,
				LastFetchTime: time.Now().Format(time.RFC3339),
			}
		}
	}

	// 3. Alpha Vantage
	if alphaVantageKey != "" {
		url := fmt.Sprintf("https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=%s", alphaVantageKey)
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result struct {
				Feed []struct {
					Title               string `json:"title"`
					URL                 string `json:"url"`
					OverallScore        string `json:"overall_sentiment_score"`
					TimePublished       string `json:"time_published"`
				} `json:"feed"`
				Note         string `json:"Note"`
				ErrorMessage string `json:"Error Message"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
				if result.Note != "" || result.ErrorMessage != "" {
					errMsg := result.Note
					if errMsg == "" {
						errMsg = result.ErrorMessage
					}
					platformStatusCache["alpha_vantage"] = PlatformStatus{
						Status:        "ERROR",
						ErrorMessage:  errMsg,
						LastFetchTime: time.Now().Format(time.RFC3339),
					}
				} else if len(result.Feed) > 0 {
					limit := 5
					if len(result.Feed) < limit {
						limit = len(result.Feed)
					}
					slice := result.Feed[:limit]

					totalScore := 0.0
					count := 0
					for _, item := range slice {
						var val float64
						fmt.Sscanf(item.OverallScore, "%f", &val)
						normalScore := math.Max(-1.0, math.Min(1.0, val/0.5))

						totalScore += val
						count++

						parsedTime := time.Now().Format(time.RFC3339)
						if len(item.TimePublished) == 15 {
							// e.g. 20260719T020807 -> convert
							parsed, err := time.Parse("20060102T150405", item.TimePublished)
							if err == nil {
								parsedTime = parsed.Format(time.RFC3339)
							}
						}

						aggregatedNewsFeed = append([]NewsArticle{{
							Source:    "Alpha Vantage",
							Title:     item.Title,
							URL:       item.URL,
							Time:      parsedTime,
							Sentiment: normalScore,
						}}, aggregatedNewsFeed...)
					}

					avgScore := 0.0
					if count > 0 {
						avgScore = totalScore / float64(count)
					}

					individualSentiments["alpha_vantage"] = SentimentData{
						Score:      math.Max(-1.0, math.Min(1.0, avgScore/0.4)),
						Confidence: 0.9,
						Count:      count,
						LastFetch:  time.Now().Format(time.RFC3339),
					}

					platformStatusCache["alpha_vantage"] = PlatformStatus{
						Status:        "CONNECTED",
						LastFetchTime: time.Now().Format(time.RFC3339),
					}
				}
			}
			resp.Body.Close()
		} else {
			status := "ERROR"
			errMsg := "Request failed"
			if resp != nil {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				resp.Body.Close()
			} else if err != nil {
				errMsg = err.Error()
			}
			platformStatusCache["alpha_vantage"] = PlatformStatus{
				Status:        status,
				ErrorMessage:  errMsg,
				LastFetchTime: time.Now().Format(time.RFC3339),
			}
		}
	}

	// 4. MarketAux
	if marketAuxKey != "" {
		url := fmt.Sprintf("https://api.marketaux.com/v1/news/all?symbols=TSLA,AMZN&limit=5&api_token=%s", marketAuxKey)
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result struct {
				Data []struct {
					Title       string      `json:"title"`
					URL         string      `json:"url"`
					PublishedAt string      `json:"published_at"`
					Sentiment   interface{} `json:"sentiment"`
				} `json:"data"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && len(result.Data) > 0 {
				totalScore := 0.0
				count := 0
				for _, item := range result.Data {
					var s float64
					switch val := item.Sentiment.(type) {
					case float64:
						s = val
					case string:
						fmt.Sscanf(val, "%f", &s)
					}

					totalScore += s
					count++

					aggregatedNewsFeed = append([]NewsArticle{{
						Source:    "MarketAux",
						Title:     item.Title,
						URL:       item.URL,
						Time:      item.PublishedAt,
						Sentiment: s,
					}}, aggregatedNewsFeed...)
				}

				avg := 0.0
				if count > 0 {
					avg = totalScore / float64(count)
				}

				individualSentiments["market_aux"] = SentimentData{
					Score:      avg,
					Confidence: 0.8,
					Count:      count,
					LastFetch:  time.Now().Format(time.RFC3339),
				}

				platformStatusCache["market_aux"] = PlatformStatus{
					Status:        "CONNECTED",
					LastFetchTime: time.Now().Format(time.RFC3339),
				}
			}
			resp.Body.Close()
		} else {
			status := "ERROR"
			errMsg := "Request failed"
			if resp != nil {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				resp.Body.Close()
			} else if err != nil {
				errMsg = err.Error()
			}
			platformStatusCache["market_aux"] = PlatformStatus{
				Status:        status,
				ErrorMessage:  errMsg,
				LastFetchTime: time.Now().Format(time.RFC3339),
			}
		}
	}

	// 5. FRED
	if fredKey != "" {
		url := fmt.Sprintf("https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=%s&file_type=json&sort_order=desc&limit=5", fredKey)
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result struct {
				Observations []struct {
					Value string `json:"value"`
					Date  string `json:"date"`
				} `json:"observations"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && len(result.Observations) >= 2 {
				var latest, prev float64
				fmt.Sscanf(result.Observations[0].Value, "%f", &latest)
				fmt.Sscanf(result.Observations[1].Value, "%f", &prev)

				score := 0.0
				if latest != 0 && prev != 0 {
					if latest > prev {
						score = -0.2
					} else {
						score = 0.2
					}
				}

				individualSentiments["fred"] = SentimentData{
					Score:      score,
					Confidence: 0.7,
					Count:      len(result.Observations),
					LastFetch:  time.Now().Format(time.RFC3339),
				}

				limit := 3
				if len(result.Observations) < limit {
					limit = len(result.Observations)
				}
				for _, obs := range result.Observations[:limit] {
					aggregatedNewsFeed = append([]NewsArticle{{
						Source:    "FRED",
						Title:     fmt.Sprintf("FED CPI Release observed at %s (%s)", obs.Value, obs.Date),
						Time:      obs.Date + "T00:00:00Z",
						Sentiment: score,
					}}, aggregatedNewsFeed...)
				}

				platformStatusCache["fred"] = PlatformStatus{
					Status:        "CONNECTED",
					LastFetchTime: time.Now().Format(time.RFC3339),
				}
			}
			resp.Body.Close()
		} else {
			status := "ERROR"
			errMsg := "Request failed"
			if resp != nil {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				resp.Body.Close()
			} else if err != nil {
				errMsg = err.Error()
			}
			platformStatusCache["fred"] = PlatformStatus{
				Status:        status,
				ErrorMessage:  errMsg,
				LastFetchTime: time.Now().Format(time.RFC3339),
			}
		}
	}

	// --- ECONOMIC CALENDAR ---
	hasCalendar := false
	if tradingEconomicsKey != "" {
		url := fmt.Sprintf("https://api.tradingeconomics.com/calendar?c=%s&f=json", tradingEconomicsKey)
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result []struct {
				Event      string      `json:"Event"`
				Importance interface{} `json:"Importance"`
				Currency   string      `json:"Currency"`
				Forecast   string      `json:"Forecast"`
				Previous   string      `json:"Previous"`
				Actual     string      `json:"Actual"`
				Date       string      `json:"Date"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && len(result) > 0 {
				hasCalendar = true
				var mapped []NewsEvent
				
				limit := 5
				if len(result) < limit {
					limit = len(result)
				}
				for _, item := range result[:limit] {
					eventTime, parseErr := time.Parse(time.RFC3339, item.Date)
					if parseErr != nil {
						// Fallback parse formats
						eventTime, parseErr = time.Parse("2006-01-02T15:04:05", item.Date)
					}
					diffMs := eventTime.Sub(time.Now())
					minutesRemaining := int(math.Round(diffMs.Minutes()))

					impact := "LOW"
					importanceStr := fmt.Sprintf("%v", item.Importance)
					if importanceStr == "3" || strings.Contains(strings.ToLower(importanceStr), "high") {
						impact = "HIGH"
					} else if importanceStr == "2" || strings.Contains(strings.ToLower(importanceStr), "medium") || strings.Contains(strings.ToLower(importanceStr), "mid") {
						impact = "MEDIUM"
					}

					evSentiment := 0.0
					if impact == "HIGH" && item.Actual != "" && item.Forecast != "" {
						var actVal, foreVal float64
						fmt.Sscanf(item.Actual, "%f", &actVal)
						fmt.Sscanf(item.Forecast, "%f", &foreVal)
						if actVal > foreVal {
							evSentiment = 0.35
						} else {
							evSentiment = -0.35
						}
					}

					mapped = append(mapped, NewsEvent{
						Title:            item.Event,
						Impact:           impact,
						Currency:         item.Currency,
						Forecast:         item.Forecast,
						Previous:         item.Previous,
						Actual:           item.Actual,
						MinutesRemaining: minutesRemaining,
						SentimentScore:   evSentiment,
					})
				}

				if len(mapped) > 0 {
					currentNewsEvents = mapped
					platformStatusCache["trading_economics"] = PlatformStatus{
						Status:        "CONNECTED",
						LastFetchTime: time.Now().Format(time.RFC3339),
					}
					sumSentiment := 0.0
					for _, ev := range mapped {
						sumSentiment += ev.SentimentScore
					}
					individualSentiments["trading_economics"] = SentimentData{
						Score:      sumSentiment / float64(len(mapped)),
						Confidence: 0.95,
						Count:      len(mapped),
						LastFetch:  time.Now().Format(time.RFC3339),
					}
				}
			}
			if resp != nil {
				resp.Body.Close()
			}
		} else {
			if resp != nil {
				resp.Body.Close()
			}
		}
	}

	if !hasCalendar && fredKey != "" {
		seriesList := []string{"DFF", "CPIAUCSL", "UNRATE"}
		names := map[string]string{
			"DFF":      "FOMC Interest Rate Decision",
			"CPIAUCSL": "US Core CPI MoM",
			"UNRATE":   "US Unemployment Rate",
		}
		var events []NewsEvent
		for _, sid := range seriesList {
			url := fmt.Sprintf("https://api.stlouisfed.org/fred/series/observations?series_id=%s&api_key=%s&file_type=json&sort_order=desc&limit=1", sid, fredKey)
			resp, err := client.Get(url)
			if err == nil && resp.StatusCode == 200 {
				var result struct {
					Observations []struct {
						Value string `json:"value"`
					} `json:"observations"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && len(result.Observations) > 0 {
					events = append(events, NewsEvent{
						Title:            names[sid],
						Impact:           "HIGH",
						Currency:         "USD",
						Forecast:         "FRED Real Observation",
						Previous:         "N/A",
						Actual:           result.Observations[0].Value,
						MinutesRemaining: -30,
						SentimentScore:   0.1,
					})
				}
				resp.Body.Close()
			}
		}
		if len(events) > 0 {
			currentNewsEvents = events
			hasCalendar = true
			platformStatusCache["fred"] = PlatformStatus{
				Status:        "CONNECTED",
				LastFetchTime: time.Now().Format(time.RFC3339),
			}
		}
	}

	// Economic Calendar Fallback (Forex Factory Weekly Feed)
	if !hasCalendar {
		url := "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			var result []struct {
				Title    string `json:"title"`
				Country  string `json:"country"`
				Date     string `json:"date"`
				Impact   string `json:"impact"`
				Forecast string `json:"forecast"`
				Previous string `json:"previous"`
				Actual   string `json:"actual"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && len(result) > 0 {
				var mapped []NewsEvent
				now := time.Now()
				for _, item := range result {
					// Date is e.g. "2026-07-19T02:08:07-07:00"
					eventTime, parseErr := time.Parse(time.RFC3339, item.Date)
					if parseErr != nil {
						eventTime, parseErr = time.Parse("2006-01-02T15:04:05-07:00", item.Date)
					}
					if parseErr != nil {
						continue
					}
					
					minutesRemaining := int(math.Round(eventTime.Sub(now).Minutes()))

					impact := "LOW"
					if item.Impact == "High" {
						impact = "HIGH"
					} else if item.Impact == "Medium" {
						impact = "MEDIUM"
					}

					evSentiment := 0.0
					if impact == "HIGH" {
						evSentiment = -0.1
					}

					mapped = append(mapped, NewsEvent{
						Title:            item.Title,
						Impact:           impact,
						Currency:         item.Country,
						Forecast:         item.Forecast,
						Previous:         item.Previous,
						Actual:           item.Actual,
						MinutesRemaining: minutesRemaining,
						SentimentScore:   evSentiment,
					})
				}

				// Filter similar to TS code
				var filtered []NewsEvent
				for _, ev := range mapped {
					if ev.MinutesRemaining > -180 && ev.MinutesRemaining < 1440 {
						filtered = append(filtered, ev)
					}
				}

				if len(filtered) > 10 {
					filtered = filtered[:10]
				}

				if len(filtered) > 0 {
					currentNewsEvents = filtered
				}
			}
			resp.Body.Close()
		}
	}

	// Clean duplicates in aggregatedNewsFeed
	if len(aggregatedNewsFeed) > 50 {
		titlesSeen := map[string]bool{}
		var uniqueFeed []NewsArticle
		for _, art := range aggregatedNewsFeed {
			if !titlesSeen[art.Title] {
				titlesSeen[art.Title] = true
				uniqueFeed = append(uniqueFeed, art)
			}
		}
		if len(uniqueFeed) > 50 {
			aggregatedNewsFeed = uniqueFeed[:50]
		} else {
			aggregatedNewsFeed = uniqueFeed
		}
	}

	// Compute aggregated sentiment
	computed := ComputeAggregatedSentimentState()
	sentimentScore = computed.Score

	// Calculate minutesUntilHighImpactNews
	minRem := 999
	for _, e := range currentNewsEvents {
		if e.Impact == "HIGH" && e.MinutesRemaining > 0 {
			if e.MinutesRemaining < minRem {
				minRem = e.MinutesRemaining
			}
		}
	}
	minutesUntilHighImpactNews = minRem

	log.Printf("[NEWS-SCHEDULER] Update complete. Sentiment Score: %.4f, High Impact News in: %d mins", sentimentScore, minutesUntilHighImpactNews)
}

func ComputeAggregatedSentimentState() AggregatedSentimentState {
	activeSources := []string{}
	for src, data := range individualSentiments {
		if data.LastFetch != "" {
			activeSources = append(activeSources, src)
		}
	}

	if len(activeSources) == 0 {
		return AggregatedSentimentState{
			Score:        0.0,
			Disagreement: false,
			Breakdown:    []interface{}{},
			MinScore:     0.0,
			MaxScore:     0.0,
		}
	}

	weightedSum := 0.0
	confidenceSum := 0.0
	minScore := 1.0
	maxScore := -1.0
	var breakdown []interface{}

	for _, source := range activeSources {
		data := individualSentiments[source]
		weightedSum += data.Score * data.Confidence
		confidenceSum += data.Confidence
		if data.Score < minScore {
			minScore = data.Score
		}
		if data.Score > maxScore {
			maxScore = data.Score
		}

		breakdown = append(breakdown, gin.H{
			"source":     source,
			"score":      data.Score,
			"confidence": data.Confidence,
			"count":      data.Count,
			"lastFetch":  data.LastFetch,
		})
	}

	finalScore := 0.0
	if confidenceSum > 0 {
		finalScore = weightedSum / confidenceSum
	}
	disagreement := len(activeSources) > 1 && (maxScore-minScore) >= 0.5

	return AggregatedSentimentState{
		Score:        math.Max(-1.0, math.Min(1.0, finalScore)),
		Disagreement: disagreement,
		Breakdown:    breakdown,
		MinScore:     minScore,
		MaxScore:     maxScore,
	}
}

// REST Endpoints for News Subsystem

// TestConnection handles POST /api/news/test-connection
type TestConnectionInput struct {
	Platform string `json:"platform" binding:"required"`
	ApiKey   string `json:"apiKey" binding:"required"`
}

func (h *Handler) TestNewsConnection(c *gin.Context) {
	var input TestConnectionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Platform and API Key are required."})
		return
	}

	AddServerLog("GO-BACKPLANE", "INFO", fmt.Sprintf("تاقیکردنەوەی گرێدانی هەواڵ و داتای دەرەکی بۆ: %s", strings.ToUpper(input.Platform)))

	success := false
	errMsg := ""
	client := &http.Client{Timeout: 10 * time.Second}

	switch input.Platform {
	case "news_api":
		url := fmt.Sprintf("https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=%s", input.ApiKey)
		resp, err := client.Get(url)
		if err == nil {
			if resp.StatusCode == 200 {
				success = true
			} else {
				var errJson struct {
					Message string `json:"message"`
				}
				_ = json.NewDecoder(resp.Body).Decode(&errJson)
				errMsg = errJson.Message
				if errMsg == "" {
					errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				}
			}
			resp.Body.Close()
		} else {
			errMsg = err.Error()
		}

	case "finnhub":
		url := fmt.Sprintf("https://finnhub.io/api/v1/news?category=forex&token=%s", input.ApiKey)
		resp, err := client.Get(url)
		if err == nil {
			if resp.StatusCode == 200 {
				success = true
			} else {
				errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			resp.Body.Close()
		} else {
			errMsg = err.Error()
		}

	case "trading_economics":
		url := fmt.Sprintf("https://api.tradingeconomics.com/calendar?c=%s", input.ApiKey)
		resp, err := client.Get(url)
		if err == nil {
			if resp.StatusCode == 200 || resp.StatusCode == 401 {
				if resp.StatusCode == 401 {
					errMsg = "Unauthorized: Invalid Trading Economics API Key"
				} else {
					success = true
				}
			} else {
				errMsg = "Trading Economics API unreachable or unauthorized."
			}
			resp.Body.Close()
		} else {
			errMsg = err.Error()
		}

	case "alpha_vantage":
		url := fmt.Sprintf("https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=%s", input.ApiKey)
		resp, err := client.Get(url)
		if err == nil {
			var data struct {
				Note         string `json:"Note"`
				ErrorMessage string `json:"Error Message"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
				if data.Note != "" || data.ErrorMessage != "" {
					errMsg = data.Note
					if errMsg == "" {
						errMsg = data.ErrorMessage
					}
				} else {
					success = true
				}
			} else {
				success = true
			}
			resp.Body.Close()
		} else {
			errMsg = err.Error()
		}

	case "market_aux":
		url := fmt.Sprintf("https://api.marketaux.com/v1/news/all?symbols=TSLA&limit=1&api_token=%s", input.ApiKey)
		resp, err := client.Get(url)
		if err == nil {
			if resp.StatusCode == 200 {
				success = true
			} else {
				var errJson struct {
					Error struct {
						Message string `json:"message"`
					} `json:"error"`
				}
				_ = json.NewDecoder(resp.Body).Decode(&errJson)
				errMsg = errJson.Error.Message
				if errMsg == "" {
					errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				}
			}
			resp.Body.Close()
		} else {
			errMsg = err.Error()
		}

	case "fred":
		url := fmt.Sprintf("https://api.stlouisfed.org/fred/series?series_id=DFF&api_key=%s&file_type=json", input.ApiKey)
		resp, err := client.Get(url)
		if err == nil {
			if resp.StatusCode == 200 {
				success = true
			} else {
				var errJson struct {
					ErrorMessage string `json:"error_message"`
				}
				_ = json.NewDecoder(resp.Body).Decode(&errJson)
				errMsg = errJson.ErrorMessage
				if errMsg == "" {
					errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
				}
			}
			resp.Body.Close()
		} else {
			errMsg = err.Error()
		}

	default:
		errMsg = "Unknown platform"
	}

	if success {
		AddServerLog("GO-BACKPLANE", "SUCCESS", fmt.Sprintf("تاقیکردنەوەی گرێدانی %s سەرکەوتوو بوو.", strings.ToUpper(input.Platform)))
		c.JSON(http.StatusOK, gin.H{"success": true})
	} else {
		AddServerLog("GO-BACKPLANE", "WARNING", fmt.Sprintf("گرێدانی %s سەرنەکەوت: %s", strings.ToUpper(input.Platform), errMsg))
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": errMsg})
	}
}

// ConfigNews handles POST /api/news/config
type ConfigNewsInput struct {
	NewsApiKey          *string `json:"newsApiKey"`
	FinnhubKey          *string `json:"finnhubKey"`
	TradingEconomicsKey *string `json:"tradingEconomicsKey"`
	AlphaVantageKey     *string `json:"alphaVantageKey"`
	MarketAuxKey        *string `json:"marketAuxKey"`
	FredKey             *string `json:"fredKey"`
}

func (h *Handler) ConfigNews(c *gin.Context) {
	ctx := c.Request.Context()
	var input ConfigNewsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	var (
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc string
	)

	// Fetch existing configurations
	_ = h.DB.Pool.QueryRow(ctx, "SELECT news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc FROM news_config WHERE id = 1").Scan(
		&newsApiKeyEnc, &finnhubKeyEnc, &tradingEconomicsKeyEnc, &alphaVantageKeyEnc, &marketAuxKeyEnc, &fredKeyEnc,
	)

	if input.NewsApiKey != nil {
		if *input.NewsApiKey != "" {
			newsApiKeyEnc, _ = crypto.Encrypt(*input.NewsApiKey)
		} else {
			newsApiKeyEnc = ""
		}
	}
	if input.FinnhubKey != nil {
		if *input.FinnhubKey != "" {
			finnhubKeyEnc, _ = crypto.Encrypt(*input.FinnhubKey)
		} else {
			finnhubKeyEnc = ""
		}
	}
	if input.TradingEconomicsKey != nil {
		if *input.TradingEconomicsKey != "" {
			tradingEconomicsKeyEnc, _ = crypto.Encrypt(*input.TradingEconomicsKey)
		} else {
			tradingEconomicsKeyEnc = ""
		}
	}
	if input.AlphaVantageKey != nil {
		if *input.AlphaVantageKey != "" {
			alphaVantageKeyEnc, _ = crypto.Encrypt(*input.AlphaVantageKey)
		} else {
			alphaVantageKeyEnc = ""
		}
	}
	if input.MarketAuxKey != nil {
		if *input.MarketAuxKey != "" {
			marketAuxKeyEnc, _ = crypto.Encrypt(*input.MarketAuxKey)
		} else {
			marketAuxKeyEnc = ""
		}
	}
	if input.FredKey != nil {
		if *input.FredKey != "" {
			fredKeyEnc, _ = crypto.Encrypt(*input.FredKey)
		} else {
			fredKeyEnc = ""
		}
	}

	_, err := h.DB.Pool.Exec(ctx, `
		INSERT INTO news_config (id, news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc)
		VALUES (1, $1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			news_api_key_enc = EXCLUDED.news_api_key_enc,
			finnhub_key_enc = EXCLUDED.finnhub_key_enc,
			trading_economics_key_enc = EXCLUDED.trading_economics_key_enc,
			alpha_vantage_key_enc = EXCLUDED.alpha_vantage_key_enc,
			market_aux_key_enc = EXCLUDED.market_aux_key_enc,
			fred_key_enc = EXCLUDED.fred_key_enc`,
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Trigger async update of news cache
	go UpdateNewsAndCalendar(context.Background(), h.DB)

	AddServerLog("GO-BACKPLANE", "SUCCESS", "کلیلەکانی هەواڵ و داتای گشتی بە شێوەیەکی پارێزراو پاشەکەوتکران.")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetNewsConfig handles GET /api/news/config
func (h *Handler) GetNewsConfig(c *gin.Context) {
	ctx := c.Request.Context()
	var (
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc string
	)
	_ = h.DB.Pool.QueryRow(ctx, "SELECT news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc FROM news_config WHERE id = 1").Scan(
		&newsApiKeyEnc, &finnhubKeyEnc, &tradingEconomicsKeyEnc, &alphaVantageKeyEnc, &marketAuxKeyEnc, &fredKeyEnc,
	)

	c.JSON(http.StatusOK, gin.H{
		"success":                true,
		"hasNewsApiKey":          newsApiKeyEnc != "",
		"hasFinnhubKey":          finnhubKeyEnc != "",
		"hasTradingEconomicsKey": tradingEconomicsKeyEnc != "",
		"hasAlphaVantageKey":     alphaVantageKeyEnc != "",
		"hasMarketAuxKey":        marketAuxKeyEnc != "",
		"hasFredKey":             fredKeyEnc != "",
	})
}

// GetNewsPlatforms handles GET /api/news/platforms
func (h *Handler) GetNewsPlatforms(c *gin.Context) {
	ctx := c.Request.Context()
	var (
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc string
	)
	_ = h.DB.Pool.QueryRow(ctx, "SELECT news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc FROM news_config WHERE id = 1").Scan(
		&newsApiKeyEnc, &finnhubKeyEnc, &tradingEconomicsKeyEnc, &alphaVantageKeyEnc, &marketAuxKeyEnc, &fredKeyEnc,
	)

	newsMutex.RLock()
	defer newsMutex.RUnlock()

	platforms := []gin.H{
		{
			"id":            "news_api",
			"name":          "NewsAPI.org",
			"hasKey":         newsApiKeyEnc != "",
			"status":         getPlatformStatus("news_api", newsApiKeyEnc != ""),
			"errorMessage":  platformStatusCache["news_api"].ErrorMessage,
			"lastFetchTime": platformStatusCache["news_api"].LastFetchTime,
			"description":   "سەرچاوەیەکی جیهانی گرنگ بۆ هەواڵە دارایی و جیۆپۆلیتیکییەکان.",
		},
		{
			"id":            "finnhub",
			"name":          "Finnhub Forex News API",
			"hasKey":         finnhubKeyEnc != "",
			"status":         getPlatformStatus("finnhub", finnhubKeyEnc != ""),
			"errorMessage":  platformStatusCache["finnhub"].ErrorMessage,
			"lastFetchTime": platformStatusCache["finnhub"].LastFetchTime,
			"description":   "پێشکەشکاری سەرەکی هەواڵ و ڕاپۆرتەکانی بازاڕی فۆرێکس.",
		},
		{
			"id":            "trading_economics",
			"name":          "Trading Economics API",
			"hasKey":         tradingEconomicsKeyEnc != "",
			"status":         getPlatformStatus("trading_economics", tradingEconomicsKeyEnc != ""),
			"errorMessage":  platformStatusCache["trading_economics"].ErrorMessage,
			"lastFetchTime": platformStatusCache["trading_economics"].LastFetchTime,
			"description":   "ڕۆژژمێری ئابووری و داتاکانی گەشەی ووڵاتان.",
		},
		{
			"id":            "alpha_vantage",
			"name":          "Alpha Vantage Sentiment API",
			"hasKey":         alphaVantageKeyEnc != "",
			"status":         getPlatformStatus("alpha_vantage", alphaVantageKeyEnc != ""),
			"errorMessage":  platformStatusCache["alpha_vantage"].ErrorMessage,
			"lastFetchTime": platformStatusCache["alpha_vantage"].LastFetchTime,
			"description":   "داتای سێنتیمێنتی بەهێز و کات-ڕاستەقینە بۆ فۆرێکس.",
		},
		{
			"id":            "market_aux",
			"name":          "MarketAux Financial News API",
			"hasKey":         marketAuxKeyEnc != "",
			"status":         getPlatformStatus("market_aux", marketAuxKeyEnc != ""),
			"errorMessage":  platformStatusCache["market_aux"].ErrorMessage,
			"lastFetchTime": platformStatusCache["market_aux"].LastFetchTime,
			"description":   "هەواڵی کورت و تایبەت بە جووڵە داراییەکان و گرێدانی هەستی بازاڕ.",
		},
		{
			"id":            "fred",
			"name":          "FRED Federal Reserve Data",
			"hasKey":         fredKeyEnc != "",
			"status":         getPlatformStatus("fred", fredKeyEnc != ""),
			"errorMessage":  platformStatusCache["fred"].ErrorMessage,
			"lastFetchTime": platformStatusCache["fred"].LastFetchTime,
			"description":   "سەرچاوەی فەرمی سێنتیمێنت و تێکڕای ڕێژەی سوو لە بانکی فیدراڵی ئەمریکا.",
		},
		{
			"id":            "bloomberg",
			"name":          "Bloomberg Enterprise Terminal API",
			"hasKey":         false,
			"status":         "LICENSED_ONLY",
			"errorMessage":  "Requires enterprise licensing — not available via public API",
			"lastFetchTime": "",
			"description":   "پرۆتۆکۆلی پەیوەندی فەرمی و زانیاری ڕاستەقینەی بلومبێرگ.",
		},
		{
			"id":            "reuters",
			"name":          "Reuters Eikon / Refinitiv API",
			"hasKey":         false,
			"status":         "LICENSED_ONLY",
			"errorMessage":  "Requires enterprise licensing — not available via public API",
			"lastFetchTime": "",
			"description":   "سیستەمی گواستنەوەی نێودەوڵەتی هەواڵەکانی ڕۆیتەرز.",
		},
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "platforms": platforms})
}

func getPlatformStatus(platform string, hasKey bool) string {
	if !hasKey {
		return "NOT_CONFIGURED"
	}
	status := platformStatusCache[platform].Status
	if status == "" {
		return "CONNECTED"
	}
	return status
}

// DisconnectNews handles POST /api/news/disconnect
type DisconnectNewsInput struct {
	Platform string `json:"platform" binding:"required"`
}

func (h *Handler) DisconnectNews(c *gin.Context) {
	ctx := c.Request.Context()
	var input DisconnectNewsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Platform is required"})
		return
	}

	var (
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc string
	)
	_ = h.DB.Pool.QueryRow(ctx, "SELECT news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc FROM news_config WHERE id = 1").Scan(
		&newsApiKeyEnc, &finnhubKeyEnc, &tradingEconomicsKeyEnc, &alphaVantageKeyEnc, &marketAuxKeyEnc, &fredKeyEnc,
	)

	switch input.Platform {
	case "news_api":
		newsApiKeyEnc = ""
	case "finnhub":
		finnhubKeyEnc = ""
	case "trading_economics":
		tradingEconomicsKeyEnc = ""
	case "alpha_vantage":
		alphaVantageKeyEnc = ""
	case "market_aux":
		marketAuxKeyEnc = ""
	case "fred":
		fredKeyEnc = ""
	}

	_, err := h.DB.Pool.Exec(ctx, `
		INSERT INTO news_config (id, news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc)
		VALUES (1, $1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			news_api_key_enc = EXCLUDED.news_api_key_enc,
			finnhub_key_enc = EXCLUDED.finnhub_key_enc,
			trading_economics_key_enc = EXCLUDED.trading_economics_key_enc,
			alpha_vantage_key_enc = EXCLUDED.alpha_vantage_key_enc,
			market_aux_key_enc = EXCLUDED.market_aux_key_enc,
			fred_key_enc = EXCLUDED.fred_key_enc`,
		newsApiKeyEnc, finnhubKeyEnc, tradingEconomicsKeyEnc, alphaVantageKeyEnc, marketAuxKeyEnc, fredKeyEnc,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	newsMutex.Lock()
	if status, ok := platformStatusCache[input.Platform]; ok {
		status.Status = "NOT_CONFIGURED"
		status.ErrorMessage = ""
		status.LastFetchTime = ""
		platformStatusCache[input.Platform] = status
	}
	delete(individualSentiments, input.Platform)
	newsMutex.Unlock()

	go UpdateNewsAndCalendar(context.Background(), h.DB)

	AddServerLog("GO-BACKPLANE", "INFO", fmt.Sprintf("کۆنفیگ و کلیلەکانی بڕاینی %s سڕانەوە.", strings.ToUpper(input.Platform)))
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetNewsFeed handles GET /api/news/feed
func (h *Handler) GetNewsFeed(c *gin.Context) {
	newsMutex.RLock()
	defer newsMutex.RUnlock()

	infMult := 1.0
	if minutesUntilHighImpactNews < 30 {
		infMult = 0.25
	}

	state := ComputeAggregatedSentimentState()

	c.JSON(http.StatusOK, gin.H{
		"success":                    true,
		"events":                     currentNewsEvents,
		"minutesUntilHighImpactNews": minutesUntilHighImpactNews,
		"sentimentScore":             sentimentScore,
		"influenceMultiplier":        infMult,
		"hasCalendarFeed":            len(currentNewsEvents) > 0,
		"sentimentState":             state,
		"liveFeed":                   aggregatedNewsFeed,
	})
}
