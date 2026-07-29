import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import express from "express";
import nodeFetch from "node-fetch";
import nock from "nock";
import { Server } from "http";
import { evolutionRouter } from "../src/routes/evolutionRoutes";

const app = express();
app.use(express.json());
app.use("/api/evolution", evolutionRouter);

let server: Server;
let serverUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr !== "string") {
        serverUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
});

describe("Evolution Routes Proxy to Go Backend", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("should forward POST /api/evolution/hot-patch to Go backend and return Go AST rejection on invalid code", async () => {
    const goScope = nock("http://127.0.0.1:3001")
      .post("/api/evolution/hot-patch", {
        strategyId: "HFT_ALPHA_COMPASS",
        proposedCode: "func (s *Strategy) CalculateAlpha(spread float64) float64 { return math.Max(0.0, spread * 1.84)"
      })
      .reply(400, {
        success: false,
        error: "Hot-patch rejected: AST Syntax Error: patch.go:1:80: expected '}', found 'EOF'"
      });

    const res = await nodeFetch(`${serverUrl}/api/evolution/hot-patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategyId: "HFT_ALPHA_COMPASS",
        proposedCode: "func (s *Strategy) CalculateAlpha(spread float64) float64 { return math.Max(0.0, spread * 1.84)"
      })
    });

    const data: any = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("AST Syntax Error");
    expect(goScope.isDone()).toBe(true);
  });

  it("should return 502 Bad Gateway if Go backend is unreachable without fabricating fallback data", async () => {
    const res = await nodeFetch(`${serverUrl}/api/evolution/hot-patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategyId: "HFT_ALPHA_COMPASS",
        proposedCode: "func (s *Strategy) CalculateAlpha() {}"
      })
    });

    const data: any = await res.json();
    expect(res.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Go backend service unreachable");
  });

  it("should forward GET /api/evolution/patches to Go backend", async () => {
    const goScope = nock("http://127.0.0.1:3001")
      .get("/api/evolution/patches")
      .reply(200, {
        success: true,
        patches: [{ patchId: "patch-101", strategyId: "ALPHA", astVerified: true }]
      });

    const res = await nodeFetch(`${serverUrl}/api/evolution/patches`);
    const data: any = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.patches[0].patchId).toBe("patch-101");
    expect(goScope.isDone()).toBe(true);
  });
});
