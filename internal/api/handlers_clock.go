package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/proda-nexus/sovereign-trading/internal/db"
)

type ChronyTrackingData struct {
	OffsetMs         *float64 `json:"offsetMs"`
	RootDispersionMs *float64 `json:"rootDispersionMs"`
	Stratum          *int     `json:"stratum"`
	SyncStatus       string   `json:"syncStatus"`
	RawOutput        string   `json:"rawOutput"`
}

type ClockSyncHistory struct {
	ID                 int       `json:"id"`
	Timestamp          time.Time `json:"timestamp"`
	OffsetMs           *float64  `json:"offset_ms"`
	RootDispersionMs   *float64  `json:"root_dispersion_ms"`
	Stratum            *int      `json:"stratum"`
	SyncStatus         string    `json:"sync_status"`
	RawOutput          string    `json:"raw_output"`
}

var (
	clockMutex        sync.RWMutex
	lastClockOffsetMs float64
	lastChronyData    = ChronyTrackingData{
		SyncStatus: "chrony not available — clock offset unknown",
	}
)

// StartClockSyncScheduler runs the background Chrony tracking poller every 60 seconds
func StartClockSyncScheduler(ctx context.Context, pgDB *db.DB) {
	log.Println("[CHRONY-POLLER] Starting background clock sync poller...")

	// Initial check
	go func() {
		time.Sleep(3 * time.Second)
		PollAndRecordClockSync(ctx, pgDB)
	}()

	ticker := time.NewTicker(60 * time.Second)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				PollAndRecordClockSync(ctx, pgDB)
			case <-ctx.Done():
				return
			}
		}
	}()
}

func PollAndRecordClockSync(ctx context.Context, pgDB *db.DB) {
	data := CheckChronyTracking()

	_, err := pgDB.Pool.Exec(ctx, `
		INSERT INTO clock_sync_history (offset_ms, root_dispersion_ms, stratum, sync_status, raw_output)
		VALUES ($1, $2, $3, $4, $5)`,
		data.OffsetMs, data.RootDispersionMs, data.Stratum, data.SyncStatus, data.RawOutput,
	)
	if err != nil {
		log.Printf("[CHRONY-POLLER-ERROR] Failed to insert clock sync history: %v", err)
	}
}

func CheckChronyTracking() ChronyTrackingData {
	clockMutex.Lock()
	defer clockMutex.Unlock()

	cmd := exec.Command("chronyc", "tracking")
	outBytes, err := cmd.CombinedOutput()
	rawOutput := string(outBytes)

	if err != nil {
		// Try running fallbacks or reporting error gracefully
		lastClockOffsetMs = 0.0
		lastChronyData = ChronyTrackingData{
			SyncStatus: "chrony not available — clock offset unknown",
			RawOutput:  fmt.Sprintf("Failed to execute chronyc tracking: %v. Output: %s", err, rawOutput),
		}
		return lastChronyData
	}

	var offsetMs *float64
	var rootDispersionMs *float64
	var stratum *int
	syncStatus := "synced"

	// 1. Parse Stratum
	reStratum := regexp.MustCompile(`(?i)Stratum\s*:\s*(\d+)`)
	if match := reStratum.FindStringSubmatch(rawOutput); len(match) == 2 {
		val, _ := strconv.Atoi(match[1])
		stratum = &val
	}

	// 2. Parse Offset
	reLastOffset := regexp.MustCompile(`(?i)Last offset\s*:\s*([+-]?\d*(?:\.\d+)?)\s*seconds`)
	reSystemTime := regexp.MustCompile(`(?i)System time\s*:\s*([+-]?\d*(?:\.\d+)?)\s*seconds\s*(slow|fast)\s*of`)

	if match := reLastOffset.FindStringSubmatch(rawOutput); len(match) == 2 {
		val, _ := strconv.ParseFloat(match[1], 64)
		ms := val * 1000.0
		offsetMs = &ms
	} else if match := reSystemTime.FindStringSubmatch(rawOutput); len(match) == 3 {
		val, _ := strconv.ParseFloat(match[1], 64)
		dir := strings.ToLower(match[2])
		sign := 1.0
		if dir == "slow" {
			sign = -1.0
		}
		ms := val * sign * 1000.0
		offsetMs = &ms
	}

	// 3. Parse Root Dispersion
	reDispersion := regexp.MustCompile(`(?i)Root dispersion\s*:\s*([+-]?\d*(?:\.\d+)?)\s*seconds`)
	if match := reDispersion.FindStringSubmatch(rawOutput); len(match) == 2 {
		val, _ := strconv.ParseFloat(match[1], 64)
		ms := val * 1000.0
		rootDispersionMs = &ms
	}

	// 4. Parse Leap Status
	reLeap := regexp.MustCompile(`(?i)Leap status\s*:\s*([^\n\r]+)`)
	leapStatus := "Normal"
	if match := reLeap.FindStringSubmatch(rawOutput); len(match) == 2 {
		leapStatus = strings.TrimSpace(match[1])
	}

	if strings.Contains(strings.ToLower(leapStatus), "not synchronised") {
		syncStatus = "not synchronised"
	} else {
		stratumStr := "?"
		if stratum != nil {
			stratumStr = strconv.Itoa(*stratum)
		}
		syncStatus = fmt.Sprintf("synced (stratum %s, leap: %s)", stratumStr, leapStatus)
	}

	if offsetMs != nil {
		lastClockOffsetMs = *offsetMs
	} else {
		lastClockOffsetMs = 0.0
	}

	lastChronyData = ChronyTrackingData{
		OffsetMs:         offsetMs,
		RootDispersionMs: rootDispersionMs,
		Stratum:          stratum,
		SyncStatus:       syncStatus,
		RawOutput:        rawOutput,
	}

	return lastChronyData
}

func GetSyncedTime() time.Time {
	clockMutex.RLock()
	offset := lastClockOffsetMs
	clockMutex.RUnlock()

	return time.Now().Add(time.Duration(offset) * time.Millisecond)
}

// GetTimeSyncStatus handles GET /api/time-sync/status
func (h *Handler) GetTimeSyncStatus(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := h.DB.Pool.Query(ctx, "SELECT id, timestamp, offset_ms, root_dispersion_ms, stratum, sync_status, raw_output FROM clock_sync_history ORDER BY timestamp DESC LIMIT 100")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	var history []ClockSyncHistory
	for rows.Next() {
		var h ClockSyncHistory
		err := rows.Scan(&h.ID, &h.Timestamp, &h.OffsetMs, &h.RootDispersionMs, &h.Stratum, &h.SyncStatus, &h.RawOutput)
		if err == nil {
			history = append(history, h)
		}
	}

	clockMutex.RLock()
	current := lastChronyData
	clockMutex.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"current": current,
		"history": history,
	})
}
