// KARYAWAN-01 / token-radar-01 -- the derived launch-value model.
//
// One sealed DefiLlama snapshot goes in; one ranked board and one self-contained dashboard payload
// come out. No protocol name is ever mentioned in the scoring code: TVL, seven-day TVL change and the
// number of days DefiLlama has tracked a protocol without recording a token decide everything.
//
// Universe split
//   * a protocol whose record carries no market cap, no CoinGecko id and no symbol is PRE-TOKEN;
//   * one that carries any of them already trades, so it belongs to the live market context only;
//   * derivative/wrapped/versioned products are not launch candidates, for the same reason the
//     snapshot's own watchlist refuses them. The watchlist itself is always copied into the board.
//
// Implied launch value (USD)
//   base      = tvl_usd * 0.18
//   growth    = 1 + clamp(change_7d, -40, 80) / 100 * 0.85
//   tenure    = 0.72 + min(age_days, 1095) / 1095 * 0.38
//   implied   = max(1, round(base * growth * tenure))
//
// Assumptions, stated on the dashboard as well: every dollar of TVL is worth 18 cents of eventual
// fully diluted launch value; a 10% weekly inflow adds 8.5% to that estimate and a 10% outflow
// removes 8.5%, clipped so one anomalous week cannot dominate; each year spent running without a
// recorded token adds 38% to the estimate from a 72% floor, because more user history and more
// unissued contribution claims make a launch both more legible and more expected. Unknown listing
// dates use 365 days. These are claims of this radar, not facts from DefiLlama.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  version: string;
  base_usd_per_tvl_usd: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  growth_weight: number;
  tenure_cap_days: number;
  tenure_floor: number;
  tenure_span: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  version: 'karyawan-radar-v5',
  base_usd_per_tvl_usd: 0.18,
  growth_floor_pct: -40,
  growth_cap_pct: 80,
  growth_weight: 0.85,
  tenure_cap_days: 1095,
  tenure_floor: 0.72,
  tenure_span: 0.38,
  unknown_age_days: 365,
};

export interface FarmStep {
  title: string;
  detail: string;
  cost: string;
  time: string;
}

export interface Factors {
  base_multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  tenure_multiplier: number;
  age_days: number | null;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  mcap_usd: null;
  gecko_id: null;
  symbol: null;
  token_status: 'pre-token';
  age_days: number | null;
  on_watchlist: boolean;
  implied_value_usd: number;
  model: Factors;
  reasons: string[];
  farm_plan: FarmStep[];
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  on_watchlist: boolean;
  implied_value_usd: number;
  factors: Factors;
  reasons: string[];
  farm_plan: FarmStep[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  mcap_to_tvl: number;
}

export interface RadarStats {
  protocols: number;
  live: number;
  pre_token: number;
  launch_candidates: number;
  below_floor: number;
  watchlist: number;
  excluded_derivatives: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  stats: RadarStats;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Whole days between the snapshot date and the day DefiLlama first tracked this protocol. */
export function tokenlessDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null || !/^\d{4}-\d{2}-\d{2}$/.test(listedAt)) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The three derived multipliers and the implied launch value, from snapshot numbers alone. */
export function score(p: SnapshotProtocol, asOf: string, watchlist: boolean, model: ModelConstants = MODEL): { implied: number; factors: Factors } {
  const age = tokenlessDays(asOf, p.listed_at);
  const growthPct = clamp(p.change_7d ?? 0, model.growth_floor_pct, model.growth_cap_pct);
  const growthMultiplier = 1 + (growthPct / 100) * model.growth_weight;
  const tenureAge = age ?? model.unknown_age_days;
  const tenureMultiplier = model.tenure_floor + (clamp(tenureAge, 0, model.tenure_cap_days) / model.tenure_cap_days) * model.tenure_span;
  const implied = Math.max(1, Math.round(p.tvl_usd * model.base_usd_per_tvl_usd * growthMultiplier * tenureMultiplier));
  return {
    implied,
    factors: {
      base_multiple: model.base_usd_per_tvl_usd,
      growth_pct: round4(growthPct),
      growth_multiplier: round4(growthMultiplier),
      tenure_multiplier: round4(tenureMultiplier),
      age_days: age,
    },
  };
}

// A name ending in a release number names a pool of another product, not a fresh launch.
const VERSIONED = /\s(V\d+(?:\.\d+)?|v\d+(?:\.\d+)?|\d+\.\d+)$/;
const DERIVED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const DERIVED_CATEGORY = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Staking Pool',
  'Stablecoin Wrapper',
  'CEX',
]);

/** DefiLlama records no token at all: no market cap, no Gecko id and no ticker. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** A pre-token protocol that is not another token in disguise. */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  return (
    recordsNoToken(p) &&
    !DERIVED_CATEGORY.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !DERIVED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The category's one concrete first position, written from the record and never from a name list. */
function entryAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('allocator') || c.includes('curator')) {
    return `Deposit $${capital} of USDC into a ${n} vault or money market on ${chain} and keep the receipt.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('farm') || c.includes('liquidity')) {
    return `Provide $${capital} of two-sided liquidity in ${n}'s deepest pool on ${chain} and keep the LP position.`;
  }
  if (c.includes('bridge') || c.includes('payment')) {
    return `Move $${capital} of USDC through ${n} on ${chain}, then use the received balance once in its app.`;
  }
  if (c.includes('stak') || c.includes('restak')) {
    return `Stake $${capital} of ${chain}'s native asset through ${n} and keep the liquid receipt if one is issued.`;
  }
  if (c.includes('deriv') || c.includes('perpet') || c.includes('option') || c.includes('synthet')) {
    return `Post $${capital} of USDC as margin on ${n} and open one small, fully collateralised position.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} on ${n} and take one clearly priced market position, then leave it untouched.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${n} on ${chain} and keep the policy number as your record.`;
  }
  if (c.includes('rwa') || c.includes('stable') || c.includes('reserve')) {
    return `Mint or buy $${capital} of ${n}'s on-chain yield asset on ${chain} and hold the token in the farm wallet.`;
  }
  return `Deposit $${capital} of USDC through ${n} on ${chain} and leave the position visible in your wallet.`;
}

/** Capital and gas reserve scale with the TVL the protocol actually reports. */
function sizeOf(p: SnapshotProtocol): { capital: number; gas: number; weekly: number } {
  const capital = p.tvl_usd >= 1e9 ? 250 : p.tvl_usd >= 1e8 ? 150 : p.tvl_usd >= 5e7 ? 100 : 60;
  const first = (p.chains[0] ?? '').toLowerCase();
  const gas = first === 'ethereum' ? 24 : first === 'base' || first === 'arbitrum' || first === 'optimism' ? 8 : first === 'solana' ? 4 : 12;
  return { capital, gas, weekly: gas <= 8 ? 3 : 6 };
}

/** Young books get a longer observation window; a missing date gets the conservative one. */
function holdDays(age: number | null): number {
  if (age === null) return 60;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 28;
}

/** Six costed actions, derived from the protocol's own record. */
export function farmPlan(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = p.chains[0] ?? 'its primary chain';
  const { capital, gas, weekly } = sizeOf(p);
  const hold = holdDays(age);
  return [
    {
      title: 'Isolate the farm wallet',
      detail: `Open a fresh address for ${p.name} only. Fund it with $${capital} of stablecoins and a $${gas} gas buffer; store the recovery phrase offline.`,
      cost: `$${capital} principal + $${gas} gas`,
      time: '10 minutes',
    },
    {
      title: 'Open one real position',
      detail: `${entryAction(p, capital, chain)} Confirm the contract address from the protocol's own app before signing.`,
      cost: `$${capital} principal + $${gas} gas`,
      time: '20 minutes',
    },
    {
      title: 'Keep a weekly on-chain trace',
      detail: `Once a week, make one small deposit, swap, vote or rebalance in ${p.name}. Let at least 72 hours pass between actions so more than one daily snapshot sees activity.`,
      cost: `$${weekly} gas per week`,
      time: '10 minutes per week',
    },
    {
      title: 'Hold through two snapshot windows',
      detail: `Leave the position open for at least ${hold} days, covering two full weekly TVL measurements. Do not withdraw to chase a short-term move.`,
      cost: `the $${capital} stays deployed`,
      time: `${hold} days`,
    },
    {
      title: 'Verify the claim surface',
      detail: `Open the points or rewards page linked from ${p.name}'s own app. Record eligibility and claim only from that domain; never sign a claim sent by a stranger.`,
      cost: '$0 to check; no paid claim',
      time: '10 minutes',
    },
    {
      title: 'Unwind and log the result',
      detail: `Close the position, then write the wallet, dates, transaction hashes, gas spent and outcome in a farm log before starting another candidate.`,
      cost: `$${gas} gas to exit`,
      time: '20 minutes',
    },
  ];
}

/** The board's required string form of a step: action, cost and duration in one line. */
export function stepText(s: FarmStep): string {
  return `${s.title}. ${s.detail} Cost: ${s.cost}. Time: ${s.time}.`;
}

/** Three short, data-derived badges shown in the table. */
export function reasons(p: SnapshotProtocol, age: number | null, watchlist: boolean): string[] {
  const gate = watchlist ? 'WATCHLIST' : 'BELOW FLOOR';
  const scale = p.tvl_usd >= 1e9 ? 'SCALE $1B+' : p.tvl_usd >= 1e8 ? 'DEEP $100M+' : 'NARROW BASE';
  const g = p.change_7d;
  const flow = g === null ? 'NO 7D DATA' : g >= 5 ? 'INFLOW 7D' : g <= -5 ? 'OUTFLOW 7D' : 'FLAT 7D';
  const life = age === null ? 'AGE UNKNOWN' : age < 180 ? 'YOUNG BOOK' : age >= 730 ? 'LONG RUN' : 'SEASONED';
  return [gate, scale, flow, life];
}

/** The protocols already trading, kept apart from the ranked pre-token board. */
export function liveRows(snapshot: Snapshot, limit = 16): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p) && p.category !== 'CEX' && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd as number,
      change_7d: p.change_7d,
      mcap_to_tvl: p.tvl_usd > 0 ? round4((p.mcap_usd as number) / p.tvl_usd) : 0,
    }));
}

/** Every watchlist slug plus every eligible pre-token protocol below the house floor. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (p.tvl_usd < snapshot.floor_usd && isLaunchCandidate(p) && !chosen.has(p.slug)) chosen.set(p.slug, p);
  }
  const watch = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => ({ p, watch: watch.has(p.slug), ...score(p, snapshot.as_of, watch.has(p.slug), model) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const age = s.factors.age_days;
    const plan = farmPlan(s.p, age);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      listed_at: s.p.listed_at,
      mcap_usd: null,
      gecko_id: null,
      symbol: null,
      token_status: 'pre-token',
      age_days: age,
      on_watchlist: s.watch,
      implied_value_usd: s.implied,
      model: s.factors,
      reasons: reasons(s.p, age, s.watch),
      farm_plan: plan,
      farm_steps: plan.map(stepText),
    };
  });
}

/** Board plus everything the static page renders, from the same snapshot bytes. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const pre = snapshot.protocols.filter(recordsNoToken);
  const stats: RadarStats = {
    protocols: snapshot.protocols.length,
    live: snapshot.protocols.length - pre.length,
    pre_token: pre.length,
    launch_candidates: snapshot.protocols.filter(isLaunchCandidate).length,
    below_floor: board.filter((r) => !r.on_watchlist).length,
    watchlist: snapshot.watchlist.length,
    excluded_derivatives: pre.filter((p) => !isLaunchCandidate(p)).length,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    stats,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      on_watchlist: r.on_watchlist,
      implied_value_usd: r.implied_value_usd,
      factors: r.model,
      reasons: r.reasons,
      farm_plan: r.farm_plan,
    })),
    live: liveRows(snapshot),
  };
  return { board, radar };
}

/** Refuse a snapshot that is not the sealed shape this model reads. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot is not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot has no as_of date');
  if (typeof o.source !== 'string' || o.source.length === 0) throw new SnapshotError('snapshot has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot has no floor_usd');
  if (!Array.isArray(o.protocols) || o.protocols.length === 0) throw new SnapshotError('snapshot has no protocols');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot has no watchlist');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || p.slug.length === 0 || typeof p.name !== 'string' || p.name.length === 0) {
      throw new SnapshotError(`protocol ${i} has no slug or name`);
    }
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) throw new SnapshotError(`protocol ${i} has no TVL`);
    const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
    const str = (x: unknown): string | null => (typeof x === 'string' ? x : null);
    return {
      slug: p.slug,
      name: p.name,
      category: str(p.category),
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: num(p.change_7d),
      mcap_usd: num(p.mcap_usd),
      listed_at: str(p.listed_at),
      gecko_id: str(p.gecko_id),
      symbol: str(p.symbol),
    };
  });
  if (new Set(protocols.map((p) => p.slug)).size !== protocols.length) throw new SnapshotError('protocol slugs repeat');
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** The gate's own board rules, checked before a single byte is written. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `${missing.length} watchlist slug(s) absent`;
  if (slugs.size !== board.length) return 'slugs repeat';
  if (board.length < 100 || board.length > 4000) return `${board.length} rows outside 100..4000`;
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `rank ${i + 1} is wrong`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has an invalid implied value`;
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) return `${r.slug} breaks the value order`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} steps`;
    for (const s of r.farm_steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has an invalid step`;
  }
  if (board.length > 1 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) return 'every row has the same implied value';
  return null;
}

/** One deterministic script: the page needs no fetch, no clock and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar).replace(/</g, '\\u003c')};\n`;
}
