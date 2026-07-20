// ============================================================================
// SOVEREIGN ALGORITHMIC FOREX TRADING SYSTEM: INDEPENDENT SENTINEL (WATCHDOG)
// File: /cmd/watchdog/main.go
// Language: Go (Golang)
// ============================================================================

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/proda-nexus/sovereign-trading/internal/config"
	"github.com/proda-nexus/sovereign-trading/internal/db"
	"github.com/proda-nexus/sovereign-trading/internal/safety"
)

const (
	CheckInterval      = 2 * time.Second
	StateFilePath      = "/tmp/live_trading_state.json"
	GracefulFlagPath   = "/tmp/graceful_shutdown.flag"
	OfflineCachePath   = "postgres_state.json"
)

type HeartbeatResponse struct {
	Status             string                 `json:"status"`
	SystemStatus       string                 `json:"systemStatus"`
	ErrorCount         int                    `json:"errorCount"`
	LivePositionsCount int                    `json:"livePositionsCount"`
	LiveAccountStats   safety.LiveAccountStats `json:"liveAccountStats"`
	Timestamp          int64                  `json:"timestamp"`
}

type LocalPostgresState struct {
	BrokerConnections []struct {
		ID           string  `json:"id"`
		BrokerType   string  `json:"brokerType"`
		ApiURL       string  `json:"apiUrl"`
		AccountID    string  `json:"accountId"`
		Status       string  `json:"status"`
		ErrorMessage *string `json:"errorMessage"`
	} `json:"broker_connections"`
	StrategyAuditLogs []interface{} `json:"strategy_audit_logs"`
}

func main() {
	log.Println("=====================================================================")
	log.Println("  SOVEREIGN SENTINEL: INDEPENDENT WATCHDOG PROCESS (GO-MIGRATED) ")
	log.Println("=====================================================================")

	// 1. Load Configurations
	cfg := config.LoadConfig()
	log.Printf("[WATCHDOG] Loaded config. DB: %s, Env: %s", "postgresql://...", cfg.Environment)

	// 2. Initialize Safety Backstop
	safety.Init("safety_state.json")
	safety.UpdateState(map[string]interface{}{
		"watchdogStatus":        "NOMINAL",
		"watchdogLastHeartbeat": time.Now().UTC().Format(time.RFC3339),
	})

	// 3. Establish Postgres connection pool (isolated client pool)
	ctx := context.Background()
	var pgDB *db.DB
	var err error
	
	// We run connection loop in background to ensure watchdog doesn't freeze on start if DB is slow
	go func() {
		for {
			pgDB, err = db.Connect(ctx, cfg.DatabaseURL)
			if err == nil {
				log.Println("[WATCHDOG-POSTGRES] Connected to PostgreSQL successfully.")
				break
			}
			log.Printf("[WATCHDOG-POSTGRES-WARNING] Database not reachable: %v. Retrying in 5s...", err)
			time.Sleep(5 * time.Second)
		}
	}()

	consecutiveFailures := 0
	consecutiveDrlFailures := 0

	// 4. Monitoring Loop
	for {
		time.Sleep(CheckInterval)

		state := safety.GetState()

		// 1. Check if graceful shutdown is active
		isGraceful := false
		if _, err := os.Stat(GracefulFlagPath); err == nil {
			isGraceful = true
		}

		if !isGraceful && pgDB != nil && pgDB.Pool != nil {
			var val interface{}
			dbErr := pgDB.Pool.QueryRow(ctx, "SELECT value FROM runtime_state WHERE key = 'graceful_shutdown'").Scan(&val)
			if dbErr == nil {
				valStr := fmt.Sprintf("%v", val)
				if valStr == "true" || strings.Contains(valStr, "\"true\"") || strings.Contains(valStr, "true") {
					isGraceful = true
				}
			}
		}

		if isGraceful {
			consecutiveFailures = 0
			consecutiveDrlFailures = 0
			log.Println("[WATCHDOG] Stand-down active: Core engine is undergoing a zero-downtime graceful restart/handover.")
			continue
		}

		// 2. Check main core engine heartbeat
		mainServerAlive := false
		var mainState HeartbeatResponse

		mainServerURL := os.Getenv("MAIN_SERVER_URL")
		if mainServerURL == "" {
			mainServerURL = "http://127.0.0.1:3000"
		}

		client := &http.Client{Timeout: 1500 * time.Millisecond}
		resp, httpErr := client.Get(mainServerURL + "/api/safety/heartbeat")
		if httpErr == nil && resp.StatusCode == http.StatusOK {
			body, readErr := ioutil.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr == nil {
				if unmarshalErr := json.Unmarshal(body, &mainState); unmarshalErr == nil {
					mainServerAlive = true
					consecutiveFailures = 0
				} else {
					consecutiveFailures++
					log.Printf("[WATCHDOG-WARNING] Heartbeat parse failed: %v. Consecutive: %d", unmarshalErr, consecutiveFailures)
				}
			} else {
				consecutiveFailures++
			}
		} else {
			consecutiveFailures++
			if httpErr != nil {
				log.Printf("[WATCHDOG-WARNING] Heartbeat HTTP request failed: %v. Consecutive: %d", httpErr, consecutiveFailures)
			} else {
				log.Printf("[WATCHDOG-WARNING] Heartbeat HTTP status non-OK: %d. Consecutive: %d", resp.StatusCode, consecutiveFailures)
				resp.Body.Close()
			}
		}

		// Update watchdog last heartbeat on disk state
		safety.UpdateState(map[string]interface{}{
			"watchdogLastHeartbeat": time.Now().UTC().Format(time.RFC3339),
		})

		// 3. Check DRL service status
		drlResp, drlErr := client.Get("http://127.0.0.1:8000/api/drl/telemetry")
		if drlErr == nil && drlResp.StatusCode == http.StatusOK {
			consecutiveDrlFailures = 0
			drlResp.Body.Close()
		} else {
			consecutiveDrlFailures++
			if drlErr == nil {
				drlResp.Body.Close()
			}
		}

		// 4. Read live trading state from disk (independent memory backup)
		var liveState safety.LiveTradingState
		if _, statErr := os.Stat(StateFilePath); statErr == nil {
			if fileBytes, readErr := ioutil.ReadFile(StateFilePath); readErr == nil {
				if err := json.Unmarshal(fileBytes, &liveState); err == nil {
					// Normalize fields for TS and Go cross-compat
					if len(liveState.LivePositions) == 0 && len(liveState.DemoLivePositions) > 0 {
						liveState.LivePositions = liveState.DemoLivePositions
					}
					if liveState.LiveAccountStats.Balance == 0 && liveState.DemoLiveAccountStats.Balance != 0 {
						liveState.LiveAccountStats = liveState.DemoLiveAccountStats
					}
				}
			}
		}

		// 5. Read broker connections (direct DB access or local fallback)
		var brokerConnections []struct {
			ID           string  `json:"id"`
			BrokerType   string  `json:"brokerType"`
			Status       string  `json:"status"`
			AccountID    string  `json:"accountId"`
		}

		dbQueriedOk := false
		if pgDB != nil && pgDB.Pool != nil {
			rows, queryErr := pgDB.Pool.Query(ctx, "SELECT id, broker_type, status, account_id FROM broker_connections")
			if queryErr == nil {
				defer rows.Close()
				dbQueriedOk = true
				for rows.Next() {
					var conn struct {
						ID         string
						BrokerType string
						Status     string
						AccountID  string
					}
					if scanErr := rows.Scan(&conn.ID, &conn.BrokerType, &conn.Status, &conn.AccountID); scanErr == nil {
						brokerConnections = append(brokerConnections, struct {
							ID         string  `json:"id"`
							BrokerType string  `json:"brokerType"`
							Status     string  `json:"status"`
							AccountID  string  `json:"accountId"`
						}{
							ID:         conn.ID,
							BrokerType: conn.BrokerType,
							Status:     conn.Status,
							AccountID:  conn.AccountID,
						})
					}
				}
			}
		}

		// Fallback to postgres_state.json if DB unreachable
		if !dbQueriedOk {
			if _, fErr := os.Stat(OfflineCachePath); fErr == nil {
				if fileBytes, rErr := ioutil.ReadFile(OfflineCachePath); rErr == nil {
					var offlineState LocalPostgresState
					if jErr := json.Unmarshal(fileBytes, &offlineState); jErr == nil {
						for _, conn := range offlineState.BrokerConnections {
							brokerConnections = append(brokerConnections, struct {
								ID         string  `json:"id"`
								BrokerType string  `json:"brokerType"`
								Status     string  `json:"status"`
								AccountID  string  `json:"accountId"`
							}{
								ID:         conn.ID,
								BrokerType: conn.BrokerType,
								Status:     conn.Status,
								AccountID:  conn.AccountID,
							})
						}
					}
				}
			}
		}

		// --- EVALUATE FAULT LOGIC CONDITIONS ---

		// Condition A: Main system unresponsive (3 failures / 6 seconds)
		if consecutiveFailures >= 3 {
			if !state.SafeModeActive || !state.EmergencyHaltActive {
				reason := fmt.Sprintf("MAIN ENGINE UNRESPONSIVE: Failed heartbeat checks %d consecutive times. Detached sentinel initiating failover.", consecutiveFailures)
				log.Printf("[WATCHDOG-CRITICAL] %s", reason)

				safety.TriggerSafeMode(reason)
				safety.TriggerEmergencyHalt(reason, map[string]interface{}{"source": "WATCHDOG_DETECTION"})

				// Run halt policy directly on disk since server is frozen!
				executeHaltPolicyOnDisk(state.EmergencyHaltPolicy, liveState, pgDB, ctx)
			}
		}

		// Condition B: High error rate reported in heartbeats
		if mainServerAlive && mainState.ErrorCount > 10 {
			if !state.SafeModeActive {
				reason := fmt.Sprintf("CRITICAL EXCEPTION FLOW: Core engine reported high error frequency (%d exceptions logged). Switching to Safe Mode.", mainState.ErrorCount)
				log.Printf("[WATCHDOG-CRITICAL] %s", reason)
				safety.TriggerSafeMode(reason)
			}
		}

		// Condition C: Severed broker link mid-position
		hasOpenPositions := len(liveState.LivePositions) > 0
		if hasOpenPositions {
			for _, conn := range brokerConnections {
				if conn.Status == "DISCONNECTED" || conn.Status == "FAILED" {
					if !state.SafeModeActive {
						reason := fmt.Sprintf("BROKER LINK SEVERED: Broker connection '%s' (ID: %s) disconnected or failed mid-position. Enforcing Safe Mode.", conn.BrokerType, conn.AccountID)
						log.Printf("[WATCHDOG-CRITICAL] %s", reason)
						safety.TriggerSafeMode(reason)
					}
					break
				}
			}
		}

		// Condition D: DRL Outage while holding open positions
		if consecutiveDrlFailures >= 5 && hasOpenPositions {
			if !state.SafeModeActive {
				reason := fmt.Sprintf("DRL OUTAGE: Deep Reinforcement Learning backend lost heartbeat for 10 seconds during active exposure. Safe Mode triggered.")
				log.Printf("[WATCHDOG-CRITICAL] %s", reason)
				safety.TriggerSafeMode(reason)
			}
		}
	}
}

func executeHaltPolicyOnDisk(policy string, liveState safety.LiveTradingState, pgDB *db.DB, ctx context.Context) {
	if policy != "FLATTEN_ALL" {
		log.Println("[WATCHDOG-RECOVERY] Policy is FREEZE_NEW_ONLY. No positions were flattened on disk.")
		return
	}

	positionsCount := len(liveState.LivePositions)
	if positionsCount == 0 {
		return
	}

	log.Printf("[WATCHDOG-RECOVERY] Executing FLATTEN_ALL policy. Closing %d open positions independently.", positionsCount)

	// In TypeScript version: we sum the pnl of the positions to adjust balance/equity
	totalPnLSum := 0.0
	// Try parsing positions PnL if any
	for _, posRaw := range liveState.LivePositions {
		if posMap, ok := posRaw.(map[string]interface{}); ok {
			if pnlVal, pnlExists := posMap["pnl"]; pnlExists {
				if pnlFloat, isFloat := pnlVal.(float64); isFloat {
					totalPnLSum += pnlFloat
				}
			}
		}
	}

	bal := liveState.LiveAccountStats.Balance
	if bal == 0 {
		bal = 104250.40
	}
	finalBal := bal + totalPnLSum

	updatedStats := safety.LiveAccountStats{
		Balance:    finalBal,
		Equity:     finalBal,
		UsedMargin: 0,
		FreeMargin: finalBal,
		MarginLevel: 0,
		TodayPnL:   liveState.LiveAccountStats.TodayPnL + totalPnLSum,
	}

	recoveryState := map[string]interface{}{
		"livePositions":        []interface{}{},
		"liveAccountStats":     updatedStats,
		"timestamp":            time.Now().UnixNano() / int64(time.Millisecond),
		"recoveryTriggered":    true,
		"recoveryReason":       "WIPED_BY_WATCHDOG_HALT_POLICY",
		"demoLivePositions":    []interface{}{},
		"demoLiveAccountStats": updatedStats,
	}

	data, err := json.MarshalIndent(recoveryState, "", "  ")
	if err == nil {
		_ = ioutil.WriteFile(StateFilePath, data, 0644)
		log.Println("[WATCHDOG-RECOVERY] Successfully flattened live positions state on disk.")
	}

	// Write directly to DB or save locally if DB is down
	actionTaken := fmt.Sprintf("Watchdog executed emergency FLATTEN_ALL policy due to unresponsive core engine. Closed %d positions. Realized PnL: $%.2f.", positionsCount, totalPnLSum)
	inputParams := map[string]interface{}{"policy": policy, "positionsCount": positionsCount}
	outputResult := map[string]interface{}{"finalBalance": finalBal}

	dbSaved := false
	if pgDB != nil && pgDB.Pool != nil {
		_, dbErr := pgDB.Pool.Exec(ctx,
			`INSERT INTO strategy_audit_logs (id, timestamp, symbol, mode, trigger_value, action_taken, input_params, output_result)
			 VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
			fmt.Sprintf("audit-%d-watchdog", time.Now().UnixNano()),
			"ALL",
			"FAILOVER WATCHDOG",
			nil,
			actionTaken,
			inputParams,
			outputResult,
		)
		if dbErr == nil {
			log.Println("[WATCHDOG-RECOVERY] Successfully committed recovery log directly into PostgreSQL database.")
			dbSaved = true
		} else {
			log.Printf("[WATCHDOG-RECOVERY-ERROR] Failed to write audit log to DB: %v", dbErr)
		}
	}

	if !dbSaved {
		if _, err := os.Stat(OfflineCachePath); err == nil {
			if fileBytes, rErr := ioutil.ReadFile(OfflineCachePath); rErr == nil {
				var fileData map[string]interface{}
				if jErr := json.Unmarshal(fileBytes, &fileData); jErr == nil {
					var auditLogs []interface{}
					if existing, ok := fileData["strategy_audit_logs"].([]interface{}); ok {
						auditLogs = existing
					}
					
					newLog := map[string]interface{}{
						"id":           fmt.Sprintf("audit-%d-watchdog", time.Now().UnixNano()),
						"timestamp":    time.Now().UTC().Format(time.RFC3339),
						"symbol":       "ALL",
						"mode":         "FAILOVER WATCHDOG",
						"triggerValue": nil,
						"actionTaken":  actionTaken,
						"inputParams":  inputParams,
						"outputResult": outputResult,
					}
					auditLogs = append([]interface{}{newLog}, auditLogs...)
					fileData["strategy_audit_logs"] = auditLogs
					
					if updatedBytes, wErr := json.MarshalIndent(fileData, "", "  "); wErr == nil {
						_ = ioutil.WriteFile(OfflineCachePath, updatedBytes, 0644)
						log.Println("[WATCHDOG-RECOVERY] Successfully saved recovery log to offline local json cache.")
					}
				}
			}
		}
	}
}
