import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG, YEAR_MS, toMs, presetParams, adoption, adoptionYears,
  prevented, ratePerYear, ratePerSecond, avertedCost, sinceContact, earlierParams,
} from './model.js';

const close = (a, b, rel = 1e-9) =>
  assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);

const middle = presetParams('middle');

test('zero at and before START', () => {
  const S = toMs(CONFIG.START);
  for (const p of ['conservative', 'middle', 'optimistic']) {
    const params = presetParams(p);
    assert.equal(prevented(S, params), 0);
    assert.equal(prevented(S - 1, params), 0);
    assert.equal(prevented(toMs('2010-06-01'), params), 0);
    assert.equal(ratePerYear(S - 1, params), 0);
  }
});

test('ramp integral matches numeric integration', () => {
  // Trapezoid rule on the instantaneous rate, during and after the ramp.
  for (const t of ['2020-03-15', '2026-01-01', '2026-11-07', '2030-01-01']) {
    for (const p of ['conservative', 'middle', 'optimistic']) {
      const params = presetParams(p);
      const S = toMs(params.start), T = toMs(t), steps = 20000;
      const h = (T - S) / steps;
      let sum = 0;
      for (let i = 0; i < steps; i++) {
        sum += (ratePerYear(S + i * h, params) + ratePerYear(S + (i + 1) * h, params)) / 2 * (h / YEAR_MS);
      }
      close(prevented(T, params), sum, 1e-6);
    }
  }
});

test('ramp closed form: half of full-adoption area at RAMP_END', () => {
  // At RAMP_END the area under a linear ramp is uMax × D / 2.
  const D = (toMs(middle.rampEnd) - toMs(middle.start)) / YEAR_MS;
  close(adoptionYears(middle.rampEnd, middle), middle.uMax * D / 2);
});

test('continuous in value and slope at RAMP_END', () => {
  const R = toMs(middle.rampEnd), eps = 1000; // one second
  close(prevented(R - eps, middle), prevented(R + eps, middle), 1e-6);
  close(ratePerYear(R - 1, middle), ratePerYear(R + 1, middle), 1e-6);
  close(adoption(R, middle), middle.uMax);
});

test('preset values', () => {
  assert.deepEqual(
    { ...presetParams('conservative') },
    { A: CONFIG.A, d: 0.4, b: 0.5, uMax: 0.25, e: 0.3, start: CONFIG.START, rampEnd: '2026-01-01' },
  );
  assert.deepEqual(
    { ...presetParams('middle') },
    { A: CONFIG.A, d: 0.5, b: 0.7, uMax: 0.5, e: 0.5, start: CONFIG.START, rampEnd: '2026-01-01' },
  );
  assert.deepEqual(
    { ...presetParams('optimistic') },
    { A: CONFIG.A, d: 0.6, b: 0.8, uMax: 1.0, e: 0.5, start: CONFIG.START, rampEnd: '2019-01-01' },
  );
  assert.equal(CONFIG.DEFAULT_PRESET, 'middle');
  assert.throws(() => presetParams('nope'));
});

test('post-ramp rate is A × d × b × uMax × e per year', () => {
  const t = toMs('2027-06-01');
  close(ratePerYear(t, middle), CONFIG.A * 0.5 * 0.7 * 0.5 * 0.5);
  close(ratePerSecond(t, middle) * (YEAR_MS / 1000), CONFIG.A * 0.5 * 0.7 * 0.5 * 0.5);
});

test('monotonic, non-decreasing over time', () => {
  for (const p of ['conservative', 'middle', 'optimistic']) {
    const params = presetParams(p);
    let prev = -Infinity;
    for (let t = toMs('2016-01-01'); t <= toMs('2035-01-01'); t += 3 * 24 * 3600 * 1000) {
      const n = prevented(t, params);
      assert.ok(n >= prev, `${p} decreased at ${new Date(t).toISOString()}`);
      prev = n;
    }
  }
});

test('ramp end at or before START means full adoption from START', () => {
  const params = { ...middle, rampEnd: CONFIG.START };
  const t = toMs('2018-01-01');
  close(prevented(t, params), CONFIG.A * 0.5 * 0.7 * 0.5 * 0.5 * ((t - toMs(CONFIG.START)) / YEAR_MS));
});

test('sanity: Middle total in late 2026 matches a hand calculation', () => {
  // Ramp Jan 3, 2015 to Jan 1, 2026 (~11 years), then ~0.85 years flat:
  // A × 0.5 × 0.7 × 0.5 × 0.5 × (11/2 + 0.85).
  const n = prevented('2026-11-07', middle);
  const expected = CONFIG.A * 0.5 * 0.7 * 0.5 * 0.5 * (11 / 2 + 0.85);
  assert.ok(Math.abs(n - expected) / expected < 0.01, `${n} vs ${expected}`);
});

test('counting starts at the provisional filing date', () => {
  assert.equal(CONFIG.START, CONFIG.PROVISIONAL_FILED);
  assert.equal(CONFIG.START, '2015-01-03');
});

test('date share narrows the count', () => {
  const t = toMs('2027-06-01');
  close(prevented(t, middle), prevented(t, { ...middle, d: 1 }) * 0.5);
  assert.ok(CONFIG.PRESETS.optimistic.d <= 0.72, 'd stays under the 72% known-offender ceiling');
});

test('averted cost uses the per-victim figure', () => {
  assert.equal(avertedCost(10), 10 * 122461);
});

test('contact clocks start at zero and run at the current rate', () => {
  const since = '2026-11-11T15:10:00Z';
  assert.equal(sinceContact(since, since, middle), 0);
  assert.equal(sinceContact(since, toMs(since) - 1000, middle), 0, 'never negative before contact');
  const day = toMs(since) + YEAR_MS / 365.25;
  close(sinceContact(since, day, middle), ratePerYear(day, middle) / 365.25);
});

test('contacts parse to real times', () => {
  for (const c of CONFIG.CONTACTS) {
    assert.ok(Number.isFinite(toMs(c.since)), c.label);
    assert.ok(toMs(c.since) > toMs(CONFIG.START), c.label);
  }
});

test('second count: same factors, earlier start', () => {
  assert.equal(CONFIG.EARLIER_START, '2004-02-12');
  assert.ok(toMs(CONFIG.EARLIER_START) < toMs(CONFIG.START));
  for (const p of ['conservative', 'middle', 'optimistic']) {
    const params = presetParams(p), early = earlierParams(params);
    assert.deepEqual({ ...early, start: params.start }, { ...params }, 'only the start differs');
    assert.equal(prevented(CONFIG.EARLIER_START, early), 0);
    assert.equal(prevented(toMs(CONFIG.EARLIER_START) - 1, early), 0);
    for (const t of ['2010-06-01', '2015-01-03', '2020-03-15', '2026-11-16', '2030-01-01']) {
      assert.ok(prevented(t, early) >= prevented(t, params), `${p} at ${t}`);
    }
    // Once both ramps have peaked, the two counts rise at the same rate.
    close(ratePerYear('2027-06-01', early), ratePerYear('2027-06-01', params));
  }
});

test('second count: closed form and hand calculation', () => {
  const early = earlierParams(middle);
  // Ramp Feb 12, 2004 to Jan 1, 2026, then flat to Nov 16, 2026.
  const D = (toMs(early.rampEnd) - toMs(early.start)) / YEAR_MS;
  const flat = (toMs('2026-11-16') - toMs(early.rampEnd)) / YEAR_MS;
  close(prevented('2026-11-16', early), CONFIG.A * 0.5 * 0.7 * 0.5 * 0.5 * (D / 2 + flat));
  // Mid-ramp: A × d × b × e × uMax × x² ÷ (2D).
  const x = (toMs('2015-01-03') - toMs(early.start)) / YEAR_MS;
  close(prevented('2015-01-03', early), CONFIG.A * 0.5 * 0.7 * 0.5 * 0.5 * x * x / (2 * D));
});
