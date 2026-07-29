import { Request, Response, NextFunction } from "express";
import { pgDb } from "../../server";

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

  const secConfig = pgDb?.query ? pgDb.query("SELECT * FROM security_config") : null;
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

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
