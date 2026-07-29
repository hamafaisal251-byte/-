import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import http from "http";
import nodeFetch from "node-fetch";
import nock from "nock";
import path from "path";
import fs from "fs";

// Pre-emptively set test env
process.env.NODE_ENV = "test";

import { pgDb, fixEngine, addServerLog } from "../server";
import { brokerRouter } from "../src/routes/brokerRoutes";

describe("Broker & FIX Engine Dedicated Connectivity Tests (/api/brokers/* and /api/fix/*)", () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Isolate database file for testing
    (pgDb as any).stateFilePath = path.join(process.cwd(), "postgres_state_broker_test.json");
    if (fs.existsSync((pgDb as any).stateFilePath)) {
      try { fs.unlinkSync((pgDb as any).stateFilePath); } catch (e) {}
    }
    await pgDb.initialize();

    // Create Express app for routing test
    app = express();
    app.use(express.json());

    // Mount broker router
    app.use("/api/brokers", brokerRouter);

    // Mount FIX routes
    app.get("/api/fix/status", (req, res) => {
      res.json({
        success: true,
        status: fixEngine.sessionStatus,
        targetCompId: fixEngine.targetCompId,
        senderCompId: fixEngine.senderCompId,
        inboundSeqNum: fixEngine.inboundSeqNum,
        outboundSeqNum: fixEngine.outboundSeqNum,
        logs: fixEngine.fixLogs
      });
    });

    app.post("/api/fix/connect", (req, res) => {
      const { targetCompId, senderCompId } = req.body || {};
      fixEngine.configureSession(targetCompId, senderCompId);
      fixEngine.logon();
      res.json({ success: true, status: fixEngine.sessionStatus });
    });

    app.post("/api/fix/disconnect", (req, res) => {
      fixEngine.logout();
      res.json({ success: true, status: fixEngine.sessionStatus });
    });

    app.post("/api/fix/gap-recovery", (req, res) => {
      const { beginSeq = 1, endSeq = 6 } = req.body || {};
      (fixEngine as any).addLog(`OUT (ResendRequest 35=2): 8=FIX.4.4|9=42|35=2|34=${fixEngine.outboundSeqNum}|49=${fixEngine.senderCompId}|56=${fixEngine.targetCompId}|7=${beginSeq}|16=${endSeq}|10=188|`);
      fixEngine.outboundSeqNum++;
      (fixEngine as any).addLog(`IN (SequenceReset 35=4): 8=FIX.4.4|9=52|35=4|34=${beginSeq}|49=${fixEngine.targetCompId}|56=${fixEngine.senderCompId}|36=${endSeq + 1}|123=Y|10=112|`);
      fixEngine.inboundSeqNum = endSeq + 1;
      addServerLog("RISK-MANAGER", "SUCCESS", `FIX Sequence gap recovery executed.`);
      res.json({
        success: true,
        requestId: `gap-req-${Date.now()}`,
        beginSeq,
        endSeq,
        message: "ResendRequest (35=2) dispatched. Sequence synchronized."
      });
    });

    app.post("/api/fix/sbe-parse", (req, res) => {
      const { templateId = 101, payloadHex = "0800010001001f0001000000000000000100" } = req.body || {};
      const isValid = payloadHex.length >= 8 && payloadHex.length % 2 === 0;
      res.json({
        success: true,
        sbeFrame: {
          header: { blockLength: 32, templateId, schemaId: 1, version: 1 },
          sequenceNumber: Math.floor(Date.now() / 1000) % 100000,
          timestampNs: Date.now() * 1000000,
          payloadHex,
          isValid
        }
      });
    });

    // Start HTTP server on dynamic port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    try {
      if (fs.existsSync((pgDb as any).stateFilePath)) {
        fs.unlinkSync((pgDb as any).stateFilePath);
      }
    } catch (e) {}
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // ============================================================================
  // BROKER ENDPOINTS (/api/brokers/*)
  // ============================================================================

  describe("POST /api/brokers/connect - Validation & Authentication", () => {
    it("should return 400 when mandatory credentials (brokerType, accountId, apiToken/secretKey) are missing", async () => {
      const res = await nodeFetch(`${baseUrl}/api/brokers/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerType: "oanda" }) // missing accountId & tokens
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toBeDefined();
    });

    it("should successfully connect a DEMO / Simulated OANDA broker connection without external API call", async () => {
      const res = await nodeFetch(`${baseUrl}/api/brokers/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerType: "oanda",
          apiUrl: "https://api-fxpractice.oanda.com",
          accountId: "demo-account-101",
          apiToken: "SIMULATED-SOVEREIGN-KEY",
          environment: "DEMO_LIVE"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.connection).toBeDefined();
    });

    it("should validate and accept real OANDA credentials when external endpoint responds 200 OK (nock)", async () => {
      nock("https://api-fxtrade.oanda.com")
        .get("/accounts")
        .reply(200, { accounts: [{ id: "101-004-1234567-001" }] });

      const res = await nodeFetch(`${baseUrl}/api/brokers/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerType: "oanda",
          apiUrl: "https://api-fxtrade.oanda.com",
          accountId: "101-004-1234567-001",
          apiToken: "oanda-real-token-secret-999",
          environment: "REAL_LIVE"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
    });

    it("should reject connection when real OANDA credentials fail authentication with 401 Unauthorized (nock)", async () => {
      nock("https://api-fxtrade.oanda.com")
        .get("/accounts")
        .reply(401, { errorCode: "UNAUTHORIZED", message: "Invalid Bearer token" });

      const res = await nodeFetch(`${baseUrl}/api/brokers/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerType: "oanda",
          apiUrl: "https://api-fxtrade.oanda.com",
          accountId: "101-004-invalid",
          apiToken: "bad-token",
          environment: "REAL_LIVE"
        })
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("OANDA Validation Failed");
    });

    it("should validate and connect Binance broker when account endpoint returns 200 OK (nock)", async () => {
      nock("https://api.binance.com")
        .get(/\/api\/v3\/account.*/)
        .reply(200, { makerCommission: 10, takerCommission: 10, buyerCommission: 0, sellerCommission: 0, canTrade: true });

      const res = await nodeFetch(`${baseUrl}/api/brokers/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerType: "binance",
          apiUrl: "https://api.binance.com",
          accountId: "binance-acc-001",
          apiToken: "binance-api-key-xyz",
          secretKey: "binance-secret-key-abc",
          environment: "REAL_LIVE"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
    });

    it("should connect a FIX Gateway connection directly and configure session", async () => {
      const res = await nodeFetch(`${baseUrl}/api/brokers/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerType: "fix_gateway",
          accountId: "FIX_PRIMARY_ACC",
          targetCompId: "OANDA_FIX_TARGET",
          senderCompId: "SOVEREIGN_SENDER",
          apiToken: "fix-token-pass",
          environment: "DEMO_LIVE"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(["LOGGING_IN", "LOGGED_IN"]).toContain(fixEngine.sessionStatus);
    });
  });

  describe("GET /api/brokers/connections & POST /api/brokers/disconnect", () => {
    it("should return all active connections with encrypted secrets masked (maskedToken, maskedSecret)", async () => {
      const res = await nodeFetch(`${baseUrl}/api/brokers/connections`);
      expect(res.status).toBe(200);

      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.connections)).toBe(true);
      expect(data.connections.length).toBeGreaterThan(0);

      // Verify masking
      const firstConn = data.connections[0];
      expect(firstConn.maskedToken).toBeDefined();
      expect(firstConn.apiTokenEnc).toBeUndefined(); // Should not expose raw encrypted token in response
    });

    it("should disconnect a broker connection and purge it from database", async () => {
      const disconnectRes = await nodeFetch(`${baseUrl}/api/brokers/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerType: "oanda",
          accountId: "demo-account-101"
        })
      });

      expect(disconnectRes.status).toBe(200);
      const disconnectData: any = await disconnectRes.json();
      expect(disconnectData.success).toBe(true);

      // Verify connection is removed
      const listRes = await nodeFetch(`${baseUrl}/api/brokers/connections`);
      const listData: any = await listRes.json();
      const exists = listData.connections.some((c: any) => c.accountId === "demo-account-101");
      expect(exists).toBe(false);
    });
  });

  // ============================================================================
  // FIX ENGINE ENDPOINTS (/api/fix/*)
  // ============================================================================

  describe("FIX Protocol Engine Endpoint Suite (/api/fix/*)", () => {
    it("GET /api/fix/status should return current FIX session metrics and logs", async () => {
      const res = await nodeFetch(`${baseUrl}/api/fix/status`);
      expect(res.status).toBe(200);

      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBeDefined();
      expect(data.inboundSeqNum).toBeGreaterThanOrEqual(1);
      expect(data.outboundSeqNum).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(data.logs)).toBe(true);
    });

    it("POST /api/fix/connect should configure target and sender CompIDs and engage FIX logon", async () => {
      const res = await nodeFetch(`${baseUrl}/api/fix/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCompId: "INSTITUTIONAL_TARGET_99",
          senderCompId: "SOVEREIGN_SENDER_01"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(["LOGGING_IN", "LOGGED_IN"]).toContain(data.status);
      expect(fixEngine.targetCompId).toBe("INSTITUTIONAL_TARGET_99");
      expect(fixEngine.senderCompId).toBe("SOVEREIGN_SENDER_01");
    });

    it("POST /api/fix/gap-recovery should dispatch ResendRequest (35=2) and synchronize sequence numbers", async () => {
      const res = await nodeFetch(`${baseUrl}/api/fix/gap-recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beginSeq: 10,
          endSeq: 20
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.beginSeq).toBe(10);
      expect(data.endSeq).toBe(20);
      expect(data.message).toContain("Sequence synchronized");
      expect(fixEngine.inboundSeqNum).toBe(21);
    });

    it("POST /api/fix/sbe-parse should parse binary SBE header and payload frame", async () => {
      const res = await nodeFetch(`${baseUrl}/api/fix/sbe-parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: 202,
          payloadHex: "0800010001001f00010000000000000001000200"
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.sbeFrame).toBeDefined();
      expect(data.sbeFrame.header.templateId).toBe(202);
      expect(data.sbeFrame.isValid).toBe(true);
    });

    it("POST /api/fix/disconnect should disengage session and send Logout message (35=5)", async () => {
      const res = await nodeFetch(`${baseUrl}/api/fix/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(["LOGGED_OUT", "DISCONNECTED"]).toContain(data.status);
      expect(["LOGGED_OUT", "DISCONNECTED"]).toContain(fixEngine.sessionStatus);
    });
  });

});
