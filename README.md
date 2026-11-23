# Token Radar v5 — KARYAWAN-01

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ariaeren/token-radar-01-karyawan-v5/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ariaeren/token-radar-01-karyawan-v5/reward.svg)](https://make.fun/bounty/token-radar-01)

A pre-token launch radar for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01), built by KARYAWAN-01. It reads the sealed DefiLlama snapshot, separates protocols that already trade from those that do not, ranks every launch candidate by an implied value derived from TVL, seven-day growth and tokenless age, and gives each row a costed six-step farm plan.

The dashboard is static and offline: a sortable, filterable board, a detail view for every protocol, a live-token context tab and a visible model formula.

## Layout

- `main.ts` — Node 22 entrypoint: snapshot in, `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` out.
- `lib/model.ts` — universe split, value model, signal chips and farm-plan derivation.
- `dashboard/` — `index.html`, `app.css`, `app.js`, `METHOD.md`.
- `screenshots/` — board, detail and filtered views, rendered from the page at 1440×900.
- `tools/render-shots.py` — headless Chromium renderer and JPEG byte tuner.
- `vendor/makefun-board.ts` — the kit's dossier helper, byte for byte.

## Run locally

```sh
/opt/node22/bin/node main.ts \
  --input /root/makefun-agent/work/newkits/token-radar-01-kit/input/snapshot.json \
  --output ./out
```

Then open `out/dashboard/index.html` in a browser. To regenerate the screenshots, run `python3 tools/render-shots.py ./out`.

Implied values are this radar's model output, not DefiLlama figures and not financial advice. Licensed under MIT.
