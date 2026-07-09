-- Migration: 001_init.sql
-- Description: Create all database tables for Sovereign FX Trading Bot (Proda/NEXUS)

-- 1. Security Config Table
CREATE TABLE IF NOT EXISTS security_config (
    id INT PRIMARY KEY DEFAULT 1,
    api_mutate_key TEXT NOT NULL,
    allowed_ips TEXT[] NOT NULL DEFAULT ARRAY['127.0.0.1']::TEXT[],
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Broker Connections Table
CREATE TABLE IF NOT EXISTS broker_connections (
    id VARCHAR PRIMARY KEY,
    broker_type VARCHAR NOT NULL,
    api_url VARCHAR,
    account_id VARCHAR NOT NULL,
    api_token_encrypted TEXT,
    secret_key_encrypted TEXT,
    passphrase_encrypted TEXT,
    target_comp_id VARCHAR,
    sender_comp_id VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'DISCONNECTED',
    last_tested_time TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT uq_broker_account UNIQUE (broker_type, account_id)
);
CREATE INDEX IF NOT EXISTS idx_broker_connections_status ON broker_connections(status);

-- 3. News Config Table
CREATE TABLE IF NOT EXISTS news_config (
    id INT PRIMARY KEY DEFAULT 1,
    news_api_key_enc TEXT,
    finnhub_key_enc TEXT,
    CONSTRAINT single_row_news CHECK (id = 1)
);

-- 4. Instrument Strategies Table
CREATE TABLE IF NOT EXISTS instrument_strategies (
    symbol VARCHAR(20) PRIMARY KEY,
    whale_mode BOOLEAN DEFAULT FALSE,
    sniper_mode BOOLEAN DEFAULT FALSE,
    breakeven_enabled BOOLEAN DEFAULT FALSE,
    breakeven_threshold NUMERIC DEFAULT 0,
    dynamic_sl_enabled BOOLEAN DEFAULT FALSE,
    shock_absorber_enabled BOOLEAN DEFAULT FALSE,
    last_triggered JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- 5. Strategy Audit Logs Table
CREATE TABLE IF NOT EXISTS strategy_audit_logs (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol VARCHAR(20) NOT NULL,
    mode VARCHAR(50) NOT NULL,
    trigger_value NUMERIC,
    action_taken TEXT,
    input_params JSONB NOT NULL DEFAULT '{}'::JSONB,
    output_result JSONB NOT NULL DEFAULT '{}'::JSONB
);
CREATE INDEX IF NOT EXISTS idx_strategy_audit_logs_symbol_time ON strategy_audit_logs(symbol, timestamp DESC);

-- 6. Historical Ticks Table
CREATE TABLE IF NOT EXISTS historical_ticks (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    price NUMERIC NOT NULL,
    spread NUMERIC,
    volatility NUMERIC,
    volume INT
);
CREATE INDEX IF NOT EXISTS idx_historical_ticks_time ON historical_ticks(timestamp ASC);

-- 7. Sandbox Runs Table
CREATE TABLE IF NOT EXISTS sandbox_runs (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    candidate_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR NOT NULL,
    rejection_reason TEXT,
    metrics JSONB NOT NULL DEFAULT '{}'::JSONB
);
CREATE INDEX IF NOT EXISTS idx_sandbox_runs_time ON sandbox_runs(timestamp DESC);

-- 8. Self Improvement Logs Table
CREATE TABLE IF NOT EXISTS self_improvement_logs (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trigger_reason TEXT,
    fitness_gain_pct NUMERIC,
    new_code_applied TEXT,
    previous_metrics JSONB,
    optimized_metrics JSONB
);
CREATE INDEX IF NOT EXISTS idx_self_improvement_logs_time ON self_improvement_logs(timestamp DESC);

-- 9. Research Cache Table
CREATE TABLE IF NOT EXISTS research_cache (
    topic VARCHAR PRIMARY KEY,
    sources JSONB NOT NULL DEFAULT '[]'::JSONB,
    summary TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Arbitrage Spreads Table
CREATE TABLE IF NOT EXISTS arbitrage_spreads (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    binance_bid NUMERIC,
    binance_ask NUMERIC,
    coinbase_bid NUMERIC,
    coinbase_ask NUMERIC,
    kraken_bid NUMERIC,
    kraken_ask NUMERIC,
    spread_binance_coinbase NUMERIC,
    spread_binance_kraken NUMERIC,
    spread_coinbase_kraken NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_arbitrage_spreads_time ON arbitrage_spreads(timestamp DESC);

-- 11. Arbitrage Opportunities Table
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    buy_venue VARCHAR,
    sell_venue VARCHAR,
    buy_price NUMERIC,
    sell_price NUMERIC,
    gross_spread NUMERIC,
    fees NUMERIC,
    net_edge NUMERIC,
    compliance_check VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_time ON arbitrage_opportunities(timestamp DESC);

-- 12. Arbitrage Trades Table
CREATE TABLE IF NOT EXISTS arbitrage_trades (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opportunity_id VARCHAR,
    pair VARCHAR,
    buy_venue VARCHAR,
    sell_venue VARCHAR,
    buy_price NUMERIC,
    sell_price NUMERIC,
    executed_size NUMERIC,
    gross_pnl NUMERIC,
    fees NUMERIC,
    net_pnl NUMERIC,
    status VARCHAR,
    execution_log TEXT
);
CREATE INDEX IF NOT EXISTS idx_arbitrage_trades_time ON arbitrage_trades(timestamp DESC);

-- 13. Arbitrage Compliance Table
CREATE TABLE IF NOT EXISTS arbitrage_compliance (
    id INT PRIMARY KEY DEFAULT 1,
    tos_permitted BOOLEAN DEFAULT FALSE,
    regulations_permitted BOOLEAN DEFAULT FALSE,
    CONSTRAINT single_row_compliance CHECK (id = 1)
);
