// One endpoint that gathers everything the page needs, server side.
// NeoxEX and mempool.guide send no CORS headers, so the browser can't call them directly.

const NEOX = "https://neoxa.exchange/api/exchange";
const PAIR = "BTCB2_BTC"; // NeoxEX ticker for XBT
const CB = "https://api.exchange.coinbase.com/products/BTC-USD";
const UA = { "User-Agent": "flippening/1.0" };

// Last block both chains share, and its timestamp (read off mempool.space).
const SPLIT_HEIGHT = 961631;
const SPLIT_TIME = 1786217628;

async function get(url, kind = "json") {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return kind === "json" ? r.json() : r.text();
}

// Coins issued through block `h` (genesis included), standard halving schedule.
function supplyAt(h) {
  let total = 0, sub = 50e8, from = 0;
  while (from <= h && sub > 0) {
    const to = Math.min(h, from + 209999);
    total += (to - from + 1) * sub;
    from += 210000;
    sub = Math.floor(sub / 2);
  }
  return total / 1e8;
}

async function tip(base) {
  const height = Number(await get(`${base}/blocks/tip/height`, "text"));
  const blocks = await get(`${base}/v1/blocks/${height}`);
  return { height, time: blocks[0].timestamp, recent: blocks.map(b => b.timestamp) };
}

// Coinbase returns at most 300 candles per call, newest first.
async function cbCandles(gran, startSec) {
  const out = [];
  const step = gran * 300;
  const now = Math.floor(Date.now() / 1000);
  const jobs = [];
  for (let s = startSec; s < now; s += step) {
    const e = Math.min(now, s + step);
    jobs.push(get(`${CB}/candles?granularity=${gran}&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`));
  }
  for (const rows of await Promise.all(jobs)) for (const [t, lo, hi, op, cl, vol] of rows) out.push({ time: t, open: op, high: hi, low: lo, close: cl, volume: vol });
  const seen = new Map(out.map(c => [c.time, c]));
  return [...seen.values()].sort((a, b) => a.time - b.time);
}

module.exports = async (req, res) => {
  try {
    const listed = 1788220800; // first NeoxEX daily candle, 2026-09-01
    const [tick, xd, xh, spot, stats, bd, bh, xbtTip, btcTip] = await Promise.all([
      get(`${NEOX}/ticker/${PAIR}`),
      get(`${NEOX}/candles/${PAIR}?interval=1d&limit=1000`),
      get(`${NEOX}/candles/${PAIR}?interval=1h&limit=1000`),
      get("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
      get(`${CB}/stats`),
      cbCandles(86400, listed - 86400),
      cbCandles(3600, listed),
      tip("https://mempool.guide/api"),
      tip("https://mempool.space/api"),
    ]);

    const t = tick.ticker;
    const btcUsd = Number(spot.data.amount);
    const chain = (tp) => ({
      height: tp.height,
      tipTime: tp.time,
      supply: supplyAt(tp.height),
      blocksSinceSplit: tp.height - SPLIT_HEIGHT,
      // average seconds between the last ten blocks
      blockInterval: tp.recent.length > 1 ? (tp.recent[0] - tp.recent[tp.recent.length - 1]) / (tp.recent.length - 1) : null,
    });

    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
    res.status(200).json({
      at: Date.now(),
      split: { height: SPLIT_HEIGHT, time: SPLIT_TIME },
      btc: {
        usd: btcUsd,
        open24h: Number(stats.open),
        high24h: Number(stats.high),
        low24h: Number(stats.low),
        volume24h: Number(stats.volume), // in BTC, Coinbase only
        chain: chain(btcTip),
        source: "Coinbase BTC-USD",
      },
      xbt: {
        btc: t.lastPrice,
        changePct24h: t.changePercent,
        high24h: t.high24h,
        low24h: t.low24h,
        volume24h: t.volume24h, // in XBT
        quoteVolume24h: t.quoteVolume24h, // in BTC
        trades24h: t.trades24h,
        bid: t.bestBid,
        ask: t.bestAsk,
        chain: chain(xbtTip),
        source: "NeoxEX BTCB2/BTC",
      },
      candles: {
        xbt: { "1d": xd.candles, "1h": xh.candles }, // priced in BTC
        btc: { "1d": bd, "1h": bh }, // priced in USD
      },
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
