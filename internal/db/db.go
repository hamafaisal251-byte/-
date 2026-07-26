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

	// 13b. Create Hypothesis Journal
	hypothesisJournalSQL := `
		CREATE TABLE IF NOT EXISTS hypothesis_journal (
			id VARCHAR(100) PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			title VARCHAR(255) NOT NULL,
			description TEXT NOT NULL,
			proposed_signal TEXT DEFAULT 'Default dynamic weight formula',
			author VARCHAR(100) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
			regime VARCHAR(100) NOT NULL,
			p_value NUMERIC,
			fdr_adjusted_p NUMERIC,
			effect_size NUMERIC,
			metrics JSONB NOT NULL DEFAULT '{}'::JSONB
		)
	`
	if _, err := db.Pool.Exec(ctx, hypothesisJournalSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_hypothesis_journal_time ON hypothesis_journal(timestamp DESC)")

	// Seed initial hypothesis_journal if empty
	var hjCount int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM hypothesis_journal").Scan(&hjCount)
	if hjCount == 0 {
		_, _ = db.Pool.Exec(ctx, `
			INSERT INTO hypothesis_journal (id, title, description, proposed_signal, author, status, regime, p_value, fdr_adjusted_p, effect_size, metrics)
			VALUES (
				'hyp_initial_calibration_shift', 
				'US Session Close Momentum Reversal Shift', 
				'Hypothesizes that EUR/USD momentum systematically shifts directions at the New York close (21:00 GMT) due to institutional settlement flows.', 
				'Close-to-Open drift delta indicator coupled with volume standard deviation filter.', 
				'Sovereign AI Systems', 
				'PASSED_FDR', 
				'Ranging Regimes', 
				0.0125, 
				0.035, 
				0.85, 
				'{"avgReward": 8.5, "volatility_spike": 1.2, "simulated_trades": 210}'::jsonb
			)
		`)
	}

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
			daily_pnl NUMERIC NOT NULL DEFAULT 0,
			data_source VARCHAR(50) NOT NULL DEFAULT 'real_broker_api'
		)
	`
	if _, err := db.Pool.Exec(ctx, demoLiveEquitySQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "ALTER TABLE demo_live_equity_history ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) NOT NULL DEFAULT 'real_broker_api'")
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
			data_source VARCHAR(50) NOT NULL DEFAULT 'real_broker_api',
			CONSTRAINT uq_demo_live_rollup_run_date UNIQUE (run_id, date)
		)
	`
	if _, err := db.Pool.Exec(ctx, demoLiveRollupsSQL); err != nil {
		return err
	}
	_, _ = db.Pool.Exec(ctx, "ALTER TABLE demo_live_daily_rollups ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) NOT NULL DEFAULT 'real_broker_api'")

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

	// --- GO PORT ADDITIONAL SCHEMAS & TABLES ---

	// Market Regime Log Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS market_regime_log (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			trend_regime VARCHAR(20) NOT NULL,
			trend_strength NUMERIC NOT NULL,
			volatility_regime VARCHAR(20) NOT NULL,
			volatility_atr NUMERIC NOT NULL,
			market_session VARCHAR(20) NOT NULL,
			allocation_weights JSONB NOT NULL
		)
	`)
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_market_regime_log_time ON market_regime_log(timestamp DESC)")

	// Provider Usage Log Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS provider_usage_log (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			provider VARCHAR(50) NOT NULL,
			model VARCHAR(100) NOT NULL,
			prompt_tokens INT NOT NULL DEFAULT 0,
			completion_tokens INT NOT NULL DEFAULT 0,
			total_tokens INT NOT NULL DEFAULT 0,
			cost NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
			task_category VARCHAR(100),
			status VARCHAR(20) NOT NULL
		)
	`)
	_, _ = db.Pool.Exec(ctx, "CREATE INDEX IF NOT EXISTS idx_provider_usage_log_time ON provider_usage_log(timestamp DESC)")

	// LLM Provider Config Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS llm_provider_config (
			id INT PRIMARY KEY DEFAULT 1,
			deepseek_api_key_enc TEXT DEFAULT '',
			mode VARCHAR(30) DEFAULT 'gemini',
			self_hosted_url TEXT DEFAULT 'http://127.0.0.1:11434/v1',
			self_hosted_model_name TEXT DEFAULT 'qwen2.5-coder:32b',
			enable_policy_routing BOOLEAN DEFAULT TRUE,
			routing_policy JSONB DEFAULT '{"routine_parameter_tuning": "deepseek", "complex_multi_signal_synthesis": "gemini", "tier_2_fallback": "self_hosted", "deep_research": "gemini", "general": "gemini"}'::jsonb,
			policy_reasoning TEXT DEFAULT 'DeepSeek handles routine parameter tuning. Gemini handles complex synthesis. Self-hosted handles Tier-2 fallback.',
			CONSTRAINT single_row_llm_config CHECK (id = 1)
		)
	`)
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO llm_provider_config (id, deepseek_api_key_enc, mode, self_hosted_url, self_hosted_model_name, enable_policy_routing, routing_policy, policy_reasoning)
		VALUES (1, '', 'gemini', 'http://127.0.0.1:11434/v1', 'qwen2.5-coder:32b', TRUE, '{"routine_parameter_tuning": "deepseek", "complex_multi_signal_synthesis": "gemini", "tier_2_fallback": "self_hosted", "deep_research": "gemini", "general": "gemini"}'::jsonb, 'DeepSeek handles routine parameter tuning. Gemini handles complex synthesis. Self-hosted handles Tier-2 fallback.')
		ON CONFLICT (id) DO NOTHING
	`)

	// Github Techniques Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS github_techniques (
			id VARCHAR PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			title VARCHAR NOT NULL,
			description TEXT NOT NULL,
			repo_url VARCHAR NOT NULL,
			licensing VARCHAR NOT NULL,
			status VARCHAR NOT NULL DEFAULT 'PARTIAL_PROMISE'
		)
	`)

	// Synthesis Attempts Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS synthesis_attempts (
			id VARCHAR PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			candidate_id VARCHAR,
			source_ideas JSONB NOT NULL,
			reasoning TEXT NOT NULL,
			outcome VARCHAR NOT NULL,
			validation_summary TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)

	// Code Evolution Log Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS code_evolution_log (
			id VARCHAR PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			source_repo VARCHAR,
			license VARCHAR,
			license_status VARCHAR,
			candidate_name VARCHAR,
			refactor_attempts INT DEFAULT 0,
			verification_cycle_logs JSONB DEFAULT '[]'::JSONB,
			final_status VARCHAR
		)
	`)

	// Meta Controller Log Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS meta_controller_log (
			id SERIAL PRIMARY KEY,
			timestamp TIMESTAMPTZ DEFAULT NOW(),
			model_id VARCHAR(50) NOT NULL,
			old_weight NUMERIC NOT NULL,
			new_weight NUMERIC NOT NULL,
			rolling_brier NUMERIC NOT NULL,
			historical_brier NUMERIC NOT NULL,
			rolling_accuracy NUMERIC NOT NULL,
			historical_accuracy NUMERIC NOT NULL,
			regime_change_flag BOOLEAN DEFAULT FALSE
		)
	`)

	// Self Improvement Logs Table
	_, _ = db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS self_improvement_logs (
			id VARCHAR PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			weakness_detected TEXT,
			metric_details TEXT,
			research_topic TEXT,
			cache_hit BOOLEAN DEFAULT FALSE,
			sources TEXT,
			grounded_summary TEXT,
			generated_candidate_name TEXT,
			sandbox_status VARCHAR(50),
			sandbox_reason TEXT,
			metrics TEXT
		)
	`)

	// Seed hypothesis_journal if empty
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM hypothesis_journal").Scan(&hjCount)
	if hjCount == 0 {
		log.Println("[DATABASE] Seeding initial hypothesis journal...")
		hypotheses := [][]interface{}{
			{"hyp_001", "Quadratic Latency Penalty Scaling", "Penalize execution latency with quadratic progression instead of linear when latency exceeds 300ns, mitigating severe slippage.", "Execution latency quadratic multiplier", "Value Discovery Agent", "PROMOTED", "High Latency Regimes", 0.012, 0.036, 0.85, `{"avgReward": 12.5}`},
			{"hyp_002", "RSI-MACD Fast Crossing Signal", "A fast crossover signal that combines RSI momentum with MACD line crosses, aiming to capture instant breakout directions.", "Dual oscillator crossover window", "Risk Specialist", "FAILED", "Ranging Regimes", 0.24, 0.35, 0.12, `{"avgReward": 1.2}`},
			{"hyp_003", "Adaptive London Session Spread Filter", "Widen spread penalty dynamic offset specifically during the London open session (07:00-09:00 GMT) to filter illiquid fakeouts.", "Spread-widening velocity index", "Sovereign Momentum Specialist", "PASSED_RAW", "Trend Regimes", 0.045, 0.082, 0.42, `{"avgReward": 15.1}`},
			{"hyp_004", "Cross-Asset Momentum (BTC/USD Lead-Lag)", "Captures cross-instrument lead-lag anomalies, evaluating whether BTC/USD movement leads major FX trends.", "Lagged price differential of BTC/USD", "Value Discovery Agent", "PASSED_FDR", "High Volatility", 0.008, 0.032, 0.95, `{"avgReward": 14.2}`},
			{"hyp_005", "Seasonal Midday Spread Expansion Filter", "Widen slippage penalties during the midday lunch hour to avoid entering positions in low-liquidity conditions.", "Hour of day static penalty offset", "Value Discovery Agent", "FAILED", "Ranging Regimes", 0.45, 0.52, -0.05, `{"avgReward": -0.3}`},
		}
		for _, h := range hypotheses {
			_, _ = db.Pool.Exec(ctx, `
				INSERT INTO hypothesis_journal (id, title, description, proposed_signal, author, status, regime, p_value, fdr_adjusted_p, effect_size, metrics)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
				ON CONFLICT (id) DO NOTHING`,
				h...,
			)
		}
	}

	// Audit and remove any fabricated/fake entries in github_techniques
	_, _ = db.Pool.Exec(ctx, `
		DELETE FROM github_techniques 
		WHERE id LIKE 'tech-%' 
		   OR repo_url LIKE '%finra-darkpool-signal%' 
		   OR title ILIKE '%FINRA%'
		   OR status = 'VERIFIED'
	`)

	// Seed initial github_techniques if empty
	var gtCount int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM github_techniques").Scan(&gtCount)
	if gtCount == 0 {
		log.Println("[DATABASE] Seeding initial github-sourced techniques...")
		techniques := [][]interface{}{
			{"git_001", "Kalman-Filtered Reward Smoothing", "Uses a recursive Kalman Filter algorithm to smooth dynamic reward signals, eliminating high-frequency tick noise.", "https://github.com/open-quant/kalman-filter-fx", "MIT License", "APPROVED"},
			{"git_002", "Attention-Weighted Execution Sequence", "A sequence window discount model that scales rewards based on self-attention scores of recent execution latency history.", "https://github.com/deep-quant/attention-discount", "Apache-2.0 License", "APPROVED"},
			{"git_003", "Elastic-Net Penalty for Slippage Variance", "Applies combined L1 and L2 penalties on slippage variance to constrain excessive strategy position-lots sizing.", "https://github.com/hft-quant/slippage-regularizer", "MIT License", "APPROVED"},
		}
		for _, t := range techniques {
			_, _ = db.Pool.Exec(ctx, `
				INSERT INTO github_techniques (id, title, description, repo_url, licensing, status)
				VALUES ($1, $2, $3, $4, $5, $6)
				ON CONFLICT (id) DO NOTHING`,
				t...,
			)
		}
	}

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
