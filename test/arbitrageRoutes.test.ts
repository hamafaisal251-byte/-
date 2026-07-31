import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";

process.env.NODE_ENV = "test";

import { pgDb } from "../server";
import { arbitrageRouter } from "../src/routes/arbitrageRoutes";
import { arbitrageConfig, setCandidatesList, setActiveCandidateId } from "../src/state/tradingState";

describe("Arbitrage Routes Integration Tests (/api/arbitrage/*)", () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    (pgDb as any).stateFilePath = path.join(process.cwd(), "postgres_state_arb_test.json");
    if (fs.existsSync((pgDb as any).stateFilePath)) {
      try { fs.unlinkSync((pgDb as any).stateFilePath); } catch (e) {}
    }
    await pgDb.initialize();

    app = express();
    app.use(express.json());
    app.use("/api/arbitrage", arbitrageRouter);

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

  it("GET /api/arbitrage/state should return current configuration and compliance status", async () => {
    const res = await nodeFetch(`${baseUrl}/api/arbitrage/state`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.config).toBeDefined();
    expect(data.compliance).toBeDefined();
  });

  it("POST /api/arbitrage/toggle should reject enabling when compliance (TOS or regulations) is unverified", async () => {
    // Ensure compliance is false
    await nodeFetch(`${baseUrl}/api/arbitrage/compliance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tosPermitted: false, regulationsPermitted: false })
    });

    const toggleRes = await nodeFetch(`${baseUrl}/api/arbitrage/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true })
    });

    expect(toggleRes.status).toBe(400);
    const data: any = await toggleRes.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("compliance verification required");
    expect(arbitrageConfig.liveEnabled).toBe(false);
  });

  it("POST /api/arbitrage/toggle should allow enabling when tosPermitted, regulationsPermitted, and candidate sandbox status are all PASSED", async () => {
    // 1. Set compliance true
    await nodeFetch(`${baseUrl}/api/arbitrage/compliance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tosPermitted: true, regulationsPermitted: true })
    });

    // 2. Set active candidate status to PASSED
    setActiveCandidateId("candidate-passed");
    setCandidatesList([
      { id: "candidate-passed", name: "Passed Candidate", status: "PASSED" }
    ]);

    // 3. Toggle enabled
    const toggleRes = await nodeFetch(`${baseUrl}/api/arbitrage/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true })
    });

    expect(toggleRes.status).toBe(200);
    const data: any = await toggleRes.json();
    expect(data.success).toBe(true);
    expect(data.config.liveEnabled).toBe(true);
  });

  it("POST /api/arbitrage/set-threshold should update arbitrage thresholds", async () => {
    const res = await nodeFetch(`${baseUrl}/api/arbitrage/set-threshold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thresholdNetProfitUsd: 25.0,
        orderSizeBtc: 1.2,
        slippagePct: 0.02
      })
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.config.thresholdNetProfitUsd).toBe(25.0);
    expect(data.config.orderSizeBtc).toBe(1.2);
    expect(data.config.slippagePct).toBe(0.02);
  });

  it("GET /api/arbitrage/triangular should calculate triangular arbitrage opportunities", async () => {
    const res = await nodeFetch(`${baseUrl}/api/arbitrage/triangular`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.opportunities)).toBe(true);
    expect(data.opportunities.length).toBeGreaterThan(0);
  });
});
