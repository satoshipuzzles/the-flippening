// Intraday candles on demand: /api/candles?tf=1m|5m|15m
const { cbCandles, xbtCandles, send } = require("./_lib");
const TF = { "1m": 60, "5m": 300, "15m": 900 };

module.exports = async (req, res) => {
  const tf = new URL(req.url, "http://x").searchParams.get("tf");
  if (!TF[tf]) return send(res, 400, { error: "tf must be 1m, 5m or 15m" });
  try {
    const xbt = await xbtCandles(tf);
    const from = xbt.length ? xbt[0].time : Math.floor(Date.now() / 1000) - TF[tf] * 1000;
    const btc = await cbCandles(TF[tf], from);
    send(res, 200, { tf, xbt, btc }, tf === "1m" ? 15 : 30);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) }, 5);
  }
};
