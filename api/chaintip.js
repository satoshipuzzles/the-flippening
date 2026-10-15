// Chain tip relay.
//
// POST (with the x-push-key header) stores the tip a node of ours is seeing.
// GET  ?chain=xbt|btc returns it.
//
// The XBT chain has exactly one public explorer, mempool.guide, and when it
// went dark on 2026-10-15 there was nothing else to ask - the whole price feed
// went with it. This endpoint is the second source: a node we run posts its own
// height every minute, so an explorer outage costs precision, not the page.
//
// Nothing here can reach the node. It is a one-way drop box for five numbers.
//
// Storage is a small JSON blob replaced on every push, held in memory and
// mirrored to /tmp so it survives a cold handler on a warm instance. A pushed
// tip that never arrives is not a failure: _lib.js falls through to an
// estimate carried forward from its anchor.

const fs = require("fs");
const path = require("path");

const FILE = path.join("/tmp", "chaintip.json");
const CHAINS = ["xbt", "btc"];
const MAX_BYTES = 4096;
let memory = null;

function read() {
  if (memory) return memory;
  try { memory = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { memory = {}; }
  return memory;
}

function write(obj) {
  memory = obj;
  try {
    fs.writeFileSync(FILE + ".tmp", JSON.stringify(obj));
    fs.renameSync(FILE + ".tmp", FILE);
  } catch (e) {
    // memory alone is fine for the life of this instance
  }
}

function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BYTES) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-push-key");
    return res.status(204).end();
  }

  if (req.method === "POST") {
    const key = process.env.PUSH_KEY;
    if (!key) return res.status(503).json({ error: "no push key configured" });
    if (req.headers["x-push-key"] !== key) return res.status(401).json({ error: "bad key" });
    let p;
    try { p = JSON.parse(await body(req)); } catch (e) { return res.status(400).json({ error: "bad json" }); }
    const chain = String(p.chain || "");
    if (!CHAINS.includes(chain)) return res.status(400).json({ error: "unknown chain" });
    if (!Number.isFinite(p.height) || p.height <= 0) return res.status(400).json({ error: "bad height" });
    const all = read();
    all[chain] = {
      chain,
      height: Math.floor(p.height),
      tipTime: Number.isFinite(p.tipTime) ? Math.floor(p.tipTime) : null,
      blockInterval: Number.isFinite(p.blockInterval) ? p.blockInterval : null,
      at: Math.floor(Date.now() / 1000),
    };
    write(all);
    return res.status(200).json({ ok: true, ...all[chain] });
  }

  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  const all = read();
  const chain = String((req.query && req.query.chain) || "");
  if (!chain) return res.status(200).json(all);
  const got = all[chain];
  if (!got) return res.status(404).json({ error: "no tip for that chain yet" });
  return res.status(200).json(got);
};
