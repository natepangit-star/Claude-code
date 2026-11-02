import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleAt, scoreValue, findPeaks, fillGaps, analyzeSession, detectView, detectShootingHand, heightFromFlight,
} from '../src/analysis.js';
import { demoShooting, demoDribbling, demoJump } from '../src/demo.js';
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

test('heightFromFlight matches projectile physics', () => {
  // 0.6 s in the air ≈ 44 cm
  assert.equal(Math.round(heightFromFlight(0.6)), 44);
  assert.equal(heightFromFlight(0), null);
});

test('jump demo: measures each jump height within 3 cm from flight time', () => {
  const d = demoJump();
  const s = analyzeSession(d.frames, { mode: 'jump', jumpType: 'standing', heightCm: 185 });
  assert.ok(!s.error, s.error);
  assert.equal(s.reps.length, 3);
  const truth = [52, 41, 49];
  s.reps.forEach((r, i) => {
    assert.ok(Math.abs(r.height - truth[i]) < 3, `jump ${i + 1}: ${r.height.toFixed(1)} vs ${truth[i]}`);
    const types = r.events.map((e) => e.type);
    assert.deepEqual(types, ['bottom', 'takeoff', 'peak', 'landing', 'absorb']);
    assert.ok(r.events.every((e, k) => k === 0 || e.t >= r.events[k - 1].t), 'events ordered');
    // Hip-rise cross-check agrees roughly with flight-time height.
    assert.ok(Math.abs(r.metrics.hipRise.value - r.height) < 10);
  });
  const P = s.summary.performance;
  assert.equal(Math.round(P.best), Math.round(s.reps[0].height));
  assert.equal(P.reach, Math.round(185 * 1.33));
  assert.ok(P.reachEstimated);
  assert.ok(Math.abs(P.toDunk - (320 - P.maxTouch)) < 1e-9);
  // Jump 2 has a shallow dip and weak arms; jump 3 a stiff landing.
  const issues = s.summary.focus.map((f) => f.key);
  assert.ok(issues.includes('armDrive'), issues.join());
  assert.ok(issues.includes('loadDepth') || issues.includes('hipHinge'), issues.join());
  assert.ok(s.reps[2].metrics.landingFlex.score < 80);
  assert.ok(s.summary.plan.some((d) => d.items.some((x) => x.startsWith('Strength'))));
});

test('jump: approach type uses approach ideals and no height means no dunk meter', () => {
  const d = demoJump();
  const s = analyzeSession(d.frames, { mode: 'jump', jumpType: 'approach' });
  assert.equal(s.jumpType, 'approach');
  assert.equal(s.summary.performance.maxTouch, null);
  assert.ok(!s.reps[0].metrics.hipRise, 'hip rise needs athlete height');
  const html = summaryHtml(s);
  assert.ok(html.includes('Add your height'));
});

test('jump: standing still produces a friendly error', () => {
  const still = demoJump().frames.slice(0, 15).map((f, i) => ({ ...f, t: i / 30 }));
  const frames = Array.from({ length: 90 }, (_, i) => ({ t: i / 30, lm: still[i % 15].lm }));
  assert.match(analyzeSession(frames, { mode: 'jump' }).error, /No jump detected/);
});

test('jump: approach away from the camera (floor line moves) with athlete walking into frame', () => {
  // Shift everything up the image over time, like running away from a fixed
  // camera, and blank the first second as if the athlete is not yet in frame.
  const frames = demoJump().frames.map((f) => ({
    t: f.t,
    lm: f.t < 1 ? null : f.lm.map((p) => ({ ...p, y: p.y - 0.02 * f.t })),
  }));
  const s = analyzeSession(frames, { mode: 'jump', jumpType: 'approach', heightCm: 185 });
  assert.ok(!s.error, s.error);
  assert.equal(s.reps.length, 3);
  [52, 41, 49].forEach((h, i) => assert.ok(Math.abs(s.reps[i].height - h) < 4, `jump ${i + 1}: ${s.reps[i].height.toFixed(1)}`));
  assert.ok(!s.warnings.some((w) => w.includes('only detected')), 'walking into frame is not a coverage problem');
});
