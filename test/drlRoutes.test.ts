import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import http from "http";
import nodeFetch from "node-fetch";
import nock from "nock";
import path from "path";
import fs from "fs";

process.env.NODE_ENV = "test";

import { pgDb } from "../server";
import { drlRouter } from "../src/routes/drlRoutes";

describe("DRL Routes Integration Tests (/api/drl/*)", () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    (pgDb as any).stateFilePath = path.join(process.cwd(), "postgres_state_drl_test.json");
    if (fs.existsSync((pgDb as any).stateFilePath)) {
      try { fs.unlinkSync((pgDb as any).stateFilePath); } catch (e) {}
    }
    await pgDb.initialize();

    app = express();
    app.use(express.json());
    app.use("/api/drl", drlRouter);

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

  it("GET /api/drl/drift-detection should return drift metrics and status", async () => {
    const res = await nodeFetch(`${baseUrl}/api/drl/drift-detection`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.driftStatus).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(data.metrics.actualWinRate).toBeGreaterThanOrEqual(0);
    expect(data.metrics.expectedWinRate).toBeGreaterThan(0);
  });

  it("POST /api/drl/recalibrate should trigger model recalibration", async () => {
    const res = await nodeFetch(`${baseUrl}/api/drl/recalibrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("recalibration executed");
  });

  it("GET /api/drl/ensemble should return registry, prediction, and calibration logs", async () => {
    const res = await nodeFetch(`${baseUrl}/api/drl/ensemble`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.registry)).toBe(true);
    expect(Array.isArray(data.predictions)).toBe(true);
    expect(Array.isArray(data.calibration)).toBe(true);
  });

  it("GET /api/drl/telemetry should return telemetry data from Python microservice via nock mock", async () => {
    nock("http://127.0.0.1:8001")
      .get("/api/drl/telemetry")
      .reply(200, {
        status: "HEALTHY",
        ppoActorLoss: 0.0142,
        criticLoss: 0.0035,
        entropyBonus: 0.012,
        klDivergence: 0.0041,
        stepCounter: 1450000
      });

    const res = await nodeFetch(`${baseUrl}/api/drl/telemetry`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe("HEALTHY");
    expect(data.ppoActorLoss).toBe(0.0142);
    expect(data.stepCounter).toBe(1450000);
  });

  it("GET /api/drl/leverage should return calculated dynamic leverage based on risk backstop", async () => {
    const res = await nodeFetch(`${baseUrl}/api/drl/leverage`);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.currentResult).toBeDefined();
    expect(data.currentResult.finalLeverage).toBeGreaterThanOrEqual(0);
    expect(data.scenarios).toBeDefined();
  });
});
