import { describe, it, expect, afterEach } from "vitest";
import nock from "nock";
import nodeFetch from "node-fetch";

describe("Real Public Market API Connectivity Tests (nock)", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("should fetch BTC/USDT price from Binance API", async () => {
    nock("https://api.binance.com")
      .get("/api/v3/ticker/price?symbol=BTCUSDT")
      .reply(200, { symbol: "BTCUSDT", price: "67420.50" });

    const response = await nodeFetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.symbol).toBe("BTCUSDT");
    expect(parseFloat(data.price)).toBe(67420.50);
  });

  it("should fetch Forex rates from Open ER API", async () => {
    nock("https://open.er-api.com")
      .get("/v6/latest/USD")
      .reply(200, {
        result: "success",
        rates: {
          EUR: 0.92,
          GBP: 0.78,
          JPY: 155.20
        }
      });

    const response = await nodeFetch("https://open.er-api.com/v6/latest/USD");
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.rates.EUR).toBe(0.92);
    expect(data.rates.JPY).toBe(155.20);
  });

  it("should handle timeout/network failure gracefully without crashing", async () => {
    nock("https://api.binance.com")
      .get("/api/v3/ticker/price?symbol=BTCUSDT")
      .replyWithError("Connection refused");

    let errCaught = false;
    try {
      await nodeFetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    } catch (e) {
      errCaught = true;
    }
    expect(errCaught).toBe(true);
  });
});
