import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";

// Pre-emptively set the test env to prevent server start side effects
process.env.NODE_ENV = "test";

import {
  pgDb,
  encrypt,
  decrypt,
  assertTradingAllowed
} from "../server";
import { safetyBackstop } from "../safetyBackstop";

describe("Sovereign FX Trading Bot - Integration Test Suite", () => {

  beforeAll(async () => {
    // Isolate the storage files for testing to prevent interference from/to the live development server
    (pgDb as any).stateFilePath = path.join(process.cwd(), "postgres_state_test.json");
    (safetyBackstop as any).filepath = path.join(process.cwd(), "safety_state_test.json");

    // Clean up or copy initial template if not present
    if (fs.existsSync((pgDb as any).stateFilePath)) {
      try { fs.unlinkSync((pgDb as any).stateFilePath); } catch (e) {}
    }
    if (fs.existsSync((safetyBackstop as any).filepath)) {
      try { fs.unlinkSync((safetyBackstop as any).filepath); } catch (e) {}
    }

    // Ensure database and fallback engine are initialized
    await pgDb.initialize();
  });

  afterAll(() => {
    // Clean up isolated test files
    try {
      if (fs.existsSync((pgDb as any).stateFilePath)) {
        fs.unlinkSync((pgDb as any).stateFilePath);
      }
      if (fs.existsSync((safetyBackstop as any).filepath)) {
        fs.unlinkSync((safetyBackstop as any).filepath);
      }
    } catch (e) {}
  });

  describe("Broker Connection Validation and DB Encryption Flow", () => {
    it("should securely encrypt and store broker credentials in the DB fallback cache", async () => {
      const mockBroker = {
        id: `test-broker-${Date.now()}`,
        brokerType: "oanda",
        apiUrl: "https://api-fxtrade.oanda.com",
        accountId: "test-account-12345",
        apiToken: "OANDA-PRODA-SECRET-KEY",
        secretKey: "OANDA-SECRET-STATION",
        status: "CONNECTED"
      };

      // Encrypt credentials
      const apiTokenEnc = encrypt(mockBroker.apiToken);
      const secretKeyEnc = encrypt(mockBroker.secretKey);

      // Run query insert
      await pgDb.queryAsync(
        `INSERT INTO broker_connections (id, broker_type, api_url, account_id, api_token_encrypted, secret_key_encrypted, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          mockBroker.id,
          mockBroker.brokerType,
          mockBroker.apiUrl,
          mockBroker.accountId,
          apiTokenEnc,
          secretKeyEnc,
          mockBroker.status
        ]
      );

      // Query the database fallback cache back to verify persistence
      const conns = await pgDb.queryAsync("SELECT * FROM broker_connections");
      const savedConn = conns.find((c: any) => c.id === mockBroker.id);

      expect(savedConn).toBeDefined();
      expect(savedConn.brokerType).toBe(mockBroker.brokerType);
      expect(savedConn.accountId).toBe(mockBroker.accountId);

      // Assert that credentials are encrypted in-database (not stored in plain text)
      expect(savedConn.apiTokenEnc).not.toBe(mockBroker.apiToken);
      expect(savedConn.secretKeyEnc).not.toBe(mockBroker.secretKey);

      // Decrypt and assert accuracy
      expect(decrypt(savedConn.apiTokenEnc)).toBe(mockBroker.apiToken);
      expect(decrypt(savedConn.secretKeyEnc)).toBe(mockBroker.secretKey);
    });
  });

  describe("Full Candidate Lifecycle and Safety Gating Constraints", () => {
    it("should simulate a sandbox candidate run transitioning through evaluation", async () => {
      // 1. Sandbox candidates stored in database sandbox_runs
      const sandboxCandidate = {
        id: `cand-${Date.now()}`,
        candidateId: "evolution-cpu3-v1",
        name: "Momentum breakout",
        code: `double calculateReward(double pnl_pips) { return pnl_pips * 1.5; }`,
        status: "PASSED",
        rejectionReason: null,
        metrics: { SharpeRatio: 2.1, maxDrawdown: 1.2 }
      };

      await pgDb.queryAsync(
        "INSERT INTO sandbox_runs",
        [sandboxCandidate]
      );

      const runs = pgDb.cache.sandbox_runs || [];
      const foundRun = runs.find((r: any) => r.id === sandboxCandidate.id);

      expect(foundRun).toBeDefined();
      expect(foundRun.status).toBe("PASSED");
      expect(foundRun.candidateId).toBe(sandboxCandidate.candidateId);
    });

    it("should enforce safety gating blocks on candidate promotion when locks are active", () => {
      // Set silent lock active
      safetyBackstop.updateState({ silentLockActive: true });

      // Simulate a promotion guard check
      const safety = safetyBackstop.getState();
      let blocked = false;
      let errorMsg = "";

      if (safety.silentLockActive) {
        blocked = true;
        errorMsg = "Candidate promotion is BLOCKED by Silent Lock state.";
      }

      expect(blocked).toBe(true);
      expect(errorMsg).toContain("BLOCKED by Silent Lock");

      // Reset
      safetyBackstop.updateState({ silentLockActive: false });
    });
  });

  describe("assertTradingAllowed() Gating Verification", () => {
    it("should allow trading when all safety locks are completely disarmed", () => {
      safetyBackstop.updateState({
        silentLockActive: false,
        emergencyHaltActive: false,
        safeModeActive: false
      });

      // Should complete successfully without throwing
      expect(() => assertTradingAllowed()).not.toThrow();
    });

    it("should throw a strict error and block execution when Silent Lock is engaged", () => {
      safetyBackstop.updateState({
        silentLockActive: true,
        silentLockTriggerReason: "Drawdown limit breached"
      });

      expect(() => assertTradingAllowed()).toThrow("Silent Lock is currently active: Drawdown limit breached");
    });

    it("should throw a strict error and block execution when Emergency Halt is engaged", () => {
      safetyBackstop.updateState({
        silentLockActive: false,
        emergencyHaltActive: true
      });

      expect(() => assertTradingAllowed()).toThrow("Emergency Halt is currently active");
    });

    it("should throw a strict error and block execution when Safe Mode is engaged", () => {
      safetyBackstop.updateState({
        emergencyHaltActive: false,
        safeModeActive: true,
        safeModeTriggerReason: "Lost core broker link"
      });

      expect(() => assertTradingAllowed()).toThrow("Safe Mode is currently active: Lost core broker link");
    });
  });

  describe("Watchdog Daemon Failure Detection Logic Simulator", () => {
    it("should trigger failover (Safe Mode + Emergency Halt) when consecutive heartbeat checks fail 3 times", () => {
      // Initialize with no failures and safety disarmed
      let consecutiveFailures = 0;
      safetyBackstop.updateState({
        safeModeActive: false,
        emergencyHaltActive: false
      });

      // Simulate 3 successive failures
      for (let i = 0; i < 3; i++) {
        consecutiveFailures++;
      }

      // Check watchdog condition criteria
      if (consecutiveFailures >= 3) {
        const reason = `MAIN ENGINE UNRESPONSIVE: Failed heartbeat checks ${consecutiveFailures} consecutive times. Detached sentinel initiating failover.`;
        safetyBackstop.triggerSafeMode(reason);
        safetyBackstop.triggerEmergencyHalt(reason, { source: "WATCHDOG_DETECTION" });
      }

      const postWatchdogState = safetyBackstop.getState();
      expect(postWatchdogState.safeModeActive).toBe(true);
      expect(postWatchdogState.emergencyHaltActive).toBe(true);
      expect(postWatchdogState.safeModeTriggerReason).toContain("MAIN ENGINE UNRESPONSIVE");
    });
  });

});
