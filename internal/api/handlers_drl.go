package api

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ModelRegistry represents a row in the model_registry table
type ModelRegistry struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Version         string                 `json:"version"`
	Type            string                 `json:"type"`
	Config          map[string]interface{} `json:"config"`
	RollingAccuracy float64                `json:"rolling_accuracy"`
	BrierScore      float64                `json:"brier_score"`
	TotalPredictions int                    `json:"total_predictions"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

// PredictionLog represents a prediction log row
type PredictionLog struct {
	ID                 string                 `json:"id"`
	Timestamp          time.Time              `json:"timestamp"`
	Instrument         string                 `json:"instrument"`
	PredictedDirection string                 `json:"predictedDirection"`
	ConfidenceScore    float64                `json:"confidenceScore"`
	Price              float64                `json:"price"`
	ModelID            string                 `json:"modelId"`
	AgreementScore     float64                `json:"agreementScore"`
	EnsembleDetails    map[string]interface{} `json:"ensembleDetails"`
}

// CalibrationAnalysis represents a calibration analysis row
type CalibrationAnalysis struct {
	ID              int       `json:"id"`
	Timestamp       time.Time `json:"timestamp"`
	Mode            string    `json:"mode"`
	Instrument      string    `json:"instrument"`
	BucketRange     string    `json:"bucketRange"`
	PredictedCount  int       `json:"predictedCount"`
	ActualWinRate   float64   `json:"actualWinRate"`
	ExpectedWinRate float64   `json:"expectedWinRate"`
	BrierScore      float64   `json:"brierScore"`
	Status          string    `json:"status"`
	ModelID         *string   `json:"modelId"`
}

// GetDrlEnsemble handles GET /api/drl/ensemble
func (h *Handler) GetDrlEnsemble(c *gin.Context) {
	ctx := c.Request.Context()

	// 1. Fetch registry
	regRows, err := h.DB.Pool.Query(ctx, "SELECT id, name, version, type, config, rolling_accuracy, brier_score, total_predictions, updated_at FROM model_registry ORDER BY id")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer regRows.Close()

	var registry []ModelRegistry
	for regRows.Next() {
		var r ModelRegistry
		var configBytes []byte
		err := regRows.Scan(&r.ID, &r.Name, &r.Version, &r.Type, &configBytes, &r.RollingAccuracy, &r.BrierScore, &r.TotalPredictions, &r.UpdatedAt)
		if err == nil {
			_ = json.Unmarshal(configBytes, &r.Config)
			registry = append(registry, r)
		}
	}

	// 2. Fetch predictions
	predRows, err := h.DB.Pool.Query(ctx, `
		SELECT id, timestamp, instrument, predicted_direction, confidence_score, price, model_id, agreement_score, ensemble_details 
		FROM prediction_log 
		WHERE mode = 'DRL-driven' 
		ORDER BY timestamp DESC 
		LIMIT 50`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer predRows.Close()

	var predictions []PredictionLog
	for predRows.Next() {
		var p PredictionLog
		var ensembleBytes []byte
		err := predRows.Scan(&p.ID, &p.Timestamp, &p.Instrument, &p.PredictedDirection, &p.ConfidenceScore, &p.Price, &p.ModelID, &p.AgreementScore, &ensembleBytes)
		if err == nil {
			_ = json.Unmarshal(ensembleBytes, &p.EnsembleDetails)
			predictions = append(predictions, p)
		}
	}

	// 3. Fetch calibration analysis
	calRows, err := h.DB.Pool.Query(ctx, `
		SELECT id, timestamp, mode, instrument, bucket_range, predicted_count, actual_win_rate, expected_win_rate, brier_score, status, model_id 
		FROM calibration_analysis 
		ORDER BY timestamp DESC 
		LIMIT 150`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer calRows.Close()

	var calibration []CalibrationAnalysis
	for calRows.Next() {
		var ca CalibrationAnalysis
		err := calRows.Scan(&ca.ID, &ca.Timestamp, &ca.Mode, &ca.Instrument, &ca.BucketRange, &ca.PredictedCount, &ca.ActualWinRate, &ca.ExpectedWinRate, &ca.BrierScore, &ca.Status, &ca.ModelID)
		if err == nil {
			calibration = append(calibration, ca)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"registry":    registry,
		"predictions": predictions,
		"calibration": calibration,
	})
}

// GetDrlTelemetry handles GET /api/drl/telemetry (proxies to local python service)
func (h *Handler) GetDrlTelemetry(c *gin.Context) {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8001/api/drl/telemetry")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Python DRL service not active yet",
		})
		return
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	var data map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Invalid JSON response from python service"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "telemetry": data})
}
