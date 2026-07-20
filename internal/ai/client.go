package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

// GeminiClient wraps the official Google GenAI Go SDK and adds robust fallback options.
type GeminiClient struct {
	sdkClient *genai.Client
	apiKey    string
}

// NewGeminiClient initializes a new Gemini client using the environment's API Key.
func NewGeminiClient(ctx context.Context, apiKey string) (*GeminiClient, error) {
	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not defined in environment variables")
	}

	// Create SDK client. Note: we log but do not fail-hard on SDK instantiation if we want HTTP fallback active.
	sdkClient, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Printf("[GEMINI-CLIENT-WARN] Failed to initialize official SDK: %v. Falling back to native HTTP client.", err)
	}

	return &GeminiClient{
		sdkClient: sdkClient,
		apiKey:    apiKey,
	}, nil
}

// Close closes the underlying official SDK client.
func (g *GeminiClient) Close() {
	if g.sdkClient != nil {
		g.sdkClient.Close()
	}
}

// LLMResponse contains the generated text and extracted search grounding citations.
type LLMResponse struct {
	Text    string `json:"text"`
	Sources []Source `json:"sources,omitempty"`
}

type Source struct {
	Title string `json:"title"`
	URI   string `json:"uri"`
}

// GenerateText queries Gemini for text, optionally enabling Google Search grounding.
func (g *GeminiClient) GenerateText(ctx context.Context, prompt string, systemInstruction string, searchGrounding bool) (*LLMResponse, error) {
	// For search grounding or if SDK is nil, we route to the robust HTTP implementation 
	// to avoid type incompatibilities with older versions of the official SDK.
	if g.sdkClient == nil || searchGrounding {
		return g.generateTextHTTP(ctx, "gemini-2.5-flash", prompt, systemInstruction, searchGrounding, nil)
	}

	modelName := "gemini-2.5-flash"
	model := g.sdkClient.GenerativeModel(modelName)
	model.SetTemperature(0.2)

	if systemInstruction != "" {
		model.SystemInstruction = genai.NewUserContent(genai.Text(systemInstruction))
	}

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		log.Printf("[GEMINI-CLIENT-WARN] Official SDK generation failed: %v. Swapping to HTTP fallback.", err)
		return g.generateTextHTTP(ctx, modelName, prompt, systemInstruction, searchGrounding, nil)
	}

	// Extract text content
	var textBuilder strings.Builder
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				if txt, ok := part.(genai.Text); ok {
					textBuilder.WriteString(string(txt))
				}
			}
		}
	}

	return &LLMResponse{
		Text:    textBuilder.String(),
	}, nil
}

// GenerateStructured queries Gemini and returns a parsed JSON response matching the provided schema.
func (g *GeminiClient) GenerateStructured(ctx context.Context, prompt string, systemInstruction string, schema map[string]interface{}, out interface{}) error {
	modelName := "gemini-2.5-flash"
	
	// Structured generation uses our robust HTTP proxy to ensure perfect schema serialization compatibility
	resp, err := g.generateTextHTTP(ctx, modelName, prompt, systemInstruction, false, schema)
	if err != nil {
		return err
	}

	// Clean out potential markdown wrappers
	cleanJSON := resp.Text
	if strings.HasPrefix(cleanJSON, "```") {
		lines := strings.Split(cleanJSON, "\n")
		if len(lines) > 2 {
			cleanJSON = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	cleanJSON = strings.TrimSpace(cleanJSON)

	return json.Unmarshal([]byte(cleanJSON), out)
}

// generateTextHTTP uses clean, raw HTTP calls to Google's API as an ultra-reliable, robust fallback.
func (g *GeminiClient) generateTextHTTP(ctx context.Context, model string, prompt string, systemInstruction string, searchGrounding bool, schema map[string]interface{}) (*LLMResponse, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, g.apiKey)

	// Build raw JSON payload
	payload := map[string]interface{}{
		"contents": []interface{}{
			map[string]interface{}{
				"parts": []interface{}{
					map[string]interface{}{
						"text": prompt,
					},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature": 0.2,
		},
	}

	genConfig := payload["generationConfig"].(map[string]interface{})
	if schema != nil {
		genConfig["responseMimeType"] = "application/json"
		genConfig["responseSchema"] = schema
	}

	if systemInstruction != "" {
		payload["systemInstruction"] = map[string]interface{}{
			"parts": []interface{}{
				map[string]interface{}{
					"text": systemInstruction,
				},
			},
		}
	}

	if searchGrounding {
		payload["tools"] = []interface{}{
			map[string]interface{}{
				"googleSearchRetrieval": map[string]interface{}{},
			},
		}
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	var bodyBytes []byte
	var resp *http.Response
	maxRetries := 5
	backoff := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 45 * time.Second}
		resp, err = client.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			log.Printf("[GEMINI-CLIENT-RETRY] Connection error on attempt %d: %v. Retrying in %v...", i+1, err, backoff)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
			continue
		}

		bodyBytes, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("[GEMINI-CLIENT-RETRY] Error reading response body on attempt %d: %v. Retrying...", i+1, err)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
			continue
		}

		if resp.StatusCode == http.StatusOK {
			break
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == 429 {
			log.Printf("[GEMINI-CLIENT-RETRY] Received 429 (Too Many Requests) on attempt %d. Quota exceeded or rate limited. Retrying in %v...", i+1, backoff)
			bodyStr := string(bodyBytes)
			if strings.Contains(bodyStr, "Please retry in ") {
				parts := strings.Split(bodyStr, "Please retry in ")
				if len(parts) > 1 {
					secStr := strings.Split(parts[1], "s")[0]
					var sleepSecs float64
					if _, err := fmt.Sscanf(secStr, "%f", &sleepSecs); err == nil && sleepSecs > 0 {
						additionalSleep := time.Duration((sleepSecs + 0.5) * float64(time.Second))
						if additionalSleep > backoff {
							log.Printf("[GEMINI-CLIENT-RETRY] Gemini suggested waiting %v. Adjusting backoff to %v.", secStr+"s", additionalSleep)
							backoff = additionalSleep
						}
					}
				}
			}

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
			continue
		}

		if resp.StatusCode >= 500 {
			log.Printf("[GEMINI-CLIENT-RETRY] Received server error %d on attempt %d. Retrying...", resp.StatusCode, i+1)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
			continue
		}

		return nil, fmt.Errorf("gemini http error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	if resp == nil || resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini http error (status %d after %d retries): %s", resp.StatusCode, maxRetries, string(bodyBytes))
	}

	var geminiResponse struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
			GroundingMetadata *struct {
				GroundingChunks []struct {
					Web *struct {
						Title string `json:"title"`
						URI   string `json:"uri"`
					} `json:"web"`
				} `json:"groundingChunks"`
			} `json:"groundingMetadata"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(bodyBytes, &geminiResponse); err != nil {
		return nil, err
	}

	if len(geminiResponse.Candidates) == 0 || len(geminiResponse.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response received from Gemini API")
	}

	var textBuilder strings.Builder
	for _, part := range geminiResponse.Candidates[0].Content.Parts {
		textBuilder.WriteString(part.Text)
	}

	var sources []Source
	cand := geminiResponse.Candidates[0]
	if cand.GroundingMetadata != nil && cand.GroundingMetadata.GroundingChunks != nil {
		for _, chunk := range cand.GroundingMetadata.GroundingChunks {
			if chunk.Web != nil {
				sources = append(sources, Source{
					Title: chunk.Web.Title,
					URI:   chunk.Web.URI,
				})
			}
		}
	}

	return &LLMResponse{
		Text:    textBuilder.String(),
		Sources: sources,
	}, nil
}
