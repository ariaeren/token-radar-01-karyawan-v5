# Method — KARYAWAN token radar v5

## What is being ranked

The sealed snapshot carries 758 DefiLlama protocols. 416 records carry a market cap, a CoinGecko id or a ticker: their tokens already trade, so the dashboard shows the largest 16 as **market context only** and gives them no launch-value estimate. The remaining 342 records carry no token at all. Of those, 198 are launch candidates: versioned pools, wrapped / staked / bridged derivatives, exchange products and category-level bridges are removed, for the same reason the snapshot's own 40-name watchlist removes them.

The board ranks all 198 candidates: the 40 watchlist slugs plus 158 discoveries below the $50m house floor. The watchlist is a floor, not a ceiling. No protocol name appears in the scoring code; every row comes from the same function of its own record.

## Implied launch value

```
growth  = 1 + clamp(change_7d, -40, 80) / 100 * 0.85
tenure  = 0.72 + min(age_days, 1095) / 1095 * 0.38
base    = tvl_usd * 0.18
implied = max(1, round(base * growth * tenure))
```

`age_days` is the whole-day distance from the snapshot date to DefiLlama's first-tracked date; a protocol with no listed date uses 365 days. The page recomputes and displays these three factors in every detail view. Rank is implied value descending, with slug as a deterministic tie-break.

Assumptions, stated plainly: one dollar of TVL is worth 18 cents of eventual launch FDV; a 10% weekly TVL move changes that by 8.5%, with clipping so a single abnormal week cannot decide the board; a year without a recorded token adds 38% to the estimate from a 72% floor, because a longer tokenless run means more accumulated users and contribution claims. These are the radar's claims, not DefiLlama figures, and they are not a prediction of any announcement.

## Signals and farm plans

The four chips in each row are derived, never authored: watchlist or below-floor; scale from TVL; inflow, flat or outflow from seven-day change; and young, seasoned, long-run or unknown from tokenless age. Each row's six-step plan is also derived from its own category, primary chain, TVL and age: a capital tier, a chain-specific gas reserve, one concrete first position, a weekly on-chain cadence, a hold that spans two weekly snapshots, an official claim-surface check and a logged exit. Cost and duration are attached to every step and shown in the detail view.

## Page and determinism

`index.html`, `app.css`, `app.js` and this note are the whole page: no framework, no fetch, no clock and no network address. `main.ts` writes the same derived rows to `data.js`, so the screenshots and `board.json` cannot disagree. Filters, sorting, the live-token tab and the per-protocol detail view are all encoded in the URL hash, which is how the three screenshots were captured from the rendered page. Both runs of the program produce byte-identical `board.json` and `data.js`, and the headless renderer produces byte-identical JPEGs.
