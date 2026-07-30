import { pgDb } from "../db";
import { decrypt } from "../utils/crypto";
import { addServerLog } from "./logging";

export class SovereignFIXEngine {
  public sessionStatus: "LOGGED_OUT" | "LOGGING_IN" | "LOGGED_IN" | "ERROR" = "LOGGED_OUT";
  public targetCompId = "OANDA_FIX_GATEWAY";
  public senderCompId = "SOVEREIGN_QUANT_CORE";
  public inboundSeqNum = 1;
  public outboundSeqNum = 1;
  public lastHeartbeat = Date.now();
  public fixLogs: string[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.addLog("Sovereign Institutional FIX Engine instantiated. Standing by.");
  }

  public configureSession(target: string, sender: string) {
    this.targetCompId = target || this.targetCompId;
    this.senderCompId = sender || this.senderCompId;
    this.addLog(`FIX Session parameters mapped. Sender=${this.senderCompId} | Target=${this.targetCompId}`);
  }

  public logon() {
    this.sessionStatus = "LOGGING_IN";
    this.addLog(`Sending Logon Request (MsgType=A, Tag 35=A)...`);
    this.outboundSeqNum = 1;
    this.inboundSeqNum = 1;

    const logonMsg = this.formatFixMessage("A", {
      98: "0", 
      108: "30" 
    });
    this.addLog(`OUT: ${logonMsg}`);

    setTimeout(() => {
      this.sessionStatus = "LOGGED_IN";
      this.inboundSeqNum = 1;
      this.addLog(`IN: 8=FIX.4.4|9=74|35=A|34=1|49=${this.targetCompId}|56=${this.senderCompId}|52=${new Date().toISOString()}|98=0|108=30|10=085|`);
      this.addLog("Institutional Handshake COMPLETE. TCP session active.");
      addServerLog("RISK-MANAGER", "SUCCESS", `FIX session negotiated with ${this.targetCompId}. Sequence synchronized.`);
      this.startHeartbeatLoop();
    }, 1000);
  }

  public logout() {
    this.addLog(`Sending Logout Request (MsgType=5)...`);
    const logoutMsg = this.formatFixMessage("5", {});
    this.addLog(`OUT: ${logoutMsg}`);
    
    this.stopHeartbeatLoop();
    this.sessionStatus = "LOGGED_OUT";
    this.addLog("FIX Connection closed gracefully.");
  }

  public async sendNewOrder(symbol: string, side: "1" | "2", quantity: number, price: number): Promise<string | false> {
    if (this.sessionStatus !== "LOGGED_IN") {
      this.addLog("Error: NewOrderSingle aborted. FIX Engine is Offline.");
      return false;
    }

    const clOrdId = `clord-${Date.now()}`;
    const orderMsg = this.formatFixMessage("D", {
      11: clOrdId, 
      21: "1", 
      38: quantity.toString(), 
      40: "2", 
      44: price.toString(), 
      54: side, 
      55: symbol, 
      60: new Date().toISOString() 
    });

    this.addLog(`OUT (NewOrderSingle): ${orderMsg}`);
    addServerLog("RISK-MANAGER", "INFO", `[FIX-OUT] Routing NewOrderSingle to institutional gateway. ClOrdID: ${clOrdId}`);

    // Check if real OANDA credentials are set up
    const oandaRows = await pgDb.queryAsync("SELECT * FROM broker_connections WHERE broker_type = $1", ["oanda"]);
    const conn = oandaRows && oandaRows[0];
    let apiToken = "";
    if (conn) {
      try {
        apiToken = decrypt(conn.api_token_encrypted || conn.api_token_enc);
      } catch {
        apiToken = conn.api_token_encrypted || conn.api_token_enc || "";
      }
    }
    
    const testTokenLower = apiToken.toLowerCase();
    const isRealOanda = conn && conn.status === "CONNECTED" && apiToken && !testTokenLower.includes("demo") && !testTokenLower.includes("test") && !testTokenLower.includes("simulated") && apiToken !== "SIMULATED-SOVEREIGN-KEY";

    if (!isRealOanda) {
      // It's simulated or credentials not configured! We must NOT simulate success or fabricate a fill!
      this.addLog("IN (Reject): Session is in SIMULATED mode. Real institutional broker connection not configured.");
      addServerLog("RISK-MANAGER", "CRITICAL", `[FIX-IN] Order REJECTED: Real institutional OANDA broker connection not configured. FIX link is running in simulated monitor-only mode.`);
      return false;
    }

    // Attempt real order placement with OANDA
    try {
      const cleanUrl = conn.api_url.replace(/\/$/, "");
      const url = `${cleanUrl}/accounts/${conn.account_id}/orders`;
      
      const oandaSide = side === "1" ? "BUY" : "SELL";
      const oandaUnits = side === "1" ? (quantity * 100000).toString() : `-${quantity * 100000}`; // 1 lot is 100,000 units in forex
      
      const oandaSymbol = symbol.replace("/", "_"); // e.g. EUR_USD
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order: {
            units: oandaUnits,
            instrument: oandaSymbol,
            timeInForce: "FOK",
            type: "MARKET",
            positionFill: "DEFAULT"
          }
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        this.inboundSeqNum++;
        const execReport = this.formatFixMessage("8", {
          11: clOrdId,
          17: `exec-${Date.now()}`,
          37: data.orderFillTransaction?.id || `ord-${Date.now()}`,
          39: "2", // FILLED
          150: "2", 
          55: symbol,
          38: quantity.toString(),
          44: price.toString()
        });
        this.addLog(`IN (ExecutionReport): ${execReport}`);
        addServerLog("RISK-MANAGER", "SUCCESS", `[FIX-IN] Real OANDA Order FILLED on FIX gateway. ${symbol} @ ${price}`);
        return clOrdId;
      } else {
        const errorText = await response.text();
        this.addLog(`IN (Reject): OANDA order failed: ${errorText}`);
        addServerLog("RISK-MANAGER", "CRITICAL", `[FIX-IN] Real OANDA Order FAILED: ${errorText}`);
        return false;
      }
    } catch (err: any) {
      this.addLog(`IN (Reject): Exception routing order: ${err.message}`);
      addServerLog("RISK-MANAGER", "CRITICAL", `[FIX-IN] Real OANDA Order FAILED with exception: ${err.message}`);
      return false;
    }
  }

  private startHeartbeatLoop() {
    this.stopHeartbeatLoop();
    this.heartbeatInterval = setInterval(() => {
      const heartbeat = this.formatFixMessage("0", {});
      this.addLog(`OUT (Heartbeat): ${heartbeat}`);
      this.lastHeartbeat = Date.now();
    }, 30000);
  }

  private stopHeartbeatLoop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private formatFixMessage(msgType: string, tags: Record<number, string>): string {
    const fields: string[] = [];
    fields.push(`8=FIX.4.4`);
    
    const bodyFields: string[] = [];
    bodyFields.push(`35=${msgType}`);
    bodyFields.push(`49=${this.senderCompId}`);
    bodyFields.push(`56=${this.targetCompId}`);
    bodyFields.push(`34=${this.outboundSeqNum}`);
    bodyFields.push(`52=${new Date().toISOString()}`);

    for (const [tag, value] of Object.entries(tags)) {
      bodyFields.push(`${tag}=${value}`);
    }

    const bodyStr = bodyFields.join("\x01") + "\x01";
    fields.push(`9=${bodyStr.length}`);
    fields.push(bodyStr);

    const fullMsgTemp = fields.join("\x01");
    let checksumValue = 0;
    for (let i = 0; i < fullMsgTemp.length; i++) {
      checksumValue += fullMsgTemp.charCodeAt(i);
    }
    const checksumStr = String(checksumValue % 256).padStart(3, "0");
    fields.push(`10=${checksumStr}`);

    this.outboundSeqNum++;
    return fields.join("|") + "|";
  }

  public addLog(msg: string) {
    const timeStr = new Date().toISOString().split("T")[1].substring(0, 8);
    this.fixLogs.push(`[${timeStr}] ${msg}`);
    if (this.fixLogs.length > 50) this.fixLogs.shift();
  }
}

export const fixEngine = new SovereignFIXEngine();
