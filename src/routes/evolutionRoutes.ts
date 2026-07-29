import { Router, Request, Response } from "express";
import { checkIPAllowlist } from "../middleware/auth";

export const evolutionRouter = Router();

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || "http://127.0.0.1:3001";

async function proxyToGo(req: Request, res: Response) {
  const targetUrl = `${GO_BACKEND_URL}${req.originalUrl}`;
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (req.headers["x-forwarded-for"]) {
      headers["x-forwarded-for"] = req.headers["x-forwarded-for"] as string;
    }
    if (req.headers["x-real-ip"]) {
      headers["x-real-ip"] = req.headers["x-real-ip"] as string;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const options: RequestInit = {
      method: req.method,
      headers,
      signal: controller.signal,
    };

    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    const goRes = await fetch(targetUrl, options);
    clearTimeout(timeoutId);

    const contentType = goRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await goRes.json();
      return res.status(goRes.status).json(data);
    } else {
      const text = await goRes.text();
      return res.status(goRes.status).send(text);
    }
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Go backend service unreachable at ${GO_BACKEND_URL}: ${err.message}`
    });
  }
}

// POST /api/evolution/hot-patch
evolutionRouter.post("/hot-patch", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), (req: Request, res: Response) => {
  proxyToGo(req, res);
});

// GET /api/evolution/patches
evolutionRouter.get("/patches", (req: Request, res: Response) => {
  proxyToGo(req, res);
});

// POST /api/evolution/self-heal
evolutionRouter.post("/self-heal", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), (req: Request, res: Response) => {
  proxyToGo(req, res);
});

// GET /api/evolution/healing-logs
evolutionRouter.get("/healing-logs", (req: Request, res: Response) => {
  proxyToGo(req, res);
});

// GET /api/evolution/candidates
evolutionRouter.get("/candidates", (req: Request, res: Response) => {
  proxyToGo(req, res);
});
