import { Router, Request, Response } from "express";
import crypto from "crypto";
import { checkIPAllowlist } from "../middleware/auth";
import { pgDb } from "../db";
import { addServerLog } from "../services/logging";
import { DYNAMIC_SERVER_MUTATE_KEY } from "../utils/crypto";

export const securityRouter = Router();

// GET /api/security/info
securityRouter.get("/info", (req: Request, res: Response) => {
  const secConfig = pgDb.query("SELECT * FROM security_config") || {};
  const currentKey = process.env.API_MUTATE_KEY || secConfig.api_mutate_key || DYNAMIC_SERVER_MUTATE_KEY;
  const maskedKey = currentKey.length > 4 ? "••••••••" + currentKey.slice(-4) : "••••";
  
  res.json({
    success: true,
    hsmEncryptionStandard: "AES-256-CBC At Rest",
    isMasterKeyConfigured: !!process.env.MASTER_ENCRYPTION_KEY,
    allowedIps: secConfig.allowed_ips || ["127.0.0.1"],
    maskedMutateKey: maskedKey,
    lastRotationTime: new Date().toISOString()
  });
});

// POST /api/security/rotate
securityRouter.post("/rotate", checkIPAllowlist, (req: Request, res: Response) => {
  const newKey = "SOV-MUTATE-" + crypto.randomBytes(12).toString("hex").toUpperCase();
  process.env.API_MUTATE_KEY = newKey;
  
  const secConfig = pgDb.query("SELECT * FROM security_config") || {};
  pgDb.query("UPDATE security_config", [newKey, secConfig.allowed_ips || ["127.0.0.1", "::1"]]);
  
  addServerLog("GO-BACKPLANE", "SUCCESS", `[SECURITY] Key rotation triggered. New internal mutate key configured: ••••••••${newKey.slice(-4)}`);
  res.json({ success: true, newMaskedKey: "••••••••" + newKey.slice(-4) });
});

// POST /api/security/allowlist
securityRouter.post("/allowlist", checkIPAllowlist, (req: Request, res: Response) => {
  const { ips } = req.body;
  if (!Array.isArray(ips)) {
    return res.status(400).json({ error: "IPS list must be a string array." });
  }

  const secConfig = pgDb.query("SELECT * FROM security_config") || {};
  pgDb.query("UPDATE security_config", [secConfig.api_mutate_key, ips]);
  
  addServerLog("GO-BACKPLANE", "SUCCESS", `[SECURITY] IP Whitelist updated. Allowed ranges count: ${ips.length}`);
  res.json({ success: true, allowedIps: ips });
});
