// Small, flat numbers for the phone widget, Scriptable and the share image.
const { quote, xbtCandles, send } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const [q, xh] = await Promise.all([quote(), xbtCandles("1h", 200)]);
    const X = q.xbt, B = q.btc;
    const xUsd = X.btc * B.usd, xmc = xUsd * X.chain.supply, bmc = B.usd * B.chain.supply;
    const ratioNow = xmc / bmc * 100;
    const supplyRatio = X.chain.supply / B.chain.supply;
    const spark = xh.slice(-168).map(c => +(c.close * supplyRatio * 100).toFixed(4)); // flippening % over 7 days
    const xb24 = X.btc / (1 + X.changePct24h / 100);
    send(res, 200, {
      at: q.at,
      ratio: ratioNow,
      ratio24hAgo: xb24 * supplyRatio * 100,
      flipMultiple: (bmc / X.chain.supply / B.usd) / X.btc,
      xbt: { usd: xUsd, btc: X.btc, marketCap: xmc, change24h: (xUsd / (xb24 * B.open24h) - 1) * 100 },
      shat: { usd: B.usd, marketCap: bmc, change24h: (B.usd / B.open24h - 1) * 100 },
      spark,
    });
  } catch (e) {
    send(res, 502, { error: String(e.message || e) }, 5);
  }
};
