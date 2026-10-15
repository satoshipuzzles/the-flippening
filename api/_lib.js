// Shared fetchers and maths for the API routes. Files starting with _ are not routes on Vercel.

const NEOX = "https://neoxa.exchange/api/exchange";
const PAIR = "BTCB2_BTC"; // NeoxEX ticker for XBT
const CB = "https://api.exchange.coinbase.com/products/BTC-USD";
// Where a node of ours posts the chain tip it sees (see api/chaintip.js).
const RELAY = process.env.CHAINTIP_RELAY || "https://the-flippening.vercel.app/api/chaintip";
const UA = { "User-Agent": "flippening/1.0" };

// Last block both chains share, and its timestamp (read off mempool.space).
const SPLIT_HEIGHT = 961631;
const SPLIT_TIME = 1786217628;
const LISTED = 1788220800; // first NeoxEX daily candle, 2026-09-01

// One upstream must never be able to spend the whole function budget. Vercel
// gives a serverless function about ten seconds; mempool.guide went dark on
// 2026-10-15 (DNS and ping fine, nothing listening on 443) and every request
// sat on the old nine second timeout until the function was killed, which
// turned one dead block explorer into a dead price feed on both sites.
const SOURCE_MS = 4000;

async function get(url, kind = "json", ms = SOURCE_MS) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
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

function shape(height, tipTime, blockInterval, source) {
  return {
    height,
    tipTime,
    supply: supplyAt(height),
    blocksSinceSplit: height - SPLIT_HEIGHT,
    // average seconds between the most recent blocks
    blockInterval,
    source,
    // true when the height is worked out rather than read off a chain
    estimated: source === "estimate",
  };
}

// Last height we have actually seen on each chain, with the moment we saw it
// and the measured mean time between blocks. Used only when every live source
// for that chain is unreachable: the height is then carried forward from the
// anchor, which costs a handful of blocks of accuracy - a few hundred coins
// against a nineteen million coin supply, well under a thousandth of a percent
// of a market cap - and keeps the page showing a number instead of nothing.
const ANCHOR = {
  xbt: { height: 977392, time: 1792083006, interval: 529.6 },
  btc: { height: 971599, time: 1792082000, interval: 600.0 },
};

function estimate(chain) {
  const a = ANCHOR[chain];
  const elapsed = Math.floor(Date.now() / 1000) - a.time;
  const height = a.height + Math.max(0, Math.floor(elapsed / a.interval));
  return shape(height, a.time + (height - a.height) * Math.round(a.interval), a.interval, "estimate");
}

async function fromExplorer(base) {
  const height = Number(await get(`${base}/blocks/tip/height`, "text"));
  if (!Number.isFinite(height) || height <= 0) throw new Error(`${base} -> bad height`);
  const blocks = await get(`${base}/v1/blocks/${height}`);
  const recent = blocks.map(b => b.timestamp);
  return shape(height, recent[0], recent.length > 1
    ? (recent[0] - recent[recent.length - 1]) / (recent.length - 1) : null, base);
}

// The XBT chain has one public explorer and no second one to fall back to, so
// a snapshot pushed from a node we run is the backstop before the estimate.
async function fromRelay(chain) {
  const r = await get(`${RELAY}?chain=${chain}`, "json", 2500);
  if (!r || !Number.isFinite(r.height)) throw new Error("relay has no tip");
  if (Date.now() / 1000 - r.at > 3600) throw new Error("relay tip is stale");
  return shape(r.height, r.tipTime, r.blockInterval, "node");
}

// Never throws. A chain tip the page can draw is always worth more than an
// error, as long as the page is told which one it got.
async function tip(base, chain) {
  for (const attempt of [() => fromExplorer(base), () => fromRelay(chain)]) {
    try { return await attempt(); } catch (e) { /* try the next source */ }
  }
  return estimate(chain);
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
  const [tickR, spotR, statsR, xbtChain, btcChain] = await Promise.all([
    get(`${NEOX}/ticker/${PAIR}`).catch(e => e),
    get("https://api.coinbase.com/v2/prices/BTC-USD/spot").catch(e => e),
    get(`${CB}/stats`).catch(e => e),
    tip("https://mempool.guide/api", "xbt"),
    tip("https://mempool.space/api", "btc"),
  ]);
  // A price we cannot read is the one thing worth failing on; everything else
  // degrades to a stated fallback rather than taking the whole payload down.
  if (tickR instanceof Error) throw tickR;
  if (spotR instanceof Error) throw spotR;
  const tick = tickR, spot = spotR;
  const stats = statsR instanceof Error ? {} : statsR;
  const degraded = [];
  if (statsR instanceof Error) degraded.push("Coinbase 24h stats");
  if (xbtChain.source !== "https://mempool.guide/api") degraded.push(`XBT chain height (${xbtChain.source})`);
  if (btcChain.source !== "https://mempool.space/api") degraded.push(`ShaT chain height (${btcChain.source})`);
  const t = tick.ticker;
  return {
    at: Date.now(),
    degraded,
    split: { height: SPLIT_HEIGHT, time: SPLIT_TIME },
    btc: {
      usd: Number(spot.data.amount),
      open24h: stats.open == null ? null : Number(stats.open),
      high24h: stats.high == null ? null : Number(stats.high),
      low24h: stats.low == null ? null : Number(stats.low),
      volume24h: stats.volume == null ? null : Number(stats.volume), // in BTC, Coinbase only
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

module.exports = { get, supplyAt, tip, estimate, cbCandles, xbtCandles, quote, send, SPLIT_HEIGHT, SPLIT_TIME, LISTED };
