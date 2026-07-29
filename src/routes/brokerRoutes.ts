import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pgDb, addServerLog, fixEngine } from "../../server";
import { checkIPAllowlist, asyncHandler } from "../middleware/auth";
import { encrypt, decrypt } from "../services/encryption";

export const brokerRouter = Router();

// GET /api/brokers/connections
brokerRouter.get("/connections", (req: Request, res: Response) => {
  const rawConns = pgDb.query("SELECT * FROM broker_connections") || [];
  
  // Sanitize and mask secrets
  const sanitized = rawConns.map((c: any) => {
    let maskedToken = "";
    if (c.apiTokenEnc) {
      const decrypted = decrypt(c.apiTokenEnc);
      maskedToken = decrypted.length > 4 ? "••••••••" + decrypted.slice(-4) : "••••";
    }

    let maskedSecret = "";
    if (c.secretKeyEnc) {
      const decrypted = decrypt(c.secretKeyEnc);
      maskedSecret = decrypted.length > 4 ? "••••••••" + decrypted.slice(-4) : "";
    }

    return {
      id: c.id,
      brokerType: c.brokerType,
      apiUrl: c.apiUrl,
      accountId: c.accountId,
      status: c.status,
      lastTestedTime: c.lastTestedTime,
      errorMessage: c.error_message,
      targetCompId: c.targetCompId,
      senderCompId: c.senderCompId,
      environment: c.environment || 'DEMO_LIVE',
      maskedToken,
      maskedSecret
    };
  });
  res.json({ success: true, connections: sanitized });
});

// POST /api/brokers/connect
brokerRouter.post("/connect", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { brokerType, apiUrl, accountId, apiToken, secretKey, passphrase, targetCompId, senderCompId, environment } = req.body;

  if (!brokerType || !accountId || (!apiToken && !secretKey)) {
    return res.status(400).json({ error: "تکایە هەموو زانیارییەکان بنێرە بۆ گرێدان بە برۆکەر" });
  }

  addServerLog("RISK-MANAGER", "INFO", `تاقیکردنەوەی گرێدانی نوێ لەگەڵ برۆکەری: ${brokerType}...`);

  try {
    let isValid = false;
    let errorMsg = "";

    const tokenLower = (apiToken || "").toLowerCase();
    const secretLower = (secretKey || "").toLowerCase();
    const isDemo = tokenLower.includes("demo") || tokenLower.includes("test") || tokenLower.includes("simulated") ||
                  secretLower.includes("demo") || secretLower.includes("test") || secretLower.includes("simulated") ||
                  accountId.toLowerCase().includes("sandbox") || accountId.toLowerCase().includes("demo") ||
                  apiToken === "SIMULATED-SOVEREIGN-KEY";

    const finalEnv = environment || (isDemo ? "DEMO_LIVE" : "REAL_LIVE");

    if (isDemo) {
      isValid = true;
      addServerLog("RISK-MANAGER", "SUCCESS", `گرێدانی دێمۆ پەسەندکرا بۆ بڕۆکەری: ${brokerType.toUpperCase()}`);
    } else {
      // Real API validation calls
      if (brokerType === "oanda") {
        const urlToTest = `${apiUrl.replace(/\/$/, "")}/accounts`;
        const testResponse = await fetch(urlToTest, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          }
        });
        if (testResponse.ok) {
          isValid = true;
        } else {
          const errText = await testResponse.text();
          errorMsg = `OANDA Validation Failed: ${testResponse.status} - ${errText}`;
        }
      } else if (brokerType === "binance") {
        try {
          const timestamp = Date.now();
          const queryString = `timestamp=${timestamp}`;
          const signature = crypto.createHmac("sha256", secretKey).update(queryString).digest("hex");
          const testUrl = `${apiUrl || "https://api.binance.com"}/api/v3/account?${queryString}&signature=${signature}`;
          
          const testResponse = await fetch(testUrl, {
            method: "GET",
            headers: { "X-MBX-APIKEY": apiToken }
          });
          if (testResponse.ok) {
            isValid = true;
          } else {
            const errText = await testResponse.text();
            errorMsg = `Binance API Validation Failed: ${testResponse.status} - ${errText}`;
          }
        } catch (e: any) {
          errorMsg = `Binance API Error: ${e.message}`;
        }
      } else if (brokerType === "coinbase") {
        try {
          const method = "GET";
          const path = "/api/v3/brokerage/accounts";
          const cbTimestamp = Math.floor(Date.now() / 1000).toString();
          const message = cbTimestamp + method + path;
          const cbSignature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
          const cbUrl = `${apiUrl || "https://api.coinbase.com"}${path}`;
          
          const testResponse = await fetch(cbUrl, {
            method: "GET",
            headers: {
              "CB-ACCESS-KEY": apiToken,
              "CB-ACCESS-SIGN": cbSignature,
              "CB-ACCESS-TIMESTAMP": cbTimestamp,
              "Content-Type": "application/json"
            }
          });
          if (testResponse.ok) {
            isValid = true;
          } else {
            const errText = await testResponse.text();
            errorMsg = `Coinbase Advanced API Validation Failed: ${testResponse.status} - ${errText}`;
          }
        } catch (e: any) {
          errorMsg = `Coinbase API Error: ${e.message}`;
        }
      } else if (brokerType === "kraken") {
        try {
          const krakenPath = "/0/private/Balance";
          const nonce = Date.now().toString();
          const postData = `nonce=${nonce}`;
          const krakenHash = crypto.createHash("sha256").update(nonce + postData).digest("binary" as any);
          const krakenSecretDecoded = Buffer.from(secretKey, "base64");
          const krakenSignature = crypto.createHmac("sha512", krakenSecretDecoded)
            .update(krakenPath + krakenHash, "binary" as any)
            .digest("base64");
          const krakenUrl = `${apiUrl || "https://api.kraken.com"}${krakenPath}`;
          
          const testResponse = await fetch(krakenUrl, {
            method: "POST",
            headers: {
              "API-Key": apiToken,
              "API-Sign": krakenSignature,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: postData
          });
          if (testResponse.ok) {
            isValid = true;
          } else {
            const errText = await testResponse.text();
            errorMsg = `Kraken API Validation Failed: ${testResponse.status} - ${errText}`;
          }
        } catch (e: any) {
          errorMsg = `Kraken API Error: ${e.message}`;
        }
      } else if (brokerType === "metatrader5") {
        const testUrl = `${apiUrl.replace(/\/$/, "")}/api/account/summary`;
        const testResponse = await fetch(testUrl, {
          headers: { "Authorization": `Bearer ${apiToken}` }
        }).catch(() => null);
        
        if (testResponse && testResponse.ok) {
          isValid = true;
        } else {
          errorMsg = "MT4/MT5 REST WebAPI bridge unreachable or unauthorized.";
        }
      } else if (brokerType === "ib") {
        const testUrl = `${apiUrl || "https://localhost:29191"}/v1/api/portfolio/accounts`;
        const testResponse = await fetch(testUrl, {
          headers: { "Authorization": `Bearer ${apiToken}` }
        }).catch(() => null);
        
        if (testResponse && testResponse.ok) {
          isValid = true;
        } else {
          errorMsg = "Interactive Brokers local TWS Gateway/Client Portal unreachable.";
        }
      } else if (brokerType === "fix_gateway") {
        isValid = true; 
        fixEngine.configureSession(targetCompId, senderCompId);
        fixEngine.logon();
      } else {
        const customRows = await pgDb.queryAsync("SELECT * FROM custom_connectors WHERE id = $1 OR name = $2", [brokerType, brokerType]);
        if (customRows && customRows.length > 0) {
          isValid = true;
        } else {
          errorMsg = `برۆکەری نەناسراو یان کێشەی گرێدان: ${brokerType}`;
        }
      }
    }

    if (!isValid) {
      throw new Error(errorMsg || "ناسنامەی برۆکەر یان ناونیشان هەڵەیە.");
    }

    // Encrypt sensitive credential tokens using AES-256-CBC
    const apiTokenEnc = apiToken ? encrypt(apiToken) : "";
    const secretKeyEnc = secretKey ? encrypt(secretKey) : "";
    const passphraseEnc = passphrase ? encrypt(passphrase) : "";

    const record = pgDb.query(
      `INSERT INTO broker_connections (id, broker_type, api_url, account_id, api_token_encrypted, secret_key_encrypted, passphrase_encrypted, target_comp_id, sender_comp_id, status, last_tested_time, error_message, environment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        `conn-${brokerType}-${Date.now()}`,
        brokerType,
        apiUrl || "",
        accountId,
        apiTokenEnc,
        secretKeyEnc,
        passphraseEnc,
        targetCompId || "",
        senderCompId || "",
        "CONNECTED",
        new Date().toISOString(),
        "",
        finalEnv
      ]
    );

    addServerLog("RISK-MANAGER", "SUCCESS", `گرێدانی بڕۆکەری ${brokerType.toUpperCase()} بە سەرکەوتوویی لەگەڵ داتابەیس بەسترا (AES-256 encrypted).`);
    res.json({ success: true, connection: record });
  } catch (err: any) {
    console.error("[BROKER-CONNECT-ERROR]", err);
    addServerLog("RISK-MANAGER", "CRITICAL", `هەڵە لە لێکۆڵینەوەی برۆکەری ${brokerType}: ${err.message}`);
    res.status(400).json({ success: false, error: err.message || "ناتوانرێت بەستەر دروستبکرێت بەهۆی نەگونجاوی لایەنی دڵنیایی." });
  }
}));

// POST /api/brokers/disconnect
brokerRouter.post("/disconnect", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { brokerType, accountId } = req.body;
  if (!brokerType || !accountId) {
    return res.status(400).json({ error: "Broker type and Account ID are required." });
  }

  pgDb.query("DELETE FROM broker_connections WHERE broker_type = $1 AND account_id = $2", [brokerType, accountId]);
  
  if (brokerType === "fix_gateway") {
    fixEngine.logout();
  }

  addServerLog("RISK-MANAGER", "INFO", `گرێدانی پۆرتفۆلیۆی بڕۆکەری ${brokerType.toUpperCase()} پچڕێندرا.`);
  res.json({ success: true });
}));
