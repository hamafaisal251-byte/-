import { Router, Request, Response } from "express";
import { checkIPAllowlist, asyncHandler } from "../middleware/auth";
import { pgDb } from "../db";
import { encrypt, decrypt } from "../utils/crypto";
import { executeCustomConnectorEndpoint } from "../services/connectorService";

export const customConnectorsRouter = Router();

// GET /api/custom-connectors
customConnectorsRouter.get("/", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const rows = await pgDb.queryAsync("SELECT * FROM custom_connectors ORDER BY created_at DESC");
  const sanitized = (rows || []).map((row: any) => {
    const auth_config = row.auth_config || {};
    return {
      ...row,
      auth_config: {
        ...auth_config,
        apiKey: auth_config.apiKeyEnc ? "••••••••" : "",
        secretKey: auth_config.secretKeyEnc ? "••••••••" : "",
        password: auth_config.passwordEnc ? "••••••••" : ""
      }
    };
  });
  res.json({ success: true, connectors: sanitized });
}));

// POST /api/custom-connectors
customConnectorsRouter.post("/", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { id, name, type, base_url, auth_scheme, auth_config = {}, endpoints = {}, status = "DISCONNECTED" } = req.body;
  
  if (!name || !type || !base_url || !auth_scheme) {
    return res.status(400).json({ error: "Missing required connector parameters." });
  }

  // Encrypt sensitive fields if provided as raw
  if (auth_config.apiKey && !auth_config.apiKeyEnc) {
    auth_config.apiKeyEnc = encrypt(auth_config.apiKey);
    delete auth_config.apiKey;
  }
  if (auth_config.secretKey && !auth_config.secretKeyEnc) {
    auth_config.secretKeyEnc = encrypt(auth_config.secretKey);
    delete auth_config.secretKey;
  }
  if (auth_config.password && !auth_config.passwordEnc) {
    auth_config.passwordEnc = encrypt(auth_config.password);
    delete auth_config.password;
  }

  const finalId = id || `conn-custom-${Date.now()}`;

  await pgDb.queryAsync(
    `INSERT INTO custom_connectors (id, name, type, base_url, auth_scheme, auth_config, endpoints, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       base_url = EXCLUDED.base_url,
       auth_scheme = EXCLUDED.auth_scheme,
       auth_config = EXCLUDED.auth_config,
       endpoints = EXCLUDED.endpoints,
       status = EXCLUDED.status`,
    [
      finalId,
      name,
      type,
      base_url,
      auth_scheme,
      JSON.stringify(auth_config),
      JSON.stringify(endpoints),
      status
    ]
  );

  res.json({ success: true, id: finalId });
}));

// POST /api/custom-connectors/test
customConnectorsRouter.post("/test", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { base_url, auth_scheme, auth_config = {}, endpoints = {}, endpointName, variables = {} } = req.body;

  if (!base_url || !auth_scheme || !endpointName) {
    return res.status(400).json({ error: "Missing required parameters for testing connection." });
  }

  // Check for FIX, WebSockets or other unsupported APIs
  if (base_url.startsWith("ws://") || base_url.startsWith("wss://") || base_url.includes("fix://")) {
    return res.status(400).json({
      error: "This API pattern isn't supported by the generic connector — WebSockets and FIX protocols require dedicated code.",
      unsupported: true
    });
  }

  try {
    // Decrypt if some fields are encrypted, or use raw if provided
    let apiKey = auth_config.apiKey || "";
    if (auth_config.apiKeyEnc) {
      try { apiKey = decrypt(auth_config.apiKeyEnc); } catch (e) {}
    }
    let secretKey = auth_config.secretKey || "";
    if (auth_config.secretKeyEnc) {
      try { secretKey = decrypt(auth_config.secretKeyEnc); } catch (e) {}
    }
    let password = auth_config.password || "";
    if (auth_config.passwordEnc) {
      try { password = decrypt(auth_config.passwordEnc); } catch (e) {}
    }

    const testConnector = {
      base_url,
      auth_scheme,
      auth_config: {
        ...auth_config,
        apiKey,
        secretKey,
        password
      },
      endpoints
    };

    const result = await executeCustomConnectorEndpoint(testConnector, endpointName, variables);
    res.json({ success: true, result });
  } catch (err: any) {
    res.json({
      success: false,
      error: err.message,
      explanation: "This API pattern isn't supported by the generic connector — dedicated code or a different auth schema/endpoint mapping would be needed."
    });
  }
}));

// DELETE /api/custom-connectors/:id
customConnectorsRouter.delete("/:id", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  await pgDb.queryAsync("DELETE FROM custom_connectors WHERE id = $1", [req.params.id]);
  res.json({ success: true });
}));
