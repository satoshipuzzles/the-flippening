// Top 100 coins by market cap from CoinGecko (free API), trimmed for the page. XBT is merged in client-side.
const { get, send } = require("./_lib");

const thin = (arr, n) => arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.round(i * (arr.length - 1) / (n - 1))]);

module.exports = async (req, res) => {
  try {
    const rows = await get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d");
    const coins = rows.map(c => ({
      id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, image: c.image.replace("/large/", "/small/"),
      price: c.current_price, marketCap: c.market_cap, volume: c.total_volume, supply: c.circulating_supply,
      h1: c.price_change_percentage_1h_in_currency, d1: c.price_change_percentage_24h_in_currency, d7: c.price_change_percentage_7d_in_currency,
      spark: thin((c.sparkline_in_7d && c.sparkline_in_7d.price) || [], 56).map(v => +v.toPrecision(6)),
    }));
    send(res, 200, { at: Date.now(), source: "CoinGecko", coins }, 120);
  } catch (e) {
    send(res, 502, { error: String(e.message || e) }, 30);
  }
};
