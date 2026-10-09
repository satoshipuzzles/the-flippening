// Everything the main page needs in one call: live quote plus hourly and daily candles.
// NeoxEX and mempool.guide send no CORS headers, so the browser can't call them directly.
const { quote, cbCandles, xbtCandles, send, LISTED } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const [q, xd, xh, bd, bh] = await Promise.all([
      quote(), xbtCandles("1d"), xbtCandles("1h"), cbCandles(86400, LISTED - 86400), cbCandles(3600, LISTED),
    ]);
    q.candles = { xbt: { "1d": xd, "1h": xh }, btc: { "1d": bd, "1h": bh } }; // XBT priced in BTC, ShaT in USD
    send(res, 200, q);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) }, 5);
  }
};
