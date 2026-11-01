import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleAt, scoreValue, findPeaks, fillGaps, analyzeSession, detectView, detectShootingHand,
} from '../src/analysis.js';
import { demoShooting, demoDribbling } from '../src/demo.js';
import { summaryHtml, standaloneHtml } from '../src/summary.js';

test('angleAt computes interior angles', () => {
  assert.equal(Math.round(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })), 90);
  assert.equal(Math.round(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })), 180);
  assert.equal(angleAt(null, { x: 0, y: 0 }, { x: 1, y: 0 }), null);
});

test('scoreValue is 100 in range and decays outside', () => {
  assert.equal(scoreValue(120, [110, 145], 30), 100);
  assert.equal(scoreValue(175, [110, 145], 30), 40);
  assert.equal(scoreValue(300, [110, 145], 30), 0);
  assert.equal(scoreValue(null, [0, 1], 1), null);
});

test('findPeaks respects height and gap', () => {
  const s = [0, 1, 0, 0, 3, 0, 2.5, 0, 0, 0, 2, 0];
  assert.deepEqual(findPeaks(s, { minHeight: 2, minGap: 3, radius: 1 }), [4, 10]);
});

test('fillGaps interpolates short gaps only', () => {
  assert.deepEqual(fillGaps([0, null, 2], 2), [0, 1, 2]);
  assert.deepEqual(fillGaps([0, null, null, null, 4], 2), [0, null, null, null, 4]);
});

test('shooting demo: detects all shots, view and hand', () => {
  const { frames } = demoShooting();
  assert.equal(detectView(frames), 'side');
  assert.equal(detectShootingHand(frames), 'right');
  const s = analyzeSession(frames, { mode: 'shooting' });
  assert.ok(!s.error, s.error);
  assert.equal(s.reps.length, 4);
  for (const r of s.reps) {
    const [load, set, release] = r.events;
    assert.ok(load.t <= set.t && set.t <= release.t, 'events are ordered');
    assert.ok(r.metrics.releaseAngle.value > 40 && r.metrics.releaseAngle.value < 85);
    assert.ok(r.metrics.kneeLoad.value > 110 && r.metrics.kneeLoad.value < 170);
  }
  // Shot 2 is built with stiffer legs and a flatter release than shot 1.
  assert.ok(s.reps[1].metrics.kneeLoad.value > s.reps[0].metrics.kneeLoad.value + 15);
  assert.ok(s.reps[1].metrics.releaseAngle.value < s.reps[0].metrics.releaseAngle.value - 10);
  assert.ok(s.summary.overall > 0 && s.summary.overall <= 100);
  assert.ok(s.summary.consistency != null);
  assert.ok(s.summary.focus.length > 0, 'gives at least one suggestion');
  assert.equal(s.summary.plan.length, 5);
});

test('dribbling demo: counts dribbles and scores stance', () => {
  const { frames } = demoDribbling();
  const s = analyzeSession(frames, { mode: 'dribbling' });
  assert.ok(!s.error, s.error);
  assert.equal(s.view, 'front');
  const rep = s.reps[0];
  // ~2.4 dribbles/s over 8 s
  assert.ok(rep.dribbleCount >= 15 && rep.dribbleCount <= 23, `count ${rep.dribbleCount}`);
  assert.ok(Math.abs(rep.metrics.dribbleRate.value - 2.4) < 0.5);
  assert.ok(rep.metrics.stanceWidth);
  assert.ok(!rep.metrics.trunkLean, 'side-only metric skipped in front view');
});

test('empty or person-less video returns a friendly error', () => {
  const frames = Array.from({ length: 50 }, (_, i) => ({ t: i / 15, lm: null }));
  assert.match(analyzeSession(frames, { mode: 'shooting' }).error, /Could not find a player/);
});

test('static report renders with all sections', () => {
  const s = analyzeSession(demoShooting().frames, { mode: 'shooting' });
  const html = summaryHtml(s);
  for (const part of ['Focus areas', 'Strengths', 'Metrics', '5-day practice plan', 'Score by shot']) {
    assert.ok(html.includes(part), part);
  }
  const doc = standaloneHtml(s, { title: 'test <clip>' });
  assert.ok(doc.startsWith('<!doctype html>'));
  assert.ok(doc.includes('test &lt;clip&gt;'), 'escapes user text');
});
