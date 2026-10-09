// One-off: Bitcoin's USD price history up to the chain split, which both chains share.
// Writes data/prefork.json. The data before the split never changes, so it's built once.
const fs = require("fs");
const SPLIT_TIME = 1786217628; // block 961,631, last shared block
const CB = "https://api.exchange.coinbase.com/products/BTC-USD/candles";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function range(gran, start, end) {
  const out = new Map();
  for (let s = start; s < end; s += gran * 300) {
    const e = Math.min(end, s + gran * 300);
    const url = `${CB}?granularity=${gran}&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    const r = await fetch(url, { headers: { "User-Agent": "flippening/1.0" } });
    if (!r.ok) throw new Error(url + " " + r.status);
    for (const [t, lo, hi, op, cl] of await r.json()) out.set(t, { time: t, open: op, high: hi, low: lo, close: cl });
    await sleep(150);
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

(async () => {
  const dayStart = Math.floor(SPLIT_TIME / 86400) * 86400;
  const daily = (await range(86400, Date.UTC(2015, 6, 20) / 1000, dayStart)).filter(c => c.time < dayStart);
  const hourStart = Math.floor(SPLIT_TIME / 3600) * 3600;
  const hourly = (await range(3600, hourStart - 30 * 86400, hourStart + 3600)).filter(c => c.time <= hourStart);
  // close out the split day from the hourly candles so the daily series runs right up to the split
  const tail = hourly.filter(c => c.time >= dayStart);
  if (tail.length) daily.push({ time: dayStart, open: tail[0].open, high: Math.max(...tail.map(c => c.high)), low: Math.min(...tail.map(c => c.low)), close: tail[tail.length - 1].close });
  const round = (c) => ({ time: c.time, open: +c.open.toFixed(2), high: +c.high.toFixed(2), low: +c.low.toFixed(2), close: +c.close.toFixed(2) });
  fs.writeFileSync(__dirname + "/../data/prefork.json", JSON.stringify({ splitTime: SPLIT_TIME, source: "Coinbase BTC-USD", "1d": daily.map(round), "1h": hourly.map(round) }));
  const ath = daily.reduce((m, c) => c.high > m.high ? c : m);
  const jan1 = daily.find(c => c.time === Date.UTC(2026, 0, 1) / 1000);
  console.log("daily", daily.length, new Date(daily[0].time * 1000).toISOString(), "hourly", hourly.length,
    "last close", daily[daily.length - 1].close, "ATH", ath.high, new Date(ath.time * 1000).toISOString().slice(0, 10), "jan1 open", jan1 && jan1.open);
})();
