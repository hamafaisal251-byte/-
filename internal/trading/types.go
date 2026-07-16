package trading

import (
	"sync"
	"time"
)

// Position represents an active trade
type Position struct {
	ID           string    `json:"id"`
	Symbol       string    `json:"symbol"`
	Type         string    `json:"type"` // "BUY" | "SELL"
	Size         float64   `json:"size"`
	EntryPrice   float64   `json:"entryPrice"`
	CurrentPrice float64   `json:"currentPrice"`
	SL           float64   `json:"sl"`
	TP           float64   `json:"tp"`
	PnL          float64   `json:"pnl"`
	CreatedAt    time.Time `json:"createdAt"`
}

// AccountStats represents the demo/live account equity and margin metrics
type AccountStats struct {
	Balance     float64 `json:"balance"`
	Equity      float64 `json:"equity"`
	UsedMargin  float64 `json:"usedMargin"`
	FreeMargin  float64 `json:"freeMargin"`
	MarginLevel float64 `json:"marginLevel"`
	DailyPnL    float64 `json:"dailyPnl"`
}

// Tick represents a price update point
type Tick struct {
	Price  float64
	Volume int64
}

// BinanceDepth represents order book depth retrieved from Binance API
type BinanceDepth struct {
	BidsVolume     float64 `json:"bidsVolume"`
	AsksVolume     float64 `json:"asksVolume"`
	ImbalanceRatio float64 `json:"imbalanceRatio"`
	LastUpdate     time.Time
}

// ArbitrageConfig stores parameters for cross-exchange arbitrage
type ArbitrageConfig struct {
	LiveEnabled             bool    `json:"liveEnabled"`
	ThresholdNetProfitUsd   float64 `json:"thresholdNetProfitUsd"`
	OrderSizeBtc            float64 `json:"orderSizeBtc"`
	SlippagePct             float64 `json:"slippagePct"`
}

// ArbitrageState combines config with compliance details
type ArbitrageState struct {
	Config     ArbitrageConfig `json:"config"`
	Compliance struct {
		TosPermitted         bool `json:"tosPermitted"`
		RegulationsPermitted bool `json:"regulationsPermitted"`
		SandboxPassed        bool `json:"sandboxPassed"`
	} `json:"compliance"`
}

// StrategyConfig represents options for an instrument's strategy
type StrategyConfig struct {
	Symbol                    string  `json:"symbol"`
	WhaleMode                 bool    `json:"whaleMode"`
	SniperMode                bool    `json:"sniperMode"`
	BreakevenEnabled          bool    `json:"breakevenEnabled"`
	BreakevenThreshold        float64 `json:"breakevenThreshold"`
	DynamicSLEnabled          bool    `json:"dynamicSlEnabled"`
	ShockAbsorberEnabled      bool    `json:"shockAbsorberEnabled"`
	WhaleConfidenceThreshold  float64 `json:"whaleConfidenceThreshold"`
	SniperConfidenceThreshold float64 `json:"sniperConfidenceThreshold"`
}

// Global thread-safe state for the trading system
type TradingStateManager struct {
	mu                         sync.RWMutex
	liveRates                  map[string]float64
	livePositions              []Position
	accountStats               AccountStats
	rollingTicks               map[string][]Tick
	lastBinanceBTCUSDDepth     *BinanceDepth
	latestDrlArbitrageFeature  float64
	arbitrageConfig            ArbitrageConfig
	oandaConnected             bool
	systemStatus               string // "NOMINAL" | "THROTTLED" | "EMERGENCY_HALT"
	avgLoopLatencyNs           int64
	packetsPerSecond           int64
	shockAbsorberLevel         float64
	isShockAbsorberActive      bool
	minutesUntilHighImpactNews int
}

var (
	State *TradingStateManager
	once  sync.Once
)

func InitState() {
	once.Do(func() {
		State = &TradingStateManager{
			liveRates: map[string]float64{
				"EUR/USD": 1.08520,
				"GBP/USD": 1.27350,
				"USD/JPY": 156.440,
				"AUD/USD": 0.66580,
				"BTC/USD": 62500.0,
			},
			livePositions: []Position{},
			accountStats: AccountStats{
				Balance:     100000.0,
				Equity:      100000.0,
				UsedMargin:  0.0,
				FreeMargin:  100000.0,
				MarginLevel: 0.0,
				DailyPnL:    0.0,
			},
			rollingTicks: map[string][]Tick{
				"EUR/USD": {},
				"GBP/USD": {},
				"BTC/USD": {},
			},
			arbitrageConfig: ArbitrageConfig{
				LiveEnabled:           false,
				ThresholdNetProfitUsd: 15.0,
				OrderSizeBtc:          0.25,
				SlippagePct:           0.05,
			},
			systemStatus:               "NOMINAL",
			avgLoopLatencyNs:           180,
			packetsPerSecond:           45000,
			shockAbsorberLevel:         0.12,
			isShockAbsorberActive:      false,
			minutesUntilHighImpactNews: 999,
		}
	})
}

func init() {
	InitState()
}

// Safe getters and setters
func (m *TradingStateManager) GetLiveRates() map[string]float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rates := make(map[string]float64)
	for k, v := range m.liveRates {
		rates[k] = v
	}
	return rates
}

func (m *TradingStateManager) GetRate(symbol string) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.liveRates[symbol]
}

func (m *TradingStateManager) SetLiveRates(rates map[string]float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, v := range rates {
		m.liveRates[k] = v
	}
}

func (m *TradingStateManager) GetPositions() []Position {
	m.mu.RLock()
	defer m.mu.RUnlock()
	copied := make([]Position, len(m.livePositions))
	copy(copied, m.livePositions)
	return copied
}

func (m *TradingStateManager) SetPositions(positions []Position) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.livePositions = positions
}

func (m *TradingStateManager) AddPosition(pos Position) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.livePositions = append(m.livePositions, pos)
}

func (m *TradingStateManager) GetAccountStats() AccountStats {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.accountStats
}

func (m *TradingStateManager) SetAccountStats(stats AccountStats) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.accountStats = stats
}

func (m *TradingStateManager) UpdateAccountStats(usedMargin float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.accountStats.UsedMargin = usedMargin
	m.accountStats.FreeMargin = m.accountStats.Equity - m.accountStats.UsedMargin
}

func (m *TradingStateManager) GetRollingTicks(symbol string) []Tick {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ticks := m.rollingTicks[symbol]
	copied := make([]Tick, len(ticks))
	copy(copied, ticks)
	return copied
}

func (m *TradingStateManager) AddRollingTick(symbol string, tick Tick) {
	m.mu.Lock()
	defer m.mu.Unlock()
	ticks := m.rollingTicks[symbol]
	ticks = append(ticks, tick)
	if len(ticks) > 20 {
		ticks = ticks[len(ticks)-20:]
	}
	m.rollingTicks[symbol] = ticks
}

func (m *TradingStateManager) GetBinanceBTCUSDDepth() *BinanceDepth {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.lastBinanceBTCUSDDepth == nil {
		return nil
	}
	depth := *m.lastBinanceBTCUSDDepth
	return &depth
}

func (m *TradingStateManager) SetBinanceBTCUSDDepth(depth *BinanceDepth) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.lastBinanceBTCUSDDepth = depth
}

func (m *TradingStateManager) GetLatestDrlArbitrageFeature() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.latestDrlArbitrageFeature
}

func (m *TradingStateManager) SetLatestDrlArbitrageFeature(val float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.latestDrlArbitrageFeature = val
}

func (m *TradingStateManager) GetArbitrageConfig() ArbitrageConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.arbitrageConfig
}

func (m *TradingStateManager) SetArbitrageConfig(cfg ArbitrageConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.arbitrageConfig = cfg
}

func (m *TradingStateManager) GetOandaConnected() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.oandaConnected
}

func (m *TradingStateManager) SetOandaConnected(connected bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.oandaConnected = connected
}

func (m *TradingStateManager) GetSystemStatus() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.systemStatus
}

func (m *TradingStateManager) SetSystemStatus(status string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.systemStatus = status
}

func (m *TradingStateManager) GetLatencyAndPackets() (int64, int64) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.avgLoopLatencyNs, m.packetsPerSecond
}

func (m *TradingStateManager) SetLatencyAndPackets(lat, pps int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.avgLoopLatencyNs = lat
	m.packetsPerSecond = pps
}

func (m *TradingStateManager) GetShockAbsorber() (float64, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.shockAbsorberLevel, m.isShockAbsorberActive
}

func (m *TradingStateManager) SetShockAbsorber(level float64, active bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shockAbsorberLevel = level
	m.isShockAbsorberActive = active
}

func (m *TradingStateManager) GetMinutesUntilHighImpactNews() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.minutesUntilHighImpactNews
}

func (m *TradingStateManager) SetMinutesUntilHighImpactNews(minutes int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.minutesUntilHighImpactNews = minutes
}
