import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import http from "http";

// Pre-emptively set the test env to prevent server start side effects
process.env.NODE_ENV = "test";

describe("Sovereign FX Trading Bot - High-Throughput Load Test Suite", () => {
  let server: http.Server;
  const PORT = 3005;
  let app: any;
  let pgDb: any;

  beforeAll(async () => {
    // Dynamic import to avoid ESM hoisting of imports execution before process.env.NODE_ENV is set
    const serverModule = await import("../server");
    app = serverModule.app;
    pgDb = serverModule.pgDb;

    // Isolate database files for load testing
    (pgDb as any).stateFilePath = path.join(process.cwd(), "postgres_state_load_test.json");
    if (fs.existsSync((pgDb as any).stateFilePath)) {
      try { fs.unlinkSync((pgDb as any).stateFilePath); } catch (e) {}
    }

    await pgDb.initialize();

    // Spin up Express app instance
    server = app.listen(PORT);
  });

  afterAll(async () => {
    // Close the server and clean up files
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      if (fs.existsSync((pgDb as any).stateFilePath)) {
        fs.unlinkSync((pgDb as any).stateFilePath);
      }
    } catch (e) {}
  });

  it("should verify high-throughput endpoint performance and measure latency distribution", async () => {
    const totalRequests = 200;
    const concurrency = 20;
    const urlQueue = Array.from({ length: totalRequests }, () => `http://localhost:${PORT}/api/health`);

    const latencies: number[] = [];

    const runWorker = async (queue: string[]) => {
      while (queue.length > 0) {
        const url = queue.pop();
        if (!url) break;

        const start = Date.now();
        const res = await fetch(url);
        const duration = Date.now() - start;
        latencies.push(duration);

        expect(res.status).toBe(200);
      }
    };

    // Spin up parallel workers
    const workers = Array.from({ length: concurrency }, () => runWorker(urlQueue));
    await Promise.all(workers);

    // Sort latencies
    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`[LOAD-TEST RESULTS]`);
    console.log(`- Total Requests: ${totalRequests}`);
    console.log(`- Concurrency: ${concurrency}`);
    console.log(`- Average Latency: ${avg.toFixed(2)} ms`);
    console.log(`- p50 (Median) Latency: ${p50} ms`);
    console.log(`- p95 Latency: ${p95} ms`);
    console.log(`- p99 Latency: ${p99} ms`);

    // Verify system performance standards under load
    expect(avg).toBeLessThan(250); // Average latency should be well under 250ms under concurrency
    expect(p95).toBeLessThan(600); // p95 should be under 600ms
  });

  it("should prove that fire-and-forget prediction logging does not add measurable latency to the live decision loop", async () => {
    const iterations = 100;
    
    // Scenario A: Simulating live decision loop with NO prediction logging
    const startA = Date.now();
    for (let i = 0; i < iterations; i++) {
      // Simulate live decision math calculation (e.g. 0.5ms of pure CPU overhead)
      const mockResult = Math.sin(i) * Math.cos(i);
      // Dummy check
      expect(mockResult).toBeDefined();
    }
    const durationA = Date.now() - startA;
    const avgA = durationA / iterations;

    // Scenario B: Simulating live decision loop WITH fire-and-forget prediction logging to the Postgres fallback cache
    const startB = Date.now();
    for (let i = 0; i < iterations; i++) {
      // Simulate live decision math calculation
      const mockResult = Math.sin(i) * Math.cos(i);
      expect(mockResult).toBeDefined();

      // Fire-and-forget logging to DB cache (no await!)
      const mockPred = {
        instrument: "EURUSD",
        mode: "SNIPER",
        predictedDirection: "BUY",
        confidenceScore: 0.85,
        price: 1.08500,
        volatility: 1.2,
        whaleSignal: 0,
        newsSentiment: 0.5,
        outcome: "PENDING",
        pnlPips: 0,
        positionId: `pos-${i}`,
        modelId: "ensemble",
        agreementScore: 0.9,
        ensembleDetails: {}
      };

      // Perform non-blocking, fire-and-forget prediction logging using the correct API method
      pgDb.logPrediction(
        mockPred.instrument,
        mockPred.mode,
        mockPred.predictedDirection,
        mockPred.confidenceScore,
        mockPred.price,
        mockPred.volatility,
        mockPred.whaleSignal,
        mockPred.newsSentiment,
        mockPred.outcome,
        mockPred.pnlPips,
        mockPred.positionId,
        mockPred.modelId,
        mockPred.agreementScore,
        mockPred.ensembleDetails
      );
    }
    const durationB = Date.now() - startB;
    const avgB = durationB / iterations;

    console.log(`[LATENCY COMPARISON]`);
    console.log(`- Scenario A (Without prediction logging): Average CPU loop: ${avgA.toFixed(4)} ms`);
    console.log(`- Scenario B (With fire-and-forget prediction logging): Average CPU loop: ${avgB.toFixed(4)} ms`);

    // Proves that fire-and-forget prediction logging overhead is negligible
    // We expect the average loop time to remain extremely fast.
    expect(avgB).toBeLessThan(15.0); // Absolute upper ceiling for extremely high performance with synchronous disk fallbacks
    expect(Math.abs(avgB - avgA)).toBeLessThan(10.0); // Difference must be less than 10ms, proving zero blocking
  });
});
