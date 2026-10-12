# The Flippening

A market-cap tracker for the two chains that came out of the Bitcoin split of
8 August 2026: **Bitcoin (XBT)**, the BLAKE2b / BIP-110 chain, and **ShaT Coin
(BTC)**, the SHA-256d chain. Live at **[the-flippening.vercel.app](https://the-flippening.vercel.app)**.

## What it does

- Both market caps side by side, with the ratio and how far XBT has to move
- The full top 100 by market cap, with XBT merged in and ShaT Coin named honestly
- Price history that stitches the shared pre-split history to post-split trading
- A 30-second explainer video, a PWA, an iPhone home-screen widget, and embeds

## Where the numbers come from

| | |
|---|---|
| XBT price | NeoxEX `BTCB2_BTC` order book, converted at the Coinbase BTC price |
| ShaT price | Coinbase `BTC-USD` |
| ShaT 24h volume | CoinGecko, across all exchanges |
| Block heights | mempool.guide (XBT), mempool.space (ShaT) |
| Top 100 | CoinGecko |
| Pre-split history | `data/prefork.json`, Coinbase daily candles to block 961,631 |

**Circulating supply** is computed, not fetched: `supplyAt(height)` in
`api/_lib.js` walks the halving schedule in 210,000-block epochs and sums
`blocks × subsidy` to the current tip. That is *issued* supply — it does not
subtract the ~128 coins lost to underpaid coinbases and the BIP-30 duplicates,
and it does not subtract lost coins. Both chains share every one of those
discrepancies, since they all predate the split, so they cancel exactly in the
ratio. No API key is needed for anything here.

## Running it

```bash
npm install
node dev.js      # http://127.0.0.1:8811
```

`dev.js` serves the static files and the `api/` functions the way Vercel does.
Deploy with `vercel --prod`.

## Layout

```
index.html      the site: flippening view and the top 100
media.html      media kit: logos, the video, embed codes
widget.html     the compact ticker, also the embed
api/            Vercel functions (_lib.js is shared, not a route)
brand/          logos as hand-drawn SVG plus PNG exports
data/           pre-split price history
scripts/        one-off builders
scriptable.js   iPhone home-screen widget
```

## Embeds

```html
<!-- top 100 -->
<iframe src="https://the-flippening.vercel.app/top-embed?embed=1"
        width="100%" height="520" style="border:0;border-radius:12px"></iframe>

<!-- compact ticker -->
<iframe src="https://the-flippening.vercel.app/widget?embed=1"
        width="360" height="190" style="border:0;border-radius:12px"></iframe>
```

Add `&theme=dark` or `&theme=light` to pin a theme; otherwise they follow the
visitor's setting.

## Licence

MIT, see [LICENSE](LICENSE). The logos in `brand/` are free to use. The Tether
mark is Tether's and is not included.
