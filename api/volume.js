// 24-hour trading volume over time: XBT on NeoxEX (its only market) vs ShaT across all exchanges (CoinGecko).
const { get, xbtCandles, cbCandles, send, LISTED } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const days = Math.ceil((Date.now() / 1000 - LISTED) / 86400) + 2;
    const [cg, xh, bh] = await Promise.all([
      get(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`),
      xbtCandles("1h"),
      cbCandles(3600, LISTED),
    ]);
    // XBT: rolling 24 h sum of hourly quote volume (BTC) priced at each hour's ShaT/USD close
    const usdAt = new Map(bh.map(c => [c.time, c.close]));
    let lastUsd = bh.length ? bh[0].close : null;
    const hourly = xh.map(c => { lastUsd = usdAt.get(c.time) || lastUsd; return { time: c.time, usd: c.volume * c.close * lastUsd }; });
    // hours with no trades have no candle, so the window is by time, not by count
    const xbt = [];
    let sum = 0, lo = 0;
    for (let i = 0; i < hourly.length; i++) {
      sum += hourly[i].usd;
      const end = hourly[i].time + 3600;
      while (hourly[lo].time < end - 86400) sum -= hourly[lo++].usd;
      if (end - hourly[0].time >= 86400) xbt.push({ time: end, value: sum });
    }
    const shat = cg.total_volumes.map(([ms, v]) => ({ time: Math.floor(ms / 1000), value: v })).filter(p => p.time >= LISTED);
    send(res, 200, { xbt, shat, sources: { xbt: "NeoxEX BTCB2/BTC", shat: "CoinGecko, all exchanges" } }, 600);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) }, 30);
  }
};
