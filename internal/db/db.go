package db

import (
	"context"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(ctx context.Context, databaseURL string) (*DB, error) {
	log.Printf("[DATABASE] Connecting to PostgreSQL at %s ...", maskURL(databaseURL))
	
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// Set connection pool limits and timeouts matching server.ts
	config.MaxConns = 20
	config.MaxConnIdleTime = 30 * time.Second
	config.ConnConfig.ConnectTimeout = 15 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	// Test the connection pool
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	log.Println("[DATABASE] Connection established successfully")
	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
		log.Println("[DATABASE] Connection pool closed")
	}
}

// Initialize executes migrations/001_init.sql and runs dynamic schema enhancements on startup
func (db *DB) Initialize(ctx context.Context) error {
	log.Println("[DATABASE] Running initial database migrations...")

	// 1. Load migrations/001_init.sql
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	migrationPath := filepath.Join(cwd, "migrations", "001_init.sql")
	if _, err := os.Stat(migrationPath); err == nil {
		log.Printf("[DATABASE] Found migration script at %s. Executing...", migrationPath)
		sqlBytes, err := ioutil.ReadFile(migrationPath)
		if err != nil {
			return err
		}

		_, err = db.Pool.Exec(ctx, string(sqlBytes))
		if err != nil {
			log.Printf("[DATABASE] Migration failed: %v", err)
			return err
		}
		log.Println("[DATABASE] 001_init.sql migrations executed successfully.")
	} else {
		log.Printf("[DATABASE] Migration script migrations/001_init.sql not found at %s!", migrationPath)
	}

	// 2. Perform dynamic schema enhancements (equivalent to ALTER checks in server.ts)
	log.Println("[DATABASE] Checking and running dynamic schema ALTER queries...")
	
	alterQueries := []string{
		"ALTER TABLE broker_connections ADD COLUMN IF NOT EXISTS environment VARCHAR DEFAULT 'DEMO_LIVE'",
		"ALTER TABLE historical_ticks ADD COLUMN IF NOT EXISTS instrument VARCHAR(20) DEFAULT 'EUR/USD'",
		"ALTER TABLE news_config ADD COLUMN IF NOT EXISTS trading_economics_key_enc TEXT",
		"ALTER TABLE news_config ADD COLUMN IF NOT EXISTS alpha_vantage_key_enc TEXT",
		"ALTER TABLE news_config ADD COLUMN IF NOT EXISTS market_aux_key_enc TEXT",
		"ALTER TABLE news_config ADD COLUMN IF NOT EXISTS fred_key_enc TEXT",
		"ALTER TABLE prediction_log ADD COLUMN IF NOT EXISTS model_id VARCHAR(50) DEFAULT 'ensemble'",
		"ALTER TABLE prediction_log ADD COLUMN IF NOT EXISTS agreement_score NUMERIC DEFAULT 1.0",
		"ALTER TABLE prediction_log ADD COLUMN IF NOT EXISTS ensemble_details JSONB",
		"ALTER TABLE calibration_analysis ADD COLUMN IF NOT EXISTS model_id VARCHAR(50) DEFAULT 'ensemble'",
	}

	for _, query := range alterQueries {
		if _, err := db.Pool.Exec(ctx, query); err != nil {
			log.Printf("[DATABASE-WARNING] Failed to execute query (%s): %v", query, err)
		}
	}

	// 3. Create Custom Connectors Table if not exists
	customConnectorsSQL := `
		CREATE TABLE IF NOT EXISTS custom_connectors (
			id VARCHAR PRIMARY KEY,
			name VARCHAR NOT NULL,
			type VARCHAR NOT NULL,
			base_url TEXT NOT NULL,
			auth_scheme VARCHAR NOT NULL,
			auth_config JSONB NOT NULL DEFAULT '{}'::JSONB,
			endpoints JSONB NOT NULL DEFAULT '{}'::JSONB,
			status VARCHAR NOT NULL DEFAULT 'DISCONNECTED',
			last_tested_time TIMESTAMPTZ,
			error_message TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			CONSTRAINT uq_custom_connector_name UNIQUE (name)
		)
	`
	if _, err := db.Pool.Exec(ctx, customConnectorsSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_custom_connectors_type ON custom_connectors(type)")

	// 4. Create Runtime State table
	runtimeStateSQL := `
		CREATE TABLE IF NOT EXISTS runtime_state (
			key VARCHAR PRIMARY KEY,
			value JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`
	if _, err := db.Pool.Exec(ctx, runtimeStateSQL); err != nil {
		return err
	}

	// 5. Create Deployment History
	deploymentHistorySQL := `
		CREATE TABLE IF NOT EXISTS deployment_history (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			old_version VARCHAR(100),
			new_version VARCHAR(100),
			handover_clean BOOLEAN NOT NULL,
			details TEXT
		)
	`
	if _, err := db.Pool.Exec(ctx, deploymentHistorySQL); err != nil {
		return err
	}

	// 6. Create Deep Research sessions
	deepResearchSQL := `
		CREATE TABLE IF NOT EXISTS deep_research_sessions (
			id VARCHAR PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			topic VARCHAR NOT NULL,
			persona VARCHAR NOT NULL,
			rounds JSONB NOT NULL DEFAULT '[]'::JSONB,
			final_summary TEXT NOT NULL,
			sources JSONB NOT NULL DEFAULT '[]'::JSONB
		)
	`
	if _, err := db.Pool.Exec(ctx, deepResearchSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_deep_research_sessions_time ON deep_research_sessions(timestamp DESC)")

	// 7. Create Gemini Availability Log
	geminiAvailabilityLogSQL := `
		CREATE TABLE IF NOT EXISTS gemini_availability_log (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			status VARCHAR(30) NOT NULL,
			details TEXT
		)
	`
	if _, err := db.Pool.Exec(ctx, geminiAvailabilityLogSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_gemini_availability_log_time ON gemini_availability_log(timestamp DESC)")

	// 8. Create Self Hosted Tool Logs
	selfHostedToolSQL := `
		CREATE TABLE IF NOT EXISTS self_hosted_tool_logs (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			session_id VARCHAR(100),
			tool_name VARCHAR(100) NOT NULL,
			arguments JSONB NOT NULL,
			return_value TEXT
		)
	`
	if _, err := db.Pool.Exec(ctx, selfHostedToolSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_self_hosted_tool_logs_time ON self_hosted_tool_logs(timestamp DESC)")

	// 9. Create Dark Pool Weekly
	darkPoolSQL := `
		CREATE TABLE IF NOT EXISTS dark_pool_volume_weekly (
			id SERIAL PRIMARY KEY,
			reporting_date TIMESTAMPTZ NOT NULL,
			symbol VARCHAR(20) NOT NULL,
			weekly_volume BIGINT NOT NULL,
			source VARCHAR(50) NOT NULL DEFAULT 'FINRA',
			lag_days INT NOT NULL DEFAULT 14,
			is_paid_vendor BOOLEAN DEFAULT FALSE,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`
	if _, err := db.Pool.Exec(ctx, darkPoolSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_dark_pool_volume_time ON dark_pool_volume_weekly(reporting_date DESC)")

	// 10. Create Dark Pool Config
	darkPoolConfigSQL := `
		CREATE TABLE IF NOT EXISTS dark_pool_config (
			id INT PRIMARY KEY DEFAULT 1,
			paid_vendor_key_enc TEXT,
			paid_vendor_connected BOOLEAN DEFAULT FALSE,
			CONSTRAINT single_row_dark_pool CHECK (id = 1)
		)
	`
	if _, err := db.Pool.Exec(ctx, darkPoolConfigSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "INSERT INTO dark_pool_config (id, paid_vendor_key_enc, paid_vendor_connected) VALUES (1, '', false) ON CONFLICT (id) DO NOTHING")

	// 11. Create Clock Sync History
	clockSyncSQL := `
		CREATE TABLE IF NOT EXISTS clock_sync_history (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			offset_ms NUMERIC,
			root_dispersion_ms NUMERIC,
			stratum INT,
			sync_status VARCHAR(100) NOT NULL,
			raw_output TEXT
		)
	`
	if _, err := db.Pool.Exec(ctx, clockSyncSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_clock_sync_history_time ON clock_sync_history(timestamp DESC)")

	// 12. Create Prediction Log
	predictionLogSQL := `
		CREATE TABLE IF NOT EXISTS prediction_log (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			instrument VARCHAR(20) NOT NULL,
			mode VARCHAR(50) NOT NULL,
			predicted_direction VARCHAR(10) NOT NULL,
			confidence_score NUMERIC NOT NULL,
			price NUMERIC NOT NULL,
			volatility NUMERIC NOT NULL,
			whale_signal NUMERIC,
			news_sentiment NUMERIC,
			outcome VARCHAR(10),
			pnl_pips NUMERIC,
			position_id VARCHAR(100)
		)
	`
	if _, err := db.Pool.Exec(ctx, predictionLogSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_prediction_log_time ON prediction_log(timestamp DESC)")

	// 13. Create Calibration Analysis
	calibrationAnalysisSQL := `
		CREATE TABLE IF NOT EXISTS calibration_analysis (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			mode VARCHAR(50) NOT NULL,
			instrument VARCHAR(20) NOT NULL,
			bucket_range VARCHAR(20) NOT NULL,
			predicted_count INT NOT NULL,
			actual_win_rate NUMERIC,
			expected_win_rate NUMERIC,
			brier_score NUMERIC,
			status VARCHAR(20) NOT NULL
		)
	`
	if _, err := db.Pool.Exec(ctx, calibrationAnalysisSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_calibration_analysis_time ON calibration_analysis(timestamp DESC)")

	// 14. Create Model Registry Table
	modelRegistrySQL := `
		CREATE TABLE IF NOT EXISTS model_registry (
			id VARCHAR(50) PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			version VARCHAR(20) NOT NULL,
			type VARCHAR(50) NOT NULL,
			config JSONB,
			rolling_accuracy NUMERIC DEFAULT 0.5,
			brier_score NUMERIC DEFAULT 0.25,
			total_predictions INT DEFAULT 0,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)
	`
	if _, err := db.Pool.Exec(ctx, modelRegistrySQL); err != nil {
		return err
	}

	// 15. Create Portfolio Risk History
	portfolioRiskHistorySQL := `
		CREATE TABLE IF NOT EXISTS portfolio_risk_history (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			var_95_hist NUMERIC NOT NULL,
			var_99_hist NUMERIC NOT NULL,
			var_95_param NUMERIC NOT NULL,
			var_99_param NUMERIC NOT NULL,
			total_exposure NUMERIC NOT NULL,
			portfolio_drawdown NUMERIC NOT NULL
		)
	`
	if _, err := db.Pool.Exec(ctx, portfolioRiskHistorySQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_portfolio_risk_time ON portfolio_risk_history(timestamp DESC)")

	// 16. Create Walk Forward Results
	walkForwardSQL := `
		CREATE TABLE IF NOT EXISTS walk_forward_results (
			id SERIAL PRIMARY KEY,
			candidate_id VARCHAR(100) NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			windows_total INT NOT NULL,
			windows_passed INT NOT NULL,
			consistency_score NUMERIC NOT NULL,
			details JSONB NOT NULL
		)
	`
	if _, err := db.Pool.Exec(ctx, walkForwardSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_walk_forward_candidate ON walk_forward_results(candidate_id)")

	// 17. Create Historical Ticks V2
	historicalTicksV2SQL := `
		CREATE TABLE IF NOT EXISTS historical_ticks_v2 (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL,
			instrument VARCHAR(20) NOT NULL,
			price NUMERIC NOT NULL,
			bid NUMERIC NOT NULL,
			ask NUMERIC NOT NULL,
			spread NUMERIC NOT NULL,
			volatility NUMERIC NOT NULL,
			volume BIGINT NOT NULL
		)
	`
	if _, err := db.Pool.Exec(ctx, historicalTicksV2SQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_historical_ticks_v2_instrument_time ON historical_ticks_v2 (instrument, timestamp DESC)")

	// 18. Create Demo-Live runs and related tables
	demoLiveRunsSQL := `
		CREATE TABLE IF NOT EXISTS demo_live_runs (
			id SERIAL PRIMARY KEY,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			planned_end_at TIMESTAMPTZ NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
			initial_balance NUMERIC NOT NULL,
			peak_equity NUMERIC NOT NULL,
			max_drawdown NUMERIC NOT NULL DEFAULT 0
		)
	`
	if _, err := db.Pool.Exec(ctx, demoLiveRunsSQL); err != nil {
		return err
	}

	demoLiveEquitySQL := `
		CREATE TABLE IF NOT EXISTS demo_live_equity_history (
			id SERIAL PRIMARY KEY,
			run_id INT NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			balance NUMERIC NOT NULL,
			equity NUMERIC NOT NULL,
			used_margin NUMERIC NOT NULL,
			free_margin NUMERIC NOT NULL,
			open_position_count INT NOT NULL DEFAULT 0,
			daily_pnl NUMERIC NOT NULL DEFAULT 0
		)
	`
	if _, err := db.Pool.Exec(ctx, demoLiveEquitySQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_demo_live_equity_run_time ON demo_live_equity_history(run_id, timestamp DESC)")

	demoLiveRollupsSQL := `
		CREATE TABLE IF NOT EXISTS demo_live_daily_rollups (
			id SERIAL PRIMARY KEY,
			run_id INT NOT NULL,
			date DATE NOT NULL,
			starting_balance NUMERIC NOT NULL,
			ending_balance NUMERIC NOT NULL,
			total_pnl NUMERIC NOT NULL,
			trade_count INT NOT NULL DEFAULT 0,
			win_rate NUMERIC NOT NULL DEFAULT 0,
			max_drawdown NUMERIC NOT NULL DEFAULT 0,
			CONSTRAINT uq_demo_live_rollup_run_date UNIQUE (run_id, date)
		)
	`
	if _, err := db.Pool.Exec(ctx, demoLiveRollupsSQL); err != nil {
		return err
	}

	demoLiveAlertsSQL := `
		CREATE TABLE IF NOT EXISTS demo_live_alerts (
			id SERIAL PRIMARY KEY,
			run_id INT NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			type VARCHAR(50) NOT NULL,
			message TEXT NOT NULL,
			severity VARCHAR(20) NOT NULL DEFAULT 'INFO'
		)
	`
	if _, err := db.Pool.Exec(ctx, demoLiveAlertsSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_demo_live_alerts_run_time ON demo_live_alerts(run_id, timestamp DESC)")

	// 19. Seed security config and other required static setups
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO security_config (id, api_mutate_key, allowed_ips) 
		VALUES (1, 'SOV-MUTATE-DEFAULT-KEY', ARRAY['127.0.0.1', '::1', '::ffff:127.0.0.1']) 
		ON CONFLICT (id) DO NOTHING
	`)

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO news_config (id, news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc) 
		VALUES (1, '', '', '', '', '', '') 
		ON CONFLICT (id) DO NOTHING
	`)

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO arbitrage_compliance (id, tos_permitted, regulations_permitted) 
		VALUES (1, false, false) 
		ON CONFLICT (id) DO NOTHING
	`)

	// 20. Seed model registry with ensemble members if empty
	var mrCount int
	err = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM model_registry").Scan(&mrCount)
	if err == nil && mrCount == 0 {
		log.Println("[DATABASE] Seeding model_registry table with ensemble configs...")
		models := []struct {
			ID      string
			Name    string
			Version string
			Type    string
			Config  string
		}{
			{"ensemble", "Apex Ensemble (Consensus)", "3.0.0", "Ensemble", `{"members_count": 5}`},
			{"member_0", "Apex Prime (Baseline)", "3.0.0", "NumPy/PyTorch", `{"seed": 42, "hidden_dim": 64, "lr": 0.002, "clip_eps": 0.20, "data_slice": "all"}`},
			{"member_1", "Apex Micro (Fast-LR)", "3.0.0", "NumPy/PyTorch", `{"seed": 101, "hidden_dim": 32, "lr": 0.001, "clip_eps": 0.15, "data_slice": "first_80"}`},
			{"member_2", "Apex Macro (Deep-Cap)", "3.0.0", "NumPy/PyTorch", `{"seed": 2026, "hidden_dim": 128, "lr": 0.003, "clip_eps": 0.25, "data_slice": "last_80"}`},
			{"member_3", "Apex Flex (Mid-Window)", "3.0.0", "NumPy/PyTorch", `{"seed": 777, "hidden_dim": 96, "lr": 0.0015, "clip_eps": 0.18, "data_slice": "mid_80"}`},
			{"member_4", "Apex Alt (Strided)", "3.0.0", "NumPy/PyTorch", `{"seed": 999, "hidden_dim": 48, "lr": 0.0025, "clip_eps": 0.22, "data_slice": "alternating"}`},
		}
		for _, m := range models {
			_, err = db.Pool.Exec(ctx, `
				INSERT INTO model_registry (id, name, version, type, config) 
				VALUES ($1, $2, $3, $4, $5::jsonb) 
				ON CONFLICT (id) DO NOTHING`,
				m.ID, m.Name, m.Version, m.Type, m.Config,
			)
			if err != nil {
				log.Printf("[DATABASE-WARNING] Failed to seed model %s: %v", m.ID, err)
			}
		}
	}

	log.Println("[DATABASE] Initial database schema and migration checks complete.")
	return nil
}

func maskURL(url string) string {
	// Simple masking of passwords in connection string
	// e.g. postgresql://user:pass@host:port/db -> postgresql://user:****@host:port/db
	// Find index of @ and :
	// We can just keep it safe and return a masked string
	return "postgresql://***:***@host:port/dbname"
}
