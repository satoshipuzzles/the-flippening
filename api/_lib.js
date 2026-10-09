// Shared fetchers and maths for the API routes. Files starting with _ are not routes on Vercel.

const NEOX = "https://neoxa.exchange/api/exchange";
const PAIR = "BTCB2_BTC"; // NeoxEX ticker for XBT
const CB = "https://api.exchange.coinbase.com/products/BTC-USD";
const UA = { "User-Agent": "flippening/1.0" };

// Last block both chains share, and its timestamp (read off mempool.space).
const SPLIT_HEIGHT = 961631;
const SPLIT_TIME = 1786217628;
const LISTED = 1788220800; // first NeoxEX daily candle, 2026-09-01

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
  const recent = blocks.map(b => b.timestamp);
  return {
    height,
    tipTime: recent[0],
    supply: supplyAt(height),
    blocksSinceSplit: height - SPLIT_HEIGHT,
    // average seconds between the most recent blocks
    blockInterval: recent.length > 1 ? (recent[0] - recent[recent.length - 1]) / (recent.length - 1) : null,
  };
}

// Coinbase returns at most 300 candles per call, newest first.
async function cbCandles(gran, startSec) {
  const now = Math.floor(Date.now() / 1000), jobs = [];
  for (let s = startSec; s < now; s += gran * 300) {
    const e = Math.min(now, s + gran * 300);
    jobs.push(get(`${CB}/candles?granularity=${gran}&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`));
  }
  const seen = new Map();
  for (const rows of await Promise.all(jobs)) for (const [t, lo, hi, op, cl, vol] of rows) seen.set(t, { time: t, open: op, high: hi, low: lo, close: cl, volume: vol });
  return [...seen.values()].sort((a, b) => a.time - b.time);
}

const xbtCandles = async (interval, limit = 1000) => (await get(`${NEOX}/candles/${PAIR}?interval=${interval}&limit=${limit}`)).candles;

async function quote() {
  const [tick, spot, stats, xbtChain, btcChain] = await Promise.all([
    get(`${NEOX}/ticker/${PAIR}`),
    get("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
    get(`${CB}/stats`),
    tip("https://mempool.guide/api"),
    tip("https://mempool.space/api"),
  ]);
  const t = tick.ticker;
  return {
    at: Date.now(),
    split: { height: SPLIT_HEIGHT, time: SPLIT_TIME },
    btc: {
      usd: Number(spot.data.amount),
      open24h: Number(stats.open),
      high24h: Number(stats.high),
      low24h: Number(stats.low),
      volume24h: Number(stats.volume), // in BTC, Coinbase only
      chain: btcChain,
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
      chain: xbtChain,
      source: "NeoxEX BTCB2/BTC",
    },
  };
}

function send(res, status, body, maxAge = 20) {
  res.setHeader("Cache-Control", `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 3}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(body);
}

module.exports = { get, supplyAt, tip, cbCandles, xbtCandles, quote, send, SPLIT_HEIGHT, SPLIT_TIME, LISTED };
