// Counterfactual model: sexual assaults that could have been prevented if
// bedroom consent-and-safety technology had been built and adopted after the
// 2016 patent publication. Pure functions only, so this file can be imported
// by the page and by Node's test runner.
//
// N(t) = ∫ from START to t of A × b × u(τ) × e dτ
// u(τ) ramps linearly from 0 at START to uMax at RAMP_END, then stays flat.

// ---- Assumptions: edit these ----------------------------------------------
export const CONFIG = {
  // U.S. rape/sexual assault victimizations per year, persons age 12 or older,
  // including threatened, attempted and completed. BJS, Preliminary
  // Victimization Estimates from the NCVS, 2025 (NCJ 312234, October 2026),
  // table 1: 804,180 in 2025 (preliminary; standard error 75,380).
  // The final 2024 figure from the redesigned survey is 910,530.
  A: 804180,
  A_LABEL: 'rape or sexual assault victimizations of persons age 12 or older in 2025 (preliminary estimate; the final 2024 figure was 910,530)',
  A_SOURCE_NAME: 'Bureau of Justice Statistics, Preliminary Victimization Estimates from the NCVS, 2025 (NCJ 312234, October 2026), table 1',
  A_SOURCE_URL: 'https://bjs.ojp.gov/document/pvencvs25.pdf',

  // Original provisional application, U.S. 62/099,456, filed January 3, 2015.
  PROVISIONAL_APP: 'U.S. Provisional Application No. 62/099,456',
  PROVISIONAL_FILED: '2015-01-03',

  // Later publication of U.S. Pub. No. 2016/0196735 A1. PLACEHOLDER: confirm.
  PUBLICATION_DATE: '2016-07-07',
  PUBLICATION_DATE_CONFIRMED: false,

  // When the counterfactual starts counting: the provisional filing date.
  START: '2015-01-03',

  // Lifetime cost per rape victim, 2014 dollars (CDC: Peterson et al. 2017,
  // Am J Prev Med 52(6):691–701).
  COST_PER_VICTIM_2014_USD: 122461,

  DEFAULT_PRESET: 'middle',
  PRESETS: {
    conservative: { label: 'Conservative', b: 0.5, uMax: 0.25, rampEnd: '2026-01-01', e: 0.3 },
    middle: { label: 'Middle', b: 0.7, uMax: 0.5, rampEnd: '2026-01-01', e: 0.5 },
    optimistic: { label: 'Optimistic', b: 0.8, uMax: 1.0, rampEnd: '2019-01-01', e: 0.5 },
  },
};
// ---------------------------------------------------------------------------

export const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
export const YEAR_SECONDS = YEAR_MS / 1000;

/** Parse 'YYYY-MM-DD' (or a number of ms) to UTC milliseconds. */
export function toMs(date) {
  if (typeof date === 'number') return date;
  if (date instanceof Date) return date.getTime();
  const [y, m, d] = String(date).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Full parameter set for a preset, using CONFIG for A and START. */
export function presetParams(name, config = CONFIG) {
  const p = config.PRESETS[name];
  if (!p) throw new Error(`Unknown preset: ${name}`);
  return { A: config.A, b: p.b, uMax: p.uMax, e: p.e, start: config.START, rampEnd: p.rampEnd };
}

/** Adoption fraction u(t). */
export function adoption(t, params) {
  const S = toMs(params.start), R = toMs(params.rampEnd), T = toMs(t);
  if (T <= S) return 0;
  if (R <= S || T >= R) return params.uMax;
  return params.uMax * (T - S) / (R - S);
}

/**
 * Cumulative adoption-years ∫ u(τ) dτ from START to t, in closed form.
 * A ramp end at or before START means adoption at uMax from the start.
 */
export function adoptionYears(t, params) {
  const S = toMs(params.start), R = toMs(params.rampEnd), T = toMs(t);
  if (T <= S) return 0;
  const x = (T - S) / YEAR_MS;
  if (R <= S) return params.uMax * x;
  const D = (R - S) / YEAR_MS;
  if (T <= R) return params.uMax * x * x / (2 * D);
  return params.uMax * (D / 2 + (T - R) / YEAR_MS);
}

/** N(t): estimated preventable assaults from START to t. Never negative. */
export function prevented(t, params) {
  return Math.max(0, params.A * params.b * params.e * adoptionYears(t, params));
}

/** Instantaneous rate dN/dt, per year. */
export function ratePerYear(t, params) {
  return params.A * params.b * params.e * adoption(t, params);
}

/** Instantaneous rate dN/dt, per second. */
export function ratePerSecond(t, params) {
  return ratePerYear(t, params) / YEAR_SECONDS;
}

/** Estimated averted lifetime cost, 2014 dollars. */
export function avertedCost(n, config = CONFIG) {
  return n * config.COST_PER_VICTIM_2014_USD;
}
