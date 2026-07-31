import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";

process.env.NODE_ENV = "test";

import { pgDb } from "../server";
import { riskRouter } from "../src/routes/riskRoutes";
import { safetyBackstop } from "../safetyBackstop";

describe("Risk Routes Integration Tests (/api/risk/*)", () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    (pgDb as any).stateFilePath = path.join(process.cwd(), "postgres_state_risk_test.json");
    if (fs.existsSync((pgDb as any).stateFilePath)) {
      try { fs.unlinkSync((pgDb as any).stateFilePath); } catch (e) {}
    }
    await pgDb.initialize();

    app = express();
    app.use(express.json());
    app.use("/api/risk", riskRouter);

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

  it("GET /api/risk/portfolio should calculate portfolio risk metrics including VaR and exposure limits", async () => {
    const res = await nodeFetch(`${baseUrl}/api/risk/portfolio`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.metrics).toBeDefined();
    expect(data.metrics.var95Param).toBeGreaterThanOrEqual(0);
    expect(data.metrics.var99Param).toBeGreaterThanOrEqual(0);
    expect(data.metrics.singleExposures).toBeDefined();
    expect(data.metrics.limits).toBeDefined();
    expect(data.metrics.limits.maxTotalNotionalExposure).toBeDefined();
  });

  it("POST /api/risk/limits should update safety backstop risk limits", async () => {
    const res = await nodeFetch(`${baseUrl}/api/risk/limits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxTotalNotionalExposure: 5000000,
        maxSingleInstrumentExposure: 1500000,
        maxCorrelatedGroupExposure: 3000000,
        drawdownThresholdPct: 5.0
      })
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.state.maxTotalNotionalExposure).toBe(5000000);
    expect(data.state.maxSingleInstrumentExposure).toBe(1500000);

    // Verify backstop state directly
    const backstopState = safetyBackstop.getState();
    expect(backstopState.maxTotalNotionalExposure).toBe(5000000);
    expect(backstopState.drawdownThresholdPct).toBe(5.0);
  });

  it("POST /api/risk/stress-test should run Monte Carlo simulations and report VaR metrics", async () => {
    const res = await nodeFetch(`${baseUrl}/api/risk/stress-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: "BLACK_MONDAY_1987",
        simulations: 1000
      })
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.scenario).toContain("1987 Black Monday");
    expect(data.metrics.var99Pct).toBeGreaterThan(0);
    expect(data.metrics.survivalRatePct).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/risk/history should return portfolio risk logs history", async () => {
    const res = await nodeFetch(`${baseUrl}/api/risk/history`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.history)).toBe(true);
  });
});
