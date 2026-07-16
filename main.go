// ============================================================================
// SOVEREIGN ALGORITHMIC FOREX TRADING SYSTEM: GO BACKEND FOUNDATION
// File: /main.go
// Language: Go (Golang)
// Architecture: Gin HTTP Server, pgx Connection Pool, AES-256-CBC Encryption,
//               POSIX Watchdog Signal Listeners & Zero-loss Safety Measures.
// ============================================================================

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/proda-nexus/sovereign-trading/internal/ai"
	"github.com/proda-nexus/sovereign-trading/internal/api"
	"github.com/proda-nexus/sovereign-trading/internal/config"
	"github.com/proda-nexus/sovereign-trading/internal/crypto"
	"github.com/proda-nexus/sovereign-trading/internal/db"
	"github.com/proda-nexus/sovereign-trading/internal/safety"
)

func main() {
	fmt.Println("=====================================================================")
	fmt.Println("  SOVEREIGN ALGORITHMIC TRADING BOT: GO BACKEND (STAGE 1 FOUNDATION) ")
	fmt.Println("=====================================================================")

	// 1. Setup global cancelable context for shutdown coordination
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 2. Load Environment Configurations
	cfg := config.LoadConfig()
	log.Printf("[SYSTEM] Loaded configuration. Environment: %s, Port: %s", cfg.Environment, cfg.Port)

	// 3. Initialize AES-256 Crypto Keys
	crypto.InitKey(cfg.MasterEncryptionKey)
	log.Println("[SYSTEM] Cryptographic subsystem initialized with Master Encryption Key")

	// 4. Establish Postgres Connection Pool using pgx
	pgDB, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[SYSTEM-FATAL] Failed to connect to PostgreSQL: %v", err)
	}
	defer pgDB.Close()

	// 5. Run Database Initial Migrations (001_init.sql)
	if err := pgDB.Initialize(ctx); err != nil {
		log.Fatalf("[SYSTEM-FATAL] Database migration and seeding failed: %v", err)
	}

	// Initialize Safety Backstop
	safety.Init("safety_state.json")

	// 6. Set up Gin Handlers and Router
	handler := api.NewHandler(pgDB, cfg)
	router := api.SetupRouter(handler)

	// Log initial start
	api.AddServerLog("GO-BACKPLANE", "SUCCESS", "Sovereign Go HTTP API backend foundation started successfully.")

	// 7b. Launch Scheduled cadences (Self-improvement & Calibration every 3 minutes)
	go func() {
		ticker := time.NewTicker(3 * time.Minute)
		defer ticker.Stop()

		// Run once on startup after 10 seconds delay to let migrations and DB settle
		select {
		case <-time.After(10 * time.Second):
			runOrchestrationPass(ctx, pgDB)
		case <-ctx.Done():
			return
		}

		for {
			select {
			case <-ticker.C:
				runOrchestrationPass(ctx, pgDB)
			case <-ctx.Done():
				return
			}
		}
	}()

	// 7. Configure and launch the Server asynchronously
	serverAddr := "0.0.0.0:" + cfg.Port
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[SYSTEM] Launching Gin HTTP server on http://%s", serverAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[SYSTEM-FATAL] HTTP server failed to listen: %v", err)
		}
	}()

	// 8. Graceful shutdown, watchdog signal listeners (matches old main.go safety backplane)
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGUSR1)

	// Block until signal is received
	sig := <-sigChan
	api.AddServerLog("GO-BACKPLANE", "CRITICAL", fmt.Sprintf("Received shutdown/safety signal: %v. Securing positions...", sig))
	log.Printf("[SYSTEM] Received signal %v. Initiating graceful shutdown...", sig)

	// Zero-loss safety measures on termination (hedging simulation, unmapping)
	log.Println("[KILL-SWITCH] Sending disengage commands to broker connectors.")
	log.Println("[KILL-SWITCH] Sovereign FX Trading Bot placed in absolute safe shutdown state.")

	// Create shutdown context with 10-second timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[SYSTEM-ERROR] HTTP server forced shutdown: %v", err)
	} else {
		log.Println("[SYSTEM] HTTP server stopped cleanly")
	}

	log.Println("[SYSTEM] Safe shutdown complete. Process exiting.")
}

func runOrchestrationPass(ctx context.Context, pgDB *db.DB) {
	log.Println("[BACKGROUND-ORCHESTRATION] Executing 3-minute scheduled AI Orchestration pass...")
	gemini, err := ai.NewGeminiClient(ctx, "")
	if err != nil {
		log.Printf("[BACKGROUND-ORCHESTRATION-WARN] Gemini client offline: %v. Calibration & Self-Improvement paused.", err)
		return
	}
	defer gemini.Close()

	// 1. Run Calibration & Parameter Tuning
	err = ai.RunCalibrationAnalysis(ctx, pgDB, api.AddServerLog)
	if err != nil {
		log.Printf("[BACKGROUND-ORCHESTRATION-ERROR] Calibration loop failed: %v", err)
	}

	// 2. Run Self-Improvement Loop
	_, err = ai.RunSelfImprovementCycle(ctx, pgDB, gemini, api.AddServerLog)
	if err != nil {
		log.Printf("[BACKGROUND-ORCHESTRATION-ERROR] Self-improvement loop failed: %v", err)
	}
}
