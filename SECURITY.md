# Security Policy & Capital Safety Framework

## Overview
The Sovereign Algorithmic FX Trading Engine (NEXUS Proda) manages high-frequency financial operations. Security and capital safety are paramount. All production keys, API tokens, and mutating endpoints are protected by cryptographic isolation and automated safety invariants.

---

## 🔑 Credential Storage & Encryption

- **AES-256 GCM Cryptographic Envelope**: All sensitive credentials (OANDA API tokens, FIX passwords, custom broker keys) are encrypted at rest using AES-256-GCM authenticated encryption.
- **Master Encryption Key**: Decryption keys are derived from the `MASTER_ENCRYPTION_KEY` environment variable and are never stored in source code, database tables, or client-side assets.
- **Sensitive Data Scrubbing**: All Sentry error events, logger outputs, and telemetry metrics scrub sensitive keys (`api_token`, `secret`, `password`, `gemini_api_key`, `key`, `auth`) before transmitting payloads.

---

## 🛡️ Protected-Zones Policy

To prevent rogue AI automation, corrupted scripts, or unauthorized commits from degrading capital safety controls, the repository enforces a strict **Protected Zones Policy**.

The following core files are protected and monitored by the regression guard (`./bin/regression_guard.sh`):
- `internal/safety/backstop.go` — Safety Backstop Engine
- `internal/crypto/crypto.go` — AES-256 Envelope Encryption
- `internal/api/handlers.go` — IP Firewall & Mutating Route Guards
- `audit_and_repair.js` — Core Repository Repair Engine

### Enforcement Rules:
1. Automated tools and AI agents are **STRICTLY FORBIDDEN** from removing or shrinking protected-zone files.
2. Invariant verification tests run on every pull request and automated build.

---

## 🛑 Two-Step Human Confirmation Requirement

Before any strategy or candidate model can be promoted to live real-capital execution:

1. **Phase 1: Observation Verification**: The model must complete a minimum multi-day observation period in the sandbox with zero safety circuit breaker trips.
2. **Phase 2: Human Sign-Off**: Promotion requires explicit two-step human confirmation in the management dashboard with physical secret key entry. Automated scripts cannot auto-promote models to live capital.

---

## 📬 Reporting a Vulnerability

If you discover a security vulnerability or potential capital safety flaw within this repository:

1. **Do NOT open a public GitHub issue.**
2. Report the vulnerability privately via email to: `security-response@sovereign-trading.internal`
3. Include detailed steps to reproduce the issue and any relevant code references.
4. The security response team will review reports within 24 hours.
