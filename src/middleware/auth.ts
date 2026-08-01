import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { pgDb } from "../db";

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const checkIPAllowlist = (req: Request, res: Response, next: NextFunction) => {
  // Always allow GET read-only requests for dashboard UI rendering
  if (req.method === "GET") {
    return next();
  }

  let clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  
  // Normalise IPv6 loopback
  if (clientIp === "::1" || clientIp === "::ffff:127.0.0.1") {
    clientIp = "127.0.0.1";
  }

  let secConfig: any = null;
  try {
    const serverModule = require("../../server");
    secConfig = serverModule.pgDb?.query ? serverModule.pgDb.query("SELECT * FROM security_config") : null;
  } catch (_err) {
    // Ignore if server module not yet fully loaded
  }

  const allowed = secConfig?.allowed_ips || ["127.0.0.1", "::1"];
  
  // Check Cloud Run proxy headers if present
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor && typeof xForwardedFor === "string") {
    const ips = xForwardedFor.split(",").map(ip => ip.trim());
    clientIp = ips[0];
  }

  if (allowed.includes(clientIp) || clientIp === "127.0.0.1" || clientIp === "localhost") {
    return next();
  }

  return res.status(403).json({ error: `Access forbidden: IP address ${clientIp} is not in the security allowlist.` });
};

export const mutateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: "Too many mutation requests from this IP. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

export const checkBearerAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let secConfig: any = null;
  try {
    secConfig = pgDb.query("SELECT * FROM security_config");
  } catch (_e) {}
  const expectedKey = process.env.API_MUTATE_KEY || secConfig?.api_mutate_key || "sovereign_mutate_sec_key_prod";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token !== expectedKey) {
      return res.status(403).json({
        success: false,
        error: "Invalid authorization bearer token."
      });
    }
  } else if (process.env.API_MUTATE_KEY) {
    return res.status(401).json({
      success: false,
      error: "Missing authorization bearer token (API Key required)."
    });
  }
  next();
};

