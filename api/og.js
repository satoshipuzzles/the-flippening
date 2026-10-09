// Share preview image (1200x630) with live numbers: /api/og
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children } });
const img = (src, size) => ({ type: "img", props: { src, width: size, height: size, style: { width: size, height: size } } });
const big = (v) => v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : "$" + (v / 1e6).toFixed(1) + "M";
// "ShaT Coin" with the Tether logo as its T
const shat = (origin, size, color, rest = "") => h("div", { alignItems: "center", color }, "Sha", { type: "img", props: { src: origin + "/img/tether.png", width: Math.round(size * 0.82 * 200 / 164), height: Math.round(size * 0.82), style: { margin: `0 ${Math.round(size * 0.28)}px 0 2px` } } }, "Coin" + rest);
const usd = (v) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 });
const chg = (v) => ({ text: (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(2) + "% 24h", color: v >= 0 ? "#16c784" : "#ea3943" });

const FONT = (w) => `https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-${w}-normal.woff`;

export async function render(origin) {
  const [s, f4, f7, f8] = await Promise.all([
    fetch(origin + "/api/summary").then(r => r.json()),
    ...[400, 700, 800].map(w => fetch(FONT(w)).then(r => r.arrayBuffer())),
  ]);
  const fonts = [[f4, 400], [f7, 700], [f8, 800]].map(([data, weight]) => ({ name: "Inter", data, weight, style: "normal" }));
  const GOLD = "#D4AF37", MUTED = "#8b95a5";
  const coin = (logo, name, tk, sub, price, mc, c, subLogo) => h("div", { flexDirection: "column", gap: 6, flex: 1, background: "#161b22", borderRadius: 20, padding: "22px 26px" },
    h("div", { alignItems: "center", gap: 14 }, img(origin + logo, 52),
      h("div", { flexDirection: "column" }, h("div", { fontSize: 30, fontWeight: 700, color: "#e6edf3", alignItems: "center", gap: 10 }, typeof name === "string" ? `${name} ${tk}` : name, typeof name === "string" ? "" : tk), h("div", { fontSize: 20, color: MUTED, alignItems: "center", gap: 8 }, sub, ...(subLogo ? [img(origin + subLogo, 22)] : [])))),
    h("div", { alignItems: "baseline", gap: 14, marginTop: 8 }, h("div", { fontSize: 40, fontWeight: 700, color: "#e6edf3" }, usd(price)), h("div", { fontSize: 24, color: chg(c).color }, chg(c).text)),
    h("div", { fontSize: 22, color: MUTED }, `Market cap ${big(mc)}`));
  return new ImageResponse(
    h("div", { width: "100%", height: "100%", flexDirection: "column", background: "#0d1117", padding: "48px 56px", fontFamily: "Inter", color: "#e6edf3" },
      h("div", { alignItems: "center", justifyContent: "space-between" },
        h("div", { alignItems: "center", gap: 16 }, img(origin + "/img/xbt.png", 56), h("div", { fontSize: 40, fontWeight: 800 }, "The Flippening")),
        h("div", { fontSize: 24, color: MUTED }, "the-flippening.vercel.app")),
      h("div", { alignItems: "baseline", gap: 18, marginTop: 30 },
        h("div", { fontSize: 96, fontWeight: 800, color: GOLD }, s.ratio.toFixed(2) + "%"),
        h("div", { fontSize: 34, color: "#e6edf3", alignItems: "center", gap: 10 }, "XBT is worth this much of", shat(origin, 34, "#e6edf3"))),
      h("div", { width: "100%", height: 26, background: "#222a35", borderRadius: 13, marginTop: 6 },
        h("div", { width: Math.max(0.8, Math.min(100, s.ratio)) + "%", height: 26, background: GOLD, borderRadius: 13 })),
      h("div", { fontSize: 24, color: MUTED, marginTop: 10, alignItems: "center", gap: 8 }, `XBT has to rise ${s.flipMultiple.toFixed(1)}× to flip`, shat(origin, 24, MUTED)),
      h("div", { gap: 24, marginTop: 30 },
        coin("/img/xbt.png", "Bitcoin", "XBT", "BLAKE2b", s.xbt.usd, s.xbt.marketCap, s.xbt.change24h),
        coin("/img/shat.png", shat(origin, 30, "#e6edf3"), "BTC", "SHA-256d · powered by Tether", s.shat.usd, s.shat.marketCap, s.shat.change24h, "/img/tether.png"))),
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}

export default async function handler(req) {
  return render(new URL(req.url).origin);
}
