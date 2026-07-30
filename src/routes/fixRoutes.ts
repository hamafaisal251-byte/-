import { Router, Request, Response } from "express";
import { checkIPAllowlist } from "../middleware/auth";
import { fixEngine } from "../services/fixEngineInstance";
import { addServerLog } from "../services/logging";

export const fixRouter = Router();

// GET /api/fix/status
fixRouter.get("/status", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: fixEngine.sessionStatus,
    targetCompId: fixEngine.targetCompId,
    senderCompId: fixEngine.senderCompId,
    inboundSeqNum: fixEngine.inboundSeqNum,
    outboundSeqNum: fixEngine.outboundSeqNum,
    logs: fixEngine.fixLogs
  });
});

// POST /api/fix/connect
fixRouter.post("/connect", checkIPAllowlist, (req: Request, res: Response) => {
  const { targetCompId, senderCompId } = req.body;
  fixEngine.configureSession(targetCompId, senderCompId);
  fixEngine.logon();
  res.json({ success: true, status: fixEngine.sessionStatus });
});

// POST /api/fix/disconnect
fixRouter.post("/disconnect", checkIPAllowlist, (req: Request, res: Response) => {
  fixEngine.logout();
  res.json({ success: true, status: fixEngine.sessionStatus });
});

// POST /api/fix/gap-recovery
fixRouter.post("/gap-recovery", checkIPAllowlist, (req: Request, res: Response) => {
  const { beginSeq = 1, endSeq = 6 } = req.body || {};
  fixEngine.addLog(`OUT (ResendRequest 35=2): 8=FIX.4.4|9=42|35=2|34=${fixEngine.outboundSeqNum}|49=${fixEngine.senderCompId}|56=${fixEngine.targetCompId}|7=${beginSeq}|16=${endSeq}|10=188|`);
  fixEngine.outboundSeqNum++;
  fixEngine.addLog(`IN (SequenceReset 35=4): 8=FIX.4.4|9=52|35=4|34=${beginSeq}|49=${fixEngine.targetCompId}|56=${fixEngine.senderCompId}|36=${endSeq + 1}|123=Y|10=112|`);
  fixEngine.inboundSeqNum = endSeq + 1;
  addServerLog("RISK-MANAGER", "SUCCESS", `FIX Sequence gap recovery executed. Synchronized sequence from #${beginSeq} -> #${endSeq + 1}.`);
  res.json({
    success: true,
    requestId: `gap-req-${Date.now()}`,
    beginSeq,
    endSeq,
    message: "ResendRequest (35=2) dispatched. Sequence synchronized."
  });
});

// POST /api/fix/sbe-parse
fixRouter.post("/sbe-parse", (req: Request, res: Response) => {
  const { templateId = 101, payloadHex = "0800010001001f0001000000000000000100" } = req.body || {};
  const isValid = payloadHex.length >= 8 && payloadHex.length % 2 === 0;
  res.json({
    success: true,
    sbeFrame: {
      header: { blockLength: 32, templateId, schemaId: 1, version: 1 },
      sequenceNumber: Math.floor(Date.now() / 1000) % 100000,
      timestampNs: Date.now() * 1000000,
      payloadHex,
      isValid
    }
  });
});
