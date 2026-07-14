// ============================================================================
// SOVEREIGN ALGORITHMIC FOREX TRADING SYSTEM: GO SAFETY BACKSTOP MODULE
// File: /internal/safety/backstop.go
// Language: Go (Golang)
// ============================================================================

package safety

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"
)

type RollbackEvent struct {
	Timestamp        string                 `json:"timestamp"`
	FromVersion      string                 `json:"fromVersion"`
	ToVersion        string                 `json:"toVersion"`
	MetricsAtTrigger map[string]interface{} `json:"metricsAtTrigger"`
}

type TriggerHistoryItem struct {
	ID        string                 `json:"id"`
	Timestamp string                 `json:"timestamp"`
	Type      string                 `json:"type"` // "SAFE_MODE" | "SILENT_LOCK" | "EMERGENCY_HALT" | "SYSTEM"
	Event     string                 `json:"event"`
	Reason    string                 `json:"reason"`
	Details   map[string]interface{} `json:"details"`
}

type NotificationConfig struct {
	WebhookURL  string `json:"webhookUrl"`
	EmailAlerts bool   `json:"emailAlerts"`
	SMSAlerts   bool   `json:"smsAlerts"`
}

type Notification struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
}

type SafetyState struct {
	SafeModeActive               bool                 `json:"safeModeActive"`
	SafeModeTriggerReason        *string              `json:"safeModeTriggerReason"`
	SafeModeTriggeredAt          *string              `json:"safeModeTriggeredAt"`
	SilentLockActive             bool                 `json:"silentLockActive"`
	SilentLockTriggerReason      *string              `json:"silentLockTriggerReason"`
	SilentLockTriggeredAt        *string              `json:"silentLockTriggeredAt"`
	EmergencyHaltActive          bool                 `json:"emergencyHaltActive"`
	EmergencyHaltPolicy          string               `json:"emergencyHaltPolicy"` // "FLATTEN_ALL" | "FREEZE_NEW_ONLY"
	DrawdownThresholdPct         float64              `json:"drawdownThresholdPct"`
	PeakEquity                   float64              `json:"peakEquity"`
	MaxTotalNotionalExposure     float64              `json:"maxTotalNotionalExposure"`
	MaxSingleInstrumentExposure  float64              `json:"maxSingleInstrumentExposure"`
	MaxCorrelatedGroupExposure   float64              `json:"maxCorrelatedGroupExposure"`
	WatchdogLastHeartbeat        string               `json:"watchdogLastHeartbeat"`
	WatchdogStatus               string               `json:"watchdogStatus"` // "ALIVE" | "ERROR" | "NOMINAL"
	LastDrawdownPct              float64              `json:"lastDrawdownPct"`
	LastRollbackEvent            *RollbackEvent       `json:"lastRollbackEvent"`
	TriggerHistory               []TriggerHistoryItem `json:"triggerHistory"`
	NotificationConfig           NotificationConfig   `json:"notificationConfig"`
	Notifications                []Notification       `json:"notifications"`
}

type Position struct {
	ID           string  `json:"id"`
	Symbol       string  `json:"symbol"`
	Type         string  `json:"type"` // "BUY" | "SELL"
	Size         float64 `json:"size"`
	EntryPrice   float64 `json:"entryPrice"`
	CurrentPrice float64 `json:"currentPrice"`
	PnL          float64 `json:"pnl"`
	PnLPips      float64 `json:"pnlPips"`
}

type safetyBackstopManager struct {
	mu       sync.RWMutex
	filepath string
	state    SafetyState
}

var (
	manager *safetyBackstopManager
	once    sync.Once
)

func Init(stateFilePath string) {
	once.Do(func() {
		manager = &safetyBackstopManager{
			filepath: stateFilePath,
		}
		manager.load()
	})
}

func init() {
	// Automatically initialize to safety_state.json in current directory on load
	Init("safety_state.json")
}

func getDefaultState() SafetyState {
	nowStr := time.Now().UTC().Format(time.RFC3339)
	return SafetyState{
		SafeModeActive:              false,
		SilentLockActive:            false,
		EmergencyHaltActive:         false,
		EmergencyHaltPolicy:         "FLATTEN_ALL",
		DrawdownThresholdPct:        5.0,
		PeakEquity:                  104830.40,
		MaxTotalNotionalExposure:    500000.00,
		MaxSingleInstrumentExposure: 300000.00,
		MaxCorrelatedGroupExposure:  400000.00,
		WatchdogLastHeartbeat:       nowStr,
		WatchdogStatus:              "NOMINAL",
		LastDrawdownPct:             0.0,
		TriggerHistory: []TriggerHistoryItem{
			{
				ID:        "hist-init",
				Timestamp: nowStr,
				Type:      "SYSTEM",
				Event:     "Safety Backstop Initialized",
				Reason:    "System boot and safety isolation layer established.",
				Details:   map[string]interface{}{},
			},
		},
		NotificationConfig: NotificationConfig{
			WebhookURL:  "https://discord.com/api/webhooks/dummy-sovereign",
			EmailAlerts: true,
			SMSAlerts:   false,
		},
		Notifications: []Notification{},
	}
}

func (m *safetyBackstopManager) load() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, err := os.Stat(m.filepath); os.IsNotExist(err) {
		m.state = getDefaultState()
		_ = m.saveLocked()
		return
	}

	data, err := ioutil.ReadFile(m.filepath)
	if err != nil {
		log.Printf("[SAFETY-BACKSTOP] Load error, falling back to defaults: %v", err)
		m.state = getDefaultState()
		_ = m.saveLocked()
		return
	}

	var state SafetyState
	if err := json.Unmarshal(data, &state); err != nil {
		log.Printf("[SAFETY-BACKSTOP] Parse error, falling back to defaults: %v", err)
		m.state = getDefaultState()
		_ = m.saveLocked()
		return
	}

	m.state = state
}

func (m *safetyBackstopManager) saveLocked() error {
	data, err := json.MarshalIndent(m.state, "", "  ")
	if err != nil {
		log.Printf("[SAFETY-BACKSTOP] Failed to marshal state: %v", err)
		return err
	}

	err = ioutil.WriteFile(m.filepath, data, 0644)
	if err != nil {
		log.Printf("[SAFETY-BACKSTOP] Failed to write state file: %v", err)
		return err
	}
	return nil
}

func (m *safetyBackstopManager) save() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.saveLocked()
}

// PUBLIC GUARDED ENTRY POINTS (Encapsulated API)

func GetState() SafetyState {
	manager.mu.RLock()
	defer manager.mu.RUnlock()
	return manager.state
}

func UpdateState(updates map[string]interface{}) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	stateJSON, _ := json.Marshal(manager.state)
	var merged map[string]interface{}
	_ = json.Unmarshal(stateJSON, &merged)

	for k, v := range updates {
		merged[k] = v
	}

	mergedJSON, _ := json.Marshal(merged)
	var newState SafetyState
	if err := json.Unmarshal(mergedJSON, &newState); err == nil {
		manager.state = newState
		_ = manager.saveLocked()
	}
}

func AddNotification(message string) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	rand.Seed(time.Now().UnixNano())
	id := fmt.Sprintf("notif-%d-%x", time.Now().UnixNano(), rand.Intn(100000))

	notif := Notification{
		ID:        id,
		Timestamp: nowStr,
		Message:   message,
		Read:      false,
	}

	manager.state.Notifications = append([]Notification{notif}, manager.state.Notifications...)
	if len(manager.state.Notifications) > 50 {
		manager.state.Notifications = manager.state.Notifications[:50]
	}
	_ = manager.saveLocked()
	log.Printf("[SAFETY-NOTIFICATION] %s", message)
}

func LogTrigger(triggerType, event, reason string, details map[string]interface{}) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	rand.Seed(time.Now().UnixNano())
	id := fmt.Sprintf("trig-%d-%x", time.Now().UnixNano(), rand.Intn(100000))

	item := TriggerHistoryItem{
		ID:        id,
		Timestamp: nowStr,
		Type:      triggerType,
		Event:     event,
		Reason:    reason,
		Details:   details,
	}

	manager.state.TriggerHistory = append([]TriggerHistoryItem{item}, manager.state.TriggerHistory...)
	if len(manager.state.TriggerHistory) > 100 {
		manager.state.TriggerHistory = manager.state.TriggerHistory[:100]
	}
	_ = manager.saveLocked()
}

func TriggerSafeMode(reason string) {
	state := GetState()
	if state.SafeModeActive {
		return
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)

	manager.mu.Lock()
	manager.state.SafeModeActive = true
	manager.state.SafeModeTriggerReason = &reason
	manager.state.SafeModeTriggeredAt = &nowStr
	_ = manager.saveLocked()
	manager.mu.Unlock()

	AddNotification(fmt.Sprintf("🚨 [Plan B Failover] Safe Mode ACTIVATED: %s", reason))
	LogTrigger("SAFE_MODE", "Safe Mode Activated", reason, map[string]interface{}{"triggeredAt": nowStr})
}

func ExitSafeMode() {
	state := GetState()
	if !state.SafeModeActive {
		return
	}

	manager.mu.Lock()
	manager.state.SafeModeActive = false
	manager.state.SafeModeTriggerReason = nil
	manager.state.SafeModeTriggeredAt = nil
	_ = manager.saveLocked()
	manager.mu.Unlock()

	AddNotification("✅ [Plan B Failover] Safe Mode disengaged. System restored to normal trading parameters.")
	LogTrigger("SAFE_MODE", "Safe Mode Disengaged", "Manual operator reactivation.", map[string]interface{}{})
}

func TriggerSilentLock(reason string, details map[string]interface{}) {
	state := GetState()
	if state.SilentLockActive {
		return
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)

	manager.mu.Lock()
	manager.state.SilentLockActive = true
	manager.state.SilentLockTriggerReason = &reason
	manager.state.SilentLockTriggeredAt = &nowStr
	_ = manager.saveLocked()
	manager.mu.Unlock()

	AddNotification(fmt.Sprintf("🛑 [SILENT LOCK] Hard Soft-Halt ENGAGED: %s. All new position entries and evolution candidate promotions are strictly blocked.", reason))
	LogTrigger("SILENT_LOCK", "Silent Lock Activated", reason, details)
}

func ResumeFromSilentLock() {
	state := GetState()
	if !state.SilentLockActive {
		return
	}

	manager.mu.Lock()
	manager.state.SilentLockActive = false
	manager.state.SilentLockTriggerReason = nil
	manager.state.SilentLockTriggeredAt = nil
	_ = manager.saveLocked()
	manager.mu.Unlock()

	AddNotification("✅ [SILENT LOCK] Reset. Live trading operations and candidate promotions re-authorized by human operator.")
	LogTrigger("SILENT_LOCK", "Silent Lock Reset", "Manual operator override with double verification.", map[string]interface{}{})
}

func TriggerEmergencyHalt(reason string, details map[string]interface{}) {
	manager.mu.Lock()
	manager.state.EmergencyHaltActive = true
	policy := manager.state.EmergencyHaltPolicy
	_ = manager.saveLocked()
	manager.mu.Unlock()

	AddNotification(fmt.Sprintf("⚠️ [EMERGENCY HALT] Triggered: %s. Policy: %s", reason, policy))
	LogTrigger("EMERGENCY_HALT", "Emergency Halt Tripped", reason, map[string]interface{}{
		"policy": policy,
		"details": details,
	})
}

func ResetEmergencyHalt() {
	manager.mu.Lock()
	manager.state.EmergencyHaltActive = false
	_ = manager.saveLocked()
	manager.mu.Unlock()

	AddNotification("✅ [EMERGENCY HALT] System disarmed. Nominals restored.")
	LogTrigger("EMERGENCY_HALT", "Emergency Halt Cleared", "Operator reset system status.", map[string]interface{}{})
}

func GetExposures(positions []Position) (float64, map[string]float64, float64) {
	var totalNotional float64
	singleExposures := map[string]float64{
		"EUR/USD": 0,
		"GBP/USD": 0,
		"BTC/USD": 0,
	}

	var usdShortExposure float64
	var usdLongExposure float64

	for _, pos := range positions {
		symNorm := strings.ReplaceAll(strings.ToUpper(pos.Symbol), "/", "")
		price := pos.CurrentPrice
		if price == 0 {
			price = pos.EntryPrice
		}
		if price == 0 {
			if symNorm == "EURUSD" {
				price = 1.085
			} else if symNorm == "GBPUSD" {
				price = 1.273
			} else {
				price = 62500
			}
		}

		multiplier := 1.0
		if symNorm == "EURUSD" || symNorm == "GBPUSD" {
			multiplier = 100000.0
		}

		notional := pos.Size * multiplier * price
		totalNotional += notional

		key := "EUR/USD"
		if symNorm == "GBPUSD" {
			key = "GBP/USD"
		} else if symNorm == "BTCUSD" {
			key = "BTC/USD"
		}
		singleExposures[key] = singleExposures[key] + notional

		if key == "EUR/USD" || key == "GBP/USD" {
			if pos.Type == "BUY" {
				usdShortExposure += notional
			} else if pos.Type == "SELL" {
				usdLongExposure += notional
			}
		}
	}

	correlatedGroupExposure := math.Max(usdShortExposure, usdLongExposure)
	return totalNotional, singleExposures, correlatedGroupExposure
}

func CheckExposureLimits(newPosition *Position, currentPositions []Position) error {
	state := GetState()

	positions := make([]Position, len(currentPositions))
	copy(positions, currentPositions)
	if newPosition != nil {
		positions = append(positions, *newPosition)
	}

	totalNotional, singleExposures, correlatedGroupExposure := GetExposures(positions)

	if totalNotional > state.MaxTotalNotionalExposure {
		return fmt.Errorf("Proposed position would push total exposure to $%.2f, breaching maximum limit of $%.2f.", totalNotional, state.MaxTotalNotionalExposure)
	}

	for inst, exp := range singleExposures {
		if exp > state.MaxSingleInstrumentExposure {
			return fmt.Errorf("Proposed position would push single-instrument exposure for %s to $%.2f, breaching maximum limit of $%.2f.", inst, exp, state.MaxSingleInstrumentExposure)
		}
	}

	if correlatedGroupExposure > state.MaxCorrelatedGroupExposure {
		return fmt.Errorf("Proposed position would push correlated group exposure to $%.2f, breaching maximum limit of $%.2f.", correlatedGroupExposure, state.MaxCorrelatedGroupExposure)
	}

	return nil
}

func AssertTradingAllowed(newPosition *Position, currentPositions []Position) error {
	state := GetState()
	if state.SilentLockActive {
		reason := "Maximum drawdown limit breached"
		if state.SilentLockTriggerReason != nil {
			reason = *state.SilentLockTriggerReason
		}
		return fmt.Errorf("Trading forbidden: Silent Lock is currently active: %s", reason)
	}
	if state.EmergencyHaltActive {
		return errors.New("Trading forbidden: Emergency Halt is currently active.")
	}
	if state.SafeModeActive {
		reason := "Failover Mode"
		if state.SafeModeTriggerReason != nil {
			reason = *state.SafeModeTriggerReason
		}
		return fmt.Errorf("Trading forbidden: Safe Mode is currently active: %s", reason)
	}

	return CheckExposureLimits(newPosition, currentPositions)
}

func CheckDrawdown(currentEquity float64) bool {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	if currentEquity > manager.state.PeakEquity {
		manager.state.PeakEquity = currentEquity
		_ = manager.saveLocked()
		return false
	}

	drawdownPct := 0.0
	if manager.state.PeakEquity > 0 {
		drawdownPct = ((manager.state.PeakEquity - currentEquity) / manager.state.PeakEquity) * 100.0
	}

	manager.state.LastDrawdownPct = drawdownPct
	_ = manager.saveLocked()

	if drawdownPct >= manager.state.DrawdownThresholdPct {
		reason := fmt.Sprintf("Drawdown Limit Exceeded: Current drawdown of %.2f%% breached threshold of %.2f%%. Peak Equity: $%.2f, Current Equity: $%.2f",
			drawdownPct, manager.state.DrawdownThresholdPct, manager.state.PeakEquity, currentEquity)

		if !manager.state.SilentLockActive {
			// Release lock, trigger silent lock, then re-acquire to avoid nested deadlock on save
			manager.mu.Unlock()
			TriggerSilentLock(reason, map[string]interface{}{
				"drawdownPct": drawdownPct,
				"peakEquity":  GetState().PeakEquity,
				"equity":      currentEquity,
			})
			manager.mu.Lock()
		}
		return true
	}

	return false
}
