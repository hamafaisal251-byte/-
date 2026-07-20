package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/proda-nexus/sovereign-trading/internal/db"
)

type BucketConfig struct {
	Name string
	Min  float64
	Max  float64
}

type CalibrationItem struct {
	Instrument      string
	Mode            string
	ConfidenceScore float64
	Outcome         string
	PnLPips         float64
	ModelID         string
}

// RunCalibrationAnalysis implements the offline Brier Calibration & parameter tuning loop.
func RunCalibrationAnalysis(ctx context.Context, database *db.DB, addServerLog func(string, string, string)) error {
	log.Println("[CALIBRATION] Starting scientific offline shadow calibration loop in Go...")

	// 1. Fetch resolved predictions
	rows, err := database.Pool.Query(ctx, 
		`SELECT instrument, mode, confidence_score, outcome, COALESCE(pnl_pips, 0.0), COALESCE(model_id, 'ensemble') 
		 FROM prediction_log WHERE outcome IS NOT NULL`)
	if err != nil {
		return fmt.Errorf("failed to query predictions: %v", err)
	}
	defer rows.Close()

	var logs []CalibrationItem
	for rows.Next() {
		var item CalibrationItem
		err := rows.Scan(&item.Instrument, &item.Mode, &item.ConfidenceScore, &item.Outcome, &item.PnLPips, &item.ModelID)
		if err != nil {
			return fmt.Errorf("error scanning prediction log: %v", err)
		}
		logs = append(logs, item)
	}

	if len(logs) == 0 {
		log.Println("[CALIBRATION] No predictions resolved with outcome yet. Skipping calibration pass.")
		return nil
	}

	modes := []string{"SniperMod", "Whale Mode", "DRL-driven"}
	models := []string{"ensemble", "member_0", "member_1", "member_2", "member_3", "member_4"}
	instruments := []string{"EUR/USD", "GBP/USD", "BTC/USD"}
	buckets := []BucketConfig{
		{Name: "50%-60%", Min: 0.50, Max: 0.60},
		{Name: "60%-70%", Min: 0.60, Max: 0.70},
		{Name: "70%-80%", Min: 0.70, Max: 0.80},
		{Name: "80%-90%", Min: 0.80, Max: 0.90},
		{Name: "90%-100%", Min: 0.90, Max: 1.00},
	}

	for _, mode := range modes {
		modelsToAnalyze := []string{"ensemble"}
		if mode == "DRL-driven" {
			modelsToAnalyze = models
		}

		for _, modelID := range modelsToAnalyze {
			for _, inst := range instruments {
				// Filter logs for specific mode, model & instrument
				var filtered []CalibrationItem
				for _, l := range logs {
					if l.Mode == mode && l.Instrument == inst && l.ModelID == modelID {
						filtered = append(filtered, l)
					}
				}

				var overallBrierSum float64 = 0.0
				var overallCount int = 0
				var overallWins int = 0

				for _, bucket := range buckets {
					var bucketLogs []CalibrationItem
					for _, l := range filtered {
						if l.ConfidenceScore >= bucket.Min && l.ConfidenceScore < bucket.Max {
							bucketLogs = append(bucketLogs, l)
						}
					}

					if len(bucketLogs) == 0 {
						continue
					}

					totalCount := len(bucketLogs)
					wins := 0
					var confSum float64 = 0.0
					var brierSum float64 = 0.0

					for _, l := range bucketLogs {
						if l.Outcome == "WIN" {
							wins++
						}
						confSum += l.ConfidenceScore
						
						outcomeVal := 0.0
						if l.Outcome == "WIN" {
							outcomeVal = 1.0
						}
						brierSum += math.Pow(l.ConfidenceScore-outcomeVal, 2)
					}

					actualWinRate := float64(wins) / float64(totalCount)
					expectedWinRate := confSum / float64(totalCount)
					brierScore := brierSum / float64(totalCount)

					overallBrierSum += brierSum
					overallCount += totalCount
					overallWins += wins

					// Determine Status
					status := "NORMAL"
					thresholdGap := 0.12 // 12% gap -> overconfidence flagged
					if expectedWinRate-actualWinRate > thresholdGap && totalCount >= 3 {
						status = "OVERCONFIDENT"
					} else if actualWinRate-expectedWinRate > 0.05 {
						status = "UNDERCONFIDENT"
					}

					// Insert calibration analysis record
					_, err = database.Pool.Exec(ctx,
						`INSERT INTO calibration_analysis (mode, instrument, bucket_range, predicted_count, actual_win_rate, expected_win_rate, brier_score, status, model_id)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
						mode, inst, bucket.Name, totalCount, actualWinRate, expectedWinRate, brierScore, status, modelID,
					)
					if err != nil {
						log.Printf("[CALIBRATION-ERROR] Failed to save calibration record: %v", err)
					}

					// Auto-parameter adjustment for Overconfident Ensemble
					if status == "OVERCONFIDENT" && modelID == "ensemble" {
						err := adjustStrategyThreshold(ctx, database, inst, mode, brierScore, actualWinRate, expectedWinRate, addServerLog)
						if err != nil {
							log.Printf("[CALIBRATION-ERROR] Failed to adjust strategy: %v", err)
						}
					}
				}

				// Update Model Registry
				if overallCount > 0 {
					overallBrier := overallBrierSum / float64(overallCount)
					rollingAccuracy := float64(overallWins) / float64(overallCount)

					_, err = database.Pool.Exec(ctx,
						`UPDATE model_registry
						 SET rolling_accuracy = $1, brier_score = $2, total_predictions = $3, updated_at = NOW()
						 WHERE id = $4`,
						rollingAccuracy, overallBrier, overallCount, modelID,
					)
					if err != nil {
						log.Printf("[CALIBRATION-ERROR] Failed to update model registry: %v", err)
					}
				}
			}
		}
	}

	// Run Ensemble Comparison Diagnostic
	err = runEnsembleDiagnostic(ctx, database, addServerLog)
	if err != nil {
		log.Printf("[CALIBRATION-WARN] Ensemble diagnostic check failed: %v", err)
	}

	return nil
}

func adjustStrategyThreshold(ctx context.Context, database *db.DB, symbol string, mode string, brier float64, actual float64, expected float64, addServerLog func(string, string, string)) error {
	var thresholdCol string
	if mode == "SniperMod" {
		thresholdCol = "sniper_confidence_threshold"
	} else if mode == "Whale Mode" {
		thresholdCol = "whale_confidence_threshold"
	} else {
		return nil
	}

	// Fetch old threshold
	var oldThreshold float64
	query := fmt.Sprintf("SELECT COALESCE(%s, 0.8) FROM instrument_strategies WHERE symbol = $1", thresholdCol)
	err := database.Pool.QueryRow(ctx, query, symbol).Scan(&oldThreshold)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil // strategy config not seeded yet
		}
		return err
	}

	newThreshold := math.Min(0.98, oldThreshold+0.05)
	if newThreshold != oldThreshold {
		updateQuery := fmt.Sprintf("UPDATE instrument_strategies SET %s = $1 WHERE symbol = $2", thresholdCol)
		_, err = database.Pool.Exec(ctx, updateQuery, newThreshold, symbol)
		if err != nil {
			return err
		}

		inputParams, _ := json.Marshal(map[string]interface{}{
			"oldThreshold": oldThreshold,
			"newThreshold": newThreshold,
			"brierScore":   brier,
			"actualRate":   actual,
			"expectedRate": expected,
		})
		outputResult, _ := json.Marshal(map[string]string{
			"status": "THRESHOLD_TIGHTENED",
		})

		// Log calibration adjustment starting with [CALIBRATION ADJUSTMENT]
		auditQuery := `INSERT INTO strategy_audit_logs (symbol, mode, trigger_value, action_taken, input_params, output_result) 
		               VALUES ($1, $2, $3, $4, $5, $6)`
		actionString := fmt.Sprintf("[CALIBRATION ADJUSTMENT] Tightened %s threshold for %s from %.2f to %.2f due to Brier miscalibration: %.3f.",
			mode, symbol, oldThreshold, newThreshold, brier)

		_, err = database.Pool.Exec(ctx, auditQuery, symbol, "Calibration", brier, actionString, string(inputParams), string(outputResult))
		if err != nil {
			return err
		}

		addServerLog("RISK-MANAGER", "WARNING", fmt.Sprintf("🔧 [Calibration Adjustment] Tightened %s threshold for %s to %.2f.", mode, symbol, newThreshold))
	}
	return nil
}

type RegistryItem struct {
	ID              string
	BrierScore      float64
	RollingAccuracy float64
}

func runEnsembleDiagnostic(ctx context.Context, database *db.DB, addServerLog func(string, string, string)) error {
	rows, err := database.Pool.Query(ctx, "SELECT id, COALESCE(brier_score, 0.25), COALESCE(rolling_accuracy, 0.5) FROM model_registry")
	if err != nil {
		return err
	}
	defer rows.Close()

	var registries []RegistryItem
	for rows.Next() {
		var r RegistryItem
		if err := rows.Scan(&r.ID, &r.BrierScore, &r.RollingAccuracy); err == nil {
			registries = append(registries, r)
		}
	}

	var ensemble *RegistryItem
	var members []RegistryItem
	for i := range registries {
		if registries[i].ID == "ensemble" {
			ensemble = &registries[i]
		} else if strings.HasPrefix(registries[i].ID, "member_") {
			members = append(members, registries[i])
		}
	}

	if ensemble != nil && len(members) > 0 {
		bestMember := members[0]
		for _, m := range members {
			if m.BrierScore < bestMember.BrierScore {
				bestMember = m
			}
		}

		if ensemble.BrierScore < bestMember.BrierScore {
			pct := ((bestMember.BrierScore - ensemble.BrierScore) / bestMember.BrierScore) * 100.0
			addServerLog("RISK-MANAGER", "SUCCESS", fmt.Sprintf("📊 [ENSEMBLE VERIFIED] Consensus Ensemble (Brier: %.3f, Acc: %.1f%%) OUTPERFORMS best individual member %s (Brier: %.3f, Acc: %.1f%%) by %.1f%% calibration error reduction! Ensembling is highly justified.",
				ensemble.BrierScore, ensemble.RollingAccuracy*100.0, bestMember.ID, bestMember.BrierScore, bestMember.RollingAccuracy*100.0, pct))
		} else {
			addServerLog("RISK-MANAGER", "WARNING", fmt.Sprintf("📊 [ENSEMBLE PERFORMANCE] Combined Ensemble (Brier: %.3f, Acc: %.1f%%) is NOT outperforming its best individual member %s (Brier: %.3f, Acc: %.1f%%). Self-recalibration required.",
				ensemble.BrierScore, ensemble.RollingAccuracy*100.0, bestMember.ID, bestMember.BrierScore, bestMember.RollingAccuracy*100.0))
		}
	}

	return nil
}
