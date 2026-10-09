// The Flippening: iPhone home screen widget for Scriptable (free on the App Store).
// Paste into a new Scriptable script, then add a Scriptable widget (small or medium) and pick this script.
// Live data from https://the-flippening.vercel.app

const SITE = "https://the-flippening.vercel.app";
const GOLD = new Color("#D4AF37"), BG = new Color("#0d1117"), INK = new Color("#e6edf3"), MUTED = new Color("#8b95a5");
const UP = new Color("#16c784"), DOWN = new Color("#ea3943"), TRACK = new Color("#222a35");

const s = await new Request(SITE + "/api/summary").loadJSON();
const size = config.widgetFamily || "medium";
const w = new ListWidget();
w.backgroundColor = BG;
w.url = SITE;
w.setPadding(14, 14, 14, 14);
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
const pct = (v) => (v >= 0 ? "▲" : "▼") + Math.abs(v).toFixed(1) + "%";

async function logo(path) { try { return await new Request(SITE + path).loadImage(); } catch (e) { return null; } }
const [xbtImg, shatImg] = await Promise.all([logo("/img/xbt.png"), logo("/img/shat.png")]);

// header
const head = w.addStack(); head.centerAlignContent();
if (xbtImg) { const i = head.addImage(xbtImg); i.imageSize = new Size(16, 16); head.addSpacer(5); }
const t = head.addText("Flippening"); t.font = Font.boldSystemFont(13); t.textColor = INK;
w.addSpacer(6);

// ratio
const r = w.addText(s.ratio.toFixed(2) + "%"); r.font = Font.heavySystemFont(size === "small" ? 30 : 34); r.textColor = GOLD;
const cap = w.addText("XBT as a share of ShaT Coin"); cap.font = Font.systemFont(11); cap.textColor = MUTED;
w.addSpacer(6);

// progress bar
const width = size === "small" ? 130 : 300;
const dc = new DrawContext(); dc.size = new Size(width, 8); dc.opaque = false; dc.respectScreenScale = true;
const track = new Path(); track.addRoundedRect(new Rect(0, 0, width, 8), 4, 4); dc.addPath(track); dc.setFillColor(TRACK); dc.fillPath();
const fill = new Path(); fill.addRoundedRect(new Rect(0, 0, Math.max(4, width * Math.min(100, s.ratio) / 100), 8), 4, 4); dc.addPath(fill); dc.setFillColor(GOLD); dc.fillPath();
w.addImage(dc.getImage());
const m = w.addText(s.flipMultiple.toFixed(1) + "× to flip"); m.font = Font.systemFont(11); m.textColor = MUTED;

if (size !== "small") {
  w.addSpacer(8);
  for (const [img, name, v] of [[xbtImg, "Bitcoin XBT", s.xbt], [shatImg, "ShaT Coin BTC", s.shat]]) {
    const row = w.addStack(); row.centerAlignContent();
    if (img) { const i = row.addImage(img); i.imageSize = new Size(16, 16); row.addSpacer(6); }
    const n = row.addText(name); n.font = Font.systemFont(13); n.textColor = INK;
    row.addSpacer();
    const p = row.addText(usd(v.usd) + "  "); p.font = Font.boldSystemFont(13); p.textColor = INK;
    const c = row.addText(pct(v.change24h)); c.font = Font.semiboldSystemFont(12); c.textColor = v.change24h >= 0 ? UP : DOWN;
    w.addSpacer(3);
  }
}

if (config.runsInWidget) Script.setWidget(w);
else await (size === "small" ? w.presentSmall() : w.presentMedium());
Script.complete();
