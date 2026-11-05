// Pure analysis engine: pose frames in, report data out.
//
// A frame is { t: seconds, lm: Array<{x, y, v}> | null } where x and y are in
// "video-height units" (y in 0..1 top to bottom, x scaled by the video aspect
// ratio so distances are isotropic) and v is landmark visibility (0..1).
// Landmark indices follow the MediaPipe 33-point pose model.

import { SHOT_METRICS, DRIBBLE_METRICS, metricDefs, RIM_CM, DUNK_CLEARANCE_CM } from './metrics.js';

export const LM = {
  NOSE: 0,
  L_SH: 11, R_SH: 12,
  L_EL: 13, R_EL: 14,
  L_WR: 15, R_WR: 16,
  L_HIP: 23, R_HIP: 24,
  L_KN: 25, R_KN: 26,
  L_AN: 27, R_AN: 28,
  L_HEEL: 29, R_HEEL: 30,
  L_TOE: 31, R_TOE: 32,
};

const MIN_VIS = 0.5;

// ---------------------------------------------------------------- geometry

function pt(lm, i) {
  const p = lm?.[i];
  if (!p) return null;
  const v = p.v ?? p.visibility ?? 1;
  return v >= MIN_VIS ? p : null;
}

function mid(a, b) {
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return a || b || null;
}

function dist(a, b) {
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
}

/** Interior angle ABC in degrees. */
export function angleAt(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n === 0) return null;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

const avg = (...xs) => {
  const v = xs.filter((x) => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

// ---------------------------------------------------------------- stats

export function median(arr) {
  const v = arr.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function mean(arr) {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export function stdev(arr) {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

function percentile(arr, p) {
  const v = arr.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.round((p / 100) * (v.length - 1))))];
}

/** Fill gaps of up to `maxGap` samples by linear interpolation. */
export function fillGaps(series, maxGap = 5) {
  const out = series.slice();
  let i = 0;
  while (i < out.length) {
    if (out[i] != null) { i++; continue; }
    let j = i;
    while (j < out.length && out[j] == null) j++;
    const gap = j - i;
    if (i > 0 && j < out.length && gap <= maxGap) {
      const a = out[i - 1], b = out[j];
      for (let k = i; k < j; k++) out[k] = a + ((b - a) * (k - i + 1)) / (gap + 1);
    }
    i = j;
  }
  return out;
}

/** Centered moving average that ignores nulls. */
export function smooth(series, radius = 2) {
  return series.map((x, i) => {
    if (x == null) return null;
    let s = 0, n = 0;
    for (let k = Math.max(0, i - radius); k <= Math.min(series.length - 1, i + radius); k++) {
      if (series[k] != null) { s += series[k]; n++; }
    }
    return s / n;
  });
}

/**
 * Local maxima above `minHeight`, at least `minGap` samples apart
 * (the taller peak wins when two are too close).
 */
export function findPeaks(series, { minHeight = -Infinity, minGap = 1, radius = 2 } = {}) {
  const cand = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v == null || v < minHeight) continue;
    let isMax = true;
    for (let k = Math.max(0, i - radius); k <= Math.min(series.length - 1, i + radius); k++) {
      if (k !== i && series[k] != null && (series[k] > v || (series[k] === v && k < i))) { isMax = false; break; }
    }
    if (isMax) cand.push(i);
  }
  cand.sort((a, b) => series[b] - series[a]);
  const kept = [];
  for (const i of cand) if (kept.every((j) => Math.abs(i - j) >= minGap)) kept.push(i);
  return kept.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- scoring

/** 100 inside the ideal range, falling linearly to 40 at `tol` outside it, then to 0. */
export function scoreValue(value, ideal, tol) {
  if (value == null || !ideal) return null;
  const [lo, hi] = ideal;
  if (value >= lo && value <= hi) return 100;
  const d = value < lo ? lo - value : value - hi;
  return Math.max(0, Math.round(100 - (60 * d) / tol));
}

export function grade(score) {
  if (score == null) return { letter: '—', label: 'Not enough data' };
  if (score >= 90) return { letter: 'A', label: 'Excellent' };
  if (score >= 80) return { letter: 'B', label: 'Solid' };
  if (score >= 70) return { letter: 'C', label: 'Developing' };
  if (score >= 60) return { letter: 'D', label: 'Needs work' };
  return { letter: 'E', label: 'Rebuild the basics' };
}

function scoreMetrics(values, defs, view) {
  const metrics = {};
  let wsum = 0, ssum = 0;
  for (const [key, def] of Object.entries(defs)) {
    if (!def.views.includes(view)) continue;
    const value = values[key];
    if (value == null || Number.isNaN(value)) continue;
    const score = scoreValue(value, def.ideal, def.tol);
    metrics[key] = { value, score };
    if (score != null && def.weight > 0) { wsum += def.weight; ssum += def.weight * score; }
  }
  return { metrics, score: wsum ? Math.round(ssum / wsum) : null };
}

// ---------------------------------------------------------------- features

/** Per-frame feature series computed from landmarks. */
export function computeFeatures(frames, hand = 'right') {
  const S = hand === 'left'
    ? { sh: LM.L_SH, el: LM.L_EL, wr: LM.L_WR }
    : { sh: LM.R_SH, el: LM.R_EL, wr: LM.R_WR };
  const raw = {
    torso: [], knee: [], elbow: [], wristRel: [], forearm: [], lean: [],
    hipX: [], hipY: [], ankleY: [], shoulderW: [], elbowOff: [], noseRel: [],
    wristY: [], wristYOther: [], ankleW: [], kneeW: [],
  };
  for (const f of frames) {
    const lm = f.lm;
    const g = (i) => pt(lm, i);
    const lsh = g(LM.L_SH), rsh = g(LM.R_SH), lhip = g(LM.L_HIP), rhip = g(LM.R_HIP);
    const msh = mid(lsh, rsh), mhip = mid(lhip, rhip);
    const sh = g(S.sh), el = g(S.el), wr = g(S.wr);
    const otherWr = g(hand === 'left' ? LM.R_WR : LM.L_WR);
    const lan = g(LM.L_AN), ran = g(LM.R_AN), nose = g(LM.NOSE);
    const torso = dist(msh, mhip);

    raw.torso.push(torso);
    raw.knee.push(avg(angleAt(lhip, g(LM.L_KN), lan), angleAt(rhip, g(LM.R_KN), ran)));
    raw.elbow.push(angleAt(sh, el, wr));
    raw.wristRel.push(sh && wr ? sh.y - wr.y : null);
    raw.forearm.push(el && wr ? (Math.atan2(el.y - wr.y, Math.abs(wr.x - el.x)) * 180) / Math.PI : null);
    raw.lean.push(msh && mhip ? (Math.atan2(Math.abs(msh.x - mhip.x), mhip.y - msh.y) * 180) / Math.PI : null);
    raw.hipX.push(mhip?.x ?? null);
    raw.hipY.push(mhip?.y ?? null);
    raw.ankleY.push(mid(lan, ran)?.y ?? null);
    raw.shoulderW.push(lsh && rsh ? dist(lsh, rsh) : null);
    raw.elbowOff.push(sh && el ? Math.abs(el.x - sh.x) : null);
    raw.noseRel.push(nose && msh ? msh.y - nose.y : null);
    raw.wristY.push(wr?.y ?? null);
    raw.wristYOther.push(otherWr?.y ?? null);
    raw.ankleW.push(lan && ran ? Math.abs(lan.x - ran.x) : null);
    const lkn = g(LM.L_KN), rkn = g(LM.R_KN);
    raw.kneeW.push(lkn && rkn ? Math.abs(lkn.x - rkn.x) : null);
  }
  const T = median(raw.torso) || 0.25;
  const out = { T };
  for (const [k, s] of Object.entries(raw)) out[k] = smooth(fillGaps(s, 5), 1);
  // Normalised series
  out.wristH = out.wristRel.map((v) => (v == null ? null : v / T));
  out.shoulderWN = out.shoulderW.map((v) => (v == null ? null : v / T));
  return out;
}

export function detectView(frames) {
  const m = viewRatio(frames);
  // Facing the camera, shoulder width is ~0.6–0.9 of torso length; side-on it collapses.
  return m != null && m >= 0.42 ? 'front' : 'side';
}

/** Median shoulder width / torso length: ~0.1–0.3 side-on, ~0.6+ facing (or back to) the camera. */
export function viewRatio(frames) {
  const ratios = frames.map((f) => {
    const l = pt(f.lm, LM.L_SH), r = pt(f.lm, LM.R_SH);
    const t = dist(mid(l, r), mid(pt(f.lm, LM.L_HIP), pt(f.lm, LM.R_HIP)));
    return l && r && t ? dist(l, r) / t : null;
  });
  return median(ratios);
}

export function detectShootingHand(frames) {
  const hi = (i) => percentile(frames.map((f) => {
    const w = pt(f.lm, i);
    return w ? -w.y : null;
  }), 95);
  const l = hi(LM.L_WR), r = hi(LM.R_WR);
  if (l == null && r == null) return 'right';
  if (l == null) return 'right';
  if (r == null) return 'left';
  return l > r ? 'left' : 'right';
}

// ---------------------------------------------------------------- shooting

function indexAt(times, t) {
  let best = 0;
  for (let i = 0; i < times.length; i++) if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i;
  return best;
}

function argBy(series, a, b, cmp) {
  let best = -1;
  for (let i = a; i <= b; i++) {
    if (series[i] == null) continue;
    if (best < 0 || cmp(series[i], series[best])) best = i;
  }
  return best;
}

function analyzeShooting(frames, view, hand) {
  const times = frames.map((f) => f.t);
  const F = computeFeatures(frames, hand);
  const dt = times.length > 1 ? (times[times.length - 1] - times[0]) / (times.length - 1) : 1 / 15;
  const n = times.length;
  const warnings = [];

  let releases = findPeaks(F.wristH, { minHeight: 0.5, minGap: Math.round(1.0 / dt), radius: Math.max(2, Math.round(0.15 / dt)) });
  if (!releases.length) {
    const top = argBy(F.wristH, 0, n - 1, (a, b) => a > b);
    if (top >= 0 && F.wristH[top] > 0.15) {
      releases = [top];
      warnings.push('No clear release above the head was found, so the highest arm position was used as the release.');
    } else {
      return { error: 'No shooting motion detected. Make sure your whole body and shooting arm are visible.' };
    }
  }

  const reps = releases.map((r, k) => {
    const prev = k > 0 ? releases[k - 1] : -1;
    const next = k < releases.length - 1 ? releases[k + 1] : n;
    const start = Math.max(prev + Math.round(0.5 / dt), indexAt(times, times[r] - 1.5), 0);
    const end = Math.min(next - Math.round(0.4 / dt), indexAt(times, times[r] + 1.2), n - 1);

    // Load = lowest hip point before release (works from any camera angle).
    let load = argBy(F.hipY, start, r, (a, b) => a > b);
    if (load < 0) load = start;

    // Set point = tightest elbow while the hand is above the shoulder.
    let set = -1;
    for (let i = load; i <= r; i++) {
      if (F.wristH[i] == null || F.elbow[i] == null || F.wristH[i] < 0.3) continue;
      if (set < 0 || F.elbow[i] < F.elbow[set]) set = i;
    }
    if (set < 0) set = argBy(F.elbow, load, r, (a, b) => a < b);
    if (set < 0) set = r;

    // Follow-through: how long the hand stays up after release.
    let ft = r;
    while (ft + 1 <= end && F.wristH[ft + 1] != null && F.wristH[ft + 1] > 0.3) ft++;

    const landing = Math.min(end, indexAt(times, times[r] + 0.7));
    const baseHip = median(F.hipY.slice(start, Math.max(start + 1, indexAt(times, times[start] + 0.3)) + 1));
    const peakHip = argBy(F.hipY, Math.max(start, r - Math.round(0.2 / dt)), Math.min(end, r + Math.round(0.4 / dt)), (a, b) => a < b);
    const sw = F.shoulderW[set] ?? median(F.shoulderW);

    const values = {
      kneeLoad: F.knee[load],
      setElbow: F.elbow[set],
      releaseExtension: F.elbow[r],
      releaseAngle: F.forearm[r],
      elbowAlign: sw && F.elbowOff[set] != null ? F.elbowOff[set] / sw : null,
      trunkLean: F.lean[r],
      rhythm: times[r] - times[load],
      followThrough: times[ft] - times[r],
      balance: F.hipX[landing] != null && F.hipX[load] != null ? Math.abs(F.hipX[landing] - F.hipX[load]) / F.T : null,
      jump: baseHip != null && peakHip >= 0 ? Math.max(0, (baseHip - F.hipY[peakHip]) / F.T) : null,
    };
    const { metrics, score } = scoreMetrics(values, SHOT_METRICS, view);
    const ev = (type, i, label) => ({ type, label, idx: i, t: times[i] });
    return {
      id: k + 1,
      label: `Shot ${k + 1}`,
      t0: times[start],
      t1: times[end],
      events: [ev('load', load, 'Load'), ev('set', set, 'Set point'), ev('release', r, 'Release'), ev('follow', ft, 'Follow-through end')],
      metricEvent: {
        kneeLoad: 'load', setElbow: 'set', elbowAlign: 'set', releaseExtension: 'release', releaseAngle: 'release',
        trunkLean: 'release', rhythm: 'release', followThrough: 'follow', balance: 'load', jump: 'release',
      },
      metrics,
      score,
    };
  });

  const series = {
    t: times,
    knee: F.knee,
    elbow: F.elbow,
    wristH: F.wristH,
  };
  const chartSeries = [
    { key: 'elbow', label: 'Shooting elbow angle', unit: '°', axis: 'deg' },
    { key: 'knee', label: 'Knee angle', unit: '°', axis: 'deg', hidden: view === 'front' },
    { key: 'wristH', label: 'Hand height (torso)', unit: '', axis: 'rel' },
  ];
  return { reps, series, chartSeries, warnings, consistencyKeys: { releaseAngle: 8, setElbow: 12, rhythm: 0.15, kneeLoad: 12, releaseExtension: 12, elbowAlign: 0.2 } };
}

// ---------------------------------------------------------------- dribbling

function analyzeDribbling(frames, view) {
  const times = frames.map((f) => f.t);
  const n = times.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 15;
  const FR = computeFeatures(frames, 'right');
  const FL = computeFeatures(frames, 'left');
  const T = FR.T;
  const warnings = [];
  if (dt > 0.085) warnings.push('Sample rate is low for dribbling; use the "Accurate" setting or a shorter clip for better dribble counting.');

  // Hand that moves more vertically is the dribbling hand.
  const sdR = stdev(FR.wristY) ?? 0;
  const sdL = stdev(FL.wristY) ?? 0;
  const hand = sdL > sdR ? 'left' : 'right';
  const F = hand === 'left' ? FL : FR;

  // Hand height relative to hip (positive = above waist), in torso units.
  const handRel = F.wristY.map((w, i) => (w != null && F.hipY[i] != null ? (F.hipY[i] - w) / T : null));
  // Detrend with a ~1 s moving average to isolate the bounce cycle.
  const trendR = Math.max(2, Math.round(0.5 / dt));
  const trend = smooth(handRel, trendR);
  const osc = handRel.map((v, i) => (v != null && trend[i] != null ? v - trend[i] : null));
  const amp = stdev(osc) ?? 0;
  const peaks = findPeaks(osc, { minHeight: Math.max(0.03, amp * 0.4), minGap: Math.max(1, Math.round(0.18 / dt)), radius: 1 });

  if (peaks.length < 3) {
    return { error: 'Not enough dribbles detected. Film at least 5 seconds of continuous dribbling with your whole body in frame.' };
  }

  const intervals = peaks.slice(1).map((p, i) => times[p] - times[peaks[i]]);
  const meanInt = mean(intervals);
  const active = times[peaks[peaks.length - 1]] - times[peaks[0]] + meanInt;

  const values = {
    dribbleRate: peaks.length / active,
    handHeight: mean(peaks.map((p) => handRel[p])),
    rhythmCv: meanInt ? (stdev(intervals) ?? 0) / meanInt : null,
    stanceHeight: median(F.ankleY.map((a, i) => (a != null && F.hipY[i] != null ? (a - F.hipY[i]) / T : null))),
    headUp: median(F.noseRel.map((v) => (v == null ? null : v / T))),
    stanceWidth: median(F.ankleW.map((a, i) => (a != null && F.shoulderW[i] ? a / F.shoulderW[i] : null))),
    trunkLean: median(F.lean),
  };
  const { metrics, score } = scoreMetrics(values, DRIBBLE_METRICS, view);
  const rep = {
    id: 1,
    label: 'Dribble set',
    t0: times[0],
    t1: times[n - 1],
    events: peaks.map((p, i) => ({ type: 'dribble', label: `Dribble ${i + 1}`, idx: p, t: times[p] })),
    metricEvent: {},
    metrics,
    score,
    dribbleCount: peaks.length,
  };
  return {
    reps: [rep],
    hand,
    series: { t: times, handRel, knee: F.knee, head: F.noseRel.map((v) => (v == null ? null : v / T)) },
    chartSeries: [
      { key: 'handRel', label: 'Ball-hand height vs waist', unit: '', axis: 'rel' },
      { key: 'head', label: 'Head height above shoulders', unit: '', axis: 'rel' },
      { key: 'knee', label: 'Knee angle', unit: '°', axis: 'deg', hidden: view === 'front' },
    ],
    warnings,
    consistencyKeys: {},
  };
}

// ---------------------------------------------------------------- jump / dunk

const G = 9.81;

/** Jump height (cm) from flight time (s): h = g·t²/8. */
export function heightFromFlight(t) {
  return t > 0 ? (G * t * t * 100) / 8 : null;
}

function median3(series) {
  return series.map((v, i) => {
    if (v == null) return null;
    const w = [series[i - 1], v, series[i + 1]].filter((x) => x != null).sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });
}

/** Lowest visible foot point per frame (max y): the foot that is still on the floor. */
function footBottom(frames) {
  const ids = [LM.L_AN, LM.R_AN, LM.L_HEEL, LM.R_HEEL, LM.L_TOE, LM.R_TOE];
  return frames.map((f) => {
    if (!f.lm) return null;
    const ys = ids.map((i) => pt(f.lm, i)?.y).filter((v) => v != null);
    return ys.length ? Math.max(...ys) : null;
  });
}

/**
 * Find flight phases from the lowest visible foot point per frame.
 *
 * A foot is "on the floor" when it is both stationary and at the local lowest
 * point. The floor level is measured separately before take-off and after
 * landing, so approaching toward or away from the camera works. Thresholds
 * scale with the body size in each frame.
 *
 * @param times seconds per sample
 * @param foot lowest foot y per sample (image units, larger = lower)
 * @param scale torso length per sample (same units)
 */
// Defaults tuned on synthetic jumps and real phone footage: the pose tracker lags
// slightly on fast landings, so only half of the parabola correction is applied.
export function detectFlights(times, foot, scale, { thrRatio = 0.08, correct = 0.5 } = {}) {
  const n = times.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 30;
  const sec = (s) => Math.max(1, Math.round(s / dt));
  const W = sec(0.8);

  // Height above the lower envelope on both sides (min of the two handles drift).
  const envBefore = [], envAfter = [];
  for (let i = 0; i < n; i++) {
    let b = null, a = null;
    for (let k = Math.max(0, i - W); k <= i; k++) if (foot[k] != null && (b == null || foot[k] > b)) b = foot[k];
    for (let k = i; k <= Math.min(n - 1, i + W); k++) if (foot[k] != null && (a == null || foot[k] > a)) a = foot[k];
    envBefore.push(b); envAfter.push(a);
  }
  const lift = foot.map((v, i) => (v == null || envBefore[i] == null || envAfter[i] == null ? null : (Math.min(envBefore[i], envAfter[i]) - v) / scale[i]));

  // Stationary: small movement to both neighbours (a repeated video frame only gives one).
  const vmax = (i) => 1.2 * scale[i] * dt; // ~1.2 torso lengths per second
  const still = foot.map((v, i) => i > 0 && i < n - 1 && v != null && foot[i - 1] != null && foot[i + 1] != null
    && Math.abs(v - foot[i - 1]) <= vmax(i) && Math.abs(foot[i + 1] - v) <= vmax(i));
  const low = (i, env) => foot[i] != null && env[i] != null && env[i] - foot[i] <= 0.3 * scale[i];
  const onGround = foot.map((_, i) => still[i] && (low(i, envBefore) || low(i, envAfter)));

  const peaks = findPeaks(lift, { minHeight: 0.4, minGap: sec(0.5), radius: sec(0.12) });
  const jumps = [];
  let rejected = false;
  for (const p of peaks) {
    if (jumps.length && p <= jumps[jumps.length - 1].b) continue;
    // Walking out from the apex, the first stationary, not-lifted frame on each
    // side is the plant (take-off) and the landing. (An approach run starts
    // closer to the camera, so earlier steps sit lower in the image.)
    const planted = (k) => still[k] && (lift[k] == null || lift[k] < 0.25);
    let c = p - 1;
    while (c > 0 && !planted(c)) c--;
    if (!planted(c)) continue;
    const runL = [];
    for (let k = c; k >= 0 && planted(k) && runL.length < sec(0.25); k--) runL.push(foot[k]);
    const gL = median(runL);
    // Landing side: the nearest run of planted frames after the apex.
    let d = p + 1;
    while (d < n - 1 && !planted(d)) d++;
    if (!planted(d)) continue;
    const runR = [];
    for (let k = d; k < n && planted(k) && runR.length < sec(0.25); k++) runR.push(foot[k]);
    const gR = median(runR);

    const thrL = thrRatio * scale[c], thrR = thrRatio * scale[d];
    let a = c + 1;
    while (a < p && (foot[a] == null || foot[a] > gL - thrL)) a++;
    let b = d - 1;
    while (b > p && (foot[b] == null || foot[b] > gR - thrR)) b--;
    if (a > p || b < p || foot[a - 1] == null || foot[b + 1] == null) continue;
    const cross = (i0, i1, level) => {
      const u = (foot[i0] - level) / (foot[i0] - foot[i1]);
      return times[i0] + Math.max(0, Math.min(1, u)) * (times[i1] - times[i0]);
    };
    const tTake = cross(a - 1, a, gL - thrL);
    const tLand = cross(b + 1, b, gR - thrR);
    // Feet height above a floor line interpolated from take-off to landing spot.
    let peakH = 0;
    for (let k = a; k <= b; k++) {
      if (foot[k] == null) continue;
      const u = (times[k] - tTake) / Math.max(1e-6, tLand - tTake);
      peakH = Math.max(peakH, gL + (gR - gL) * u - foot[k]);
    }
    // The threshold is crossed slightly above the floor; correct assuming a parabolic flight.
    const thr = correct * (thrL + thrR) / 2;
    const flight = (tLand - tTake) / Math.sqrt(Math.max(0.25, 1 - thr / Math.max(peakH, 2 * thr)));
    if (flight < 0.15) continue; // a step or a hop, not a jump
    if (flight > 1.1) { rejected = true; continue; }
    jumps.push({ a, b, apex: p, tTake, tLand, flight, gL, gR, peakH });
  }
  return { jumps, onGround, lift, rejected };
}

function analyzeJump(frames, view, opts) {
  const times = frames.map((f) => f.t);
  const n = times.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 30;
  const approach = opts.jumpType === 'approach';
  const FR = computeFeatures(frames, 'right');
  const FL = computeFeatures(frames, 'left');
  const F = FR;
  const T = F.T;
  const warnings = [];
  if (dt > 0.05) warnings.push('Low sample rate: jump height is less precise. Use a 30 fps (or faster) clip.');

  const foot = median3(fillGaps(footBottom(frames), 2));
  if (!foot.some((v) => v != null)) return { error: 'Your feet were not visible. Film with your whole body and the floor in frame.' };
  // Body scale per frame: the athlete gets smaller as they move away from the camera.
  const scale = fillGaps(F.torso, 30).map((v) => v || T);
  const { jumps, onGround, lift, rejected } = detectFlights(times, foot, scale);
  if (rejected) warnings.push('Ignored a "jump" with an impossible flight time. Is the camera moving? Use a tripod.');
  const sec = (s) => Math.max(1, Math.round(s / dt));
  if (!jumps.length) {
    return { error: 'No jump detected. Keep the camera still (tripod), and keep your feet and the floor in frame for the whole jump.' };
  }

  // Scale (cm per unit) from the athlete's height, if given.
  // Measured per torso length, so it still works as the athlete moves toward or
  // away from the camera; cmAt(k) converts image units to cm at frame k.
  let cmPerTorso = null;
  if (opts.heightCm > 0) {
    const noseY = frames.map((f) => pt(f.lm, LM.NOSE)?.y ?? null);
    const stand = [];
    for (let k = 0; k < n; k++) {
      if (foot[k] == null || noseY[k] == null || F.knee[k] == null) continue;
      if (onGround[k] && F.knee[k] > 160 && (F.lean[k] ?? 0) < 15) stand.push((foot[k] - noseY[k]) / scale[k]);
    }
    const s = percentile(stand, 75);
    // The nose sits at ~92.5% of standing height.
    if (s) cmPerTorso = (opts.heightCm * 0.925) / s;
    else warnings.push('Could not find a frame of you standing upright, so cm-based cross-checks are skipped.');
  }

  const cmAt = (k) => (cmPerTorso && scale[k] ? cmPerTorso / scale[k] : null);

  const armH = FR.wristH.map((r, k) => {
    const l = FL.wristH[k];
    return r == null ? l : l == null ? r : Math.max(r, l);
  });

  const reps = jumps.map((jp, k) => {
    const take = indexAt(times, jp.tTake) <= jp.a - 1 ? jp.a - 1 : indexAt(times, jp.tTake);
    const land = jp.b + 1;
    const prevEnd = k > 0 ? jumps[k - 1].b + 1 : 0;
    const winStart = Math.max(prevEnd, take - sec(approach ? 0.6 : 1.0));
    // Hip height above the feet in torso lengths: independent of distance to the camera.
    const hipAbove = (k) => (foot[k] != null && F.hipY[k] != null ? (foot[k] - F.hipY[k]) / scale[k] : null);
    const lowestHip = (a0, b0) => {
      let best = -1;
      for (let k = a0; k <= b0; k++) {
        const v = hipAbove(k);
        if (v != null && (best < 0 || v < hipAbove(best))) best = k;
      }
      return best;
    };
    let bottom = lowestHip(winStart, take);
    if (bottom < 0) bottom = Math.max(0, take - 1);
    let peak = argBy(F.hipY, jp.a, jp.b, (x, y) => x < y);
    if (peak < 0) peak = Math.round((jp.a + jp.b) / 2);
    const nextStart = k < jumps.length - 1 ? jumps[k + 1].a - 1 : n - 1;
    // Peak knee bend from absorbing a landing happens within ~0.25 s; later is a deliberate crouch.
    const absorbEnd = Math.min(nextStart, land + sec(0.25), n - 1);
    let absorb = lowestHip(land, absorbEnd);
    if (absorb < 0) absorb = land;
    const ext = argBy(F.knee, Math.max(0, take - sec(0.1)), take, (x, y) => x > y);
    let armPk = -1;
    for (let q = Math.max(0, take - sec(0.1)); q <= Math.min(jp.b, take + sec(0.2)); q++) {
      if (armH[q] != null && (armPk < 0 || armH[q] > armH[armPk])) armPk = q;
    }
    const height = heightFromFlight(jp.flight);
    const appA = indexAt(times, times[take] - 0.5), appB = indexAt(times, times[take] - 0.1);

    const values = {
      jumpHeight: height,
      flightTime: jp.flight,
      hipRise: cmAt(take) && F.hipY[take] != null && F.hipY[peak] != null ? Math.max(0, (F.hipY[take] - F.hipY[peak]) * cmAt(peak)) : null,
      // Side-on only: running toward/away from the camera hides horizontal speed.
      approachSpeed: approach && view === 'side' && cmAt(take) && F.hipX[appA] != null && F.hipX[appB] != null && appB > appA
        ? (Math.abs(F.hipX[appB] - F.hipX[appA]) * cmAt(take)) / 100 / (times[appB] - times[appA]) : null,
      loadDepth: F.knee[bottom],
      hipHinge: F.lean[bottom],
      transition: times[take] - times[bottom],
      armDrive: armPk >= 0 ? armH[armPk] : null,
      takeoffExtension: ext >= 0 ? F.knee[ext] : null,
      landingFlex: argBy(F.knee, land, absorbEnd, (x, y) => x < y) >= 0 ? F.knee[argBy(F.knee, land, absorbEnd, (x, y) => x < y)] : null,
      kneeValgus: F.kneeW[absorb] != null && F.ankleW[absorb] ? F.kneeW[absorb] / F.ankleW[absorb] : null,
    };
    const { metrics, score } = scoreMetrics(values, metricDefs('jump', opts.jumpType), view);
    const ev = (type, idx, label, t = times[idx]) => ({ type, label, idx, t });
    return {
      id: k + 1,
      label: `Jump ${k + 1}`,
      t0: times[winStart],
      t1: times[absorbEnd],
      events: [
        ev('bottom', bottom, 'Bottom of dip'),
        ev('takeoff', take, 'Take-off', jp.tTake),
        ev('peak', peak, 'Peak'),
        ev('landing', land, 'Landing', jp.tLand),
        ev('absorb', absorb, 'Landing absorb'),
      ],
      metricEvent: {
        loadDepth: 'bottom', hipHinge: 'bottom', transition: 'takeoff', armDrive: 'takeoff', takeoffExtension: 'takeoff',
        jumpHeight: 'peak', flightTime: 'peak', hipRise: 'peak', approachSpeed: 'takeoff', landingFlex: 'absorb', kneeValgus: 'absorb',
      },
      metrics,
      score,
      height,
    };
  });

  // Feet height above the (global) floor and arm height, in torso units.
  const feet = lift.map((v) => (v == null ? null : Math.max(-0.2, v)));
  return {
    reps,
    hand: 'both',
    cmPerTorso,
    series: { t: times, knee: F.knee, feet, arms: armH },
    chartSeries: [
      { key: 'knee', label: 'Knee angle', unit: '°', axis: 'deg', hidden: view === 'front' },
      { key: 'feet', label: 'Feet off floor (torso)', unit: '', axis: 'rel' },
      { key: 'arms', label: 'Hand height (torso)', unit: '', axis: 'rel' },
    ],
    warnings: [...new Set(warnings)],
    consistencyKeys: { jumpHeight: 10, loadDepth: 20, transition: 0.2, armDrive: 0.6 },
  };
}

function jumpPerformance(reps, opts) {
  const heights = reps.map((r) => r.height).filter((h) => h != null);
  if (!heights.length) return null;
  const best = Math.max(...heights);
  const bestRep = reps.find((r) => r.height === best);
  const heightCm = opts.heightCm > 0 ? opts.heightCm : null;
  const reachGiven = opts.reachCm > 0 ? opts.reachCm : null;
  // Standing reach is about 1.33 × height for most players.
  const reach = reachGiven ?? (heightCm ? Math.round(heightCm * 1.33) : null);
  const maxTouch = reach != null ? reach + best : null;
  return {
    best,
    avg: mean(heights),
    bestLabel: bestRep?.label,
    bestFlight: bestRep?.metrics.flightTime?.value ?? null,
    jumpType: opts.jumpType === 'approach' ? 'approach' : 'standing',
    heightCm,
    reach,
    reachEstimated: reachGiven == null && reach != null,
    maxTouch,
    rim: RIM_CM,
    dunkTarget: RIM_CM + DUNK_CLEARANCE_CM,
    toRim: maxTouch != null ? RIM_CM - maxTouch : null,
    toDunk: maxTouch != null ? RIM_CM + DUNK_CLEARANCE_CM - maxTouch : null,
  };
}

// ---------------------------------------------------------------- session

const PLAN = {
  shooting: {
    warm: 'Warm-up: 25 one-hand form shots within 2 m of the rim',
    finish: 'Finish: 20 game-speed shots from your favourite spots, track makes',
    keep: 'Maintenance: 5 spots × 10 shots, chart your makes',
    rest: 'Recovery: light shooting + mobility, then re-record a clip to track progress',
  },
  dribbling: {
    warm: 'Warm-up: 2 min stationary pound dribbles, each hand',
    finish: 'Finish: 3 × full-court dribble at game speed, eyes up',
    keep: 'Maintenance: 5 min combo moves (crossover, between-the-legs, behind-the-back)',
    rest: 'Recovery: light ball-handling + mobility, then re-record a clip to track progress',
  },
  jump: {
    warm: 'Warm-up: 5 min dynamic mobility (leg swings, lunges, skips) + 2 × 10 pogo hops',
    finish: 'Finish: 3 × 3 max-effort jumps with full rest (60–90 s). Film the last set to track your height',
    keep: 'Plyometrics: 3 × 5 box jumps + 3 × 5 depth jumps from a 30 cm box',
    strength: 'Strength: 4 × 5 back squat or trap-bar deadlift (heavy, fast up) + 3 × 12 single-leg calf raises',
    rest: 'Rest day: no jumping. Mobility (hips, ankles) and light core work. Jump gains happen during recovery',
  },
};

function buildPlan(focus, mode) {
  const P = PLAN[mode];
  const drills = focus.map((f) => f.drill);
  if (!drills.length) drills.push(P.keep);
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
  return days.map((d, i) => {
    if (i === 2) return { day: d, items: [P.rest] };
    const a = drills[i % drills.length];
    const b = drills[(i + 1) % drills.length];
    const items = [P.warm, a, mode !== 'jump' && b !== a ? b : null];
    // Jump training: alternate technique days with strength days.
    if (mode === 'jump') items.push(i % 2 === 0 ? P.strength : P.keep);
    items.push(P.finish);
    return { day: d, items: items.filter(Boolean) };
  });
}

/**
 * Analyse a session.
 * @param {Array<{t:number, lm:Array|null}>} frames
 * @param {{mode?: 'shooting'|'dribbling'|'jump', hand?: 'auto'|'left'|'right', view?: 'auto'|'side'|'front',
 *   jumpType?: 'standing'|'approach', heightCm?: number, reachCm?: number}} opts
 */
export function analyzeSession(frames, opts = {}) {
  const mode = opts.mode || 'shooting';
  const valid = frames.filter((f) => f.lm);
  if (valid.length < 10) {
    return { error: 'Could not find a player in the video. Use a clip where your whole body is visible and well lit.' };
  }
  const view = opts.view && opts.view !== 'auto' ? opts.view : detectView(valid);
  const hand = opts.hand && opts.hand !== 'auto' ? opts.hand : detectShootingHand(valid);
  const jumpType = mode === 'jump' ? (opts.jumpType === 'approach' ? 'approach' : 'standing') : undefined;
  const defs = metricDefs(mode, jumpType);

  const res = mode === 'shooting' ? analyzeShooting(frames, view, hand)
    : mode === 'jump' ? analyzeJump(frames, view, { ...opts, jumpType })
      : analyzeDribbling(frames, view);
  if (res.error) return { error: res.error };

  const warnings = [...res.warnings];
  const vr = viewRatio(valid);
  if (vr != null && vr > 0.3 && vr < 0.55 && (!opts.view || opts.view === 'auto')) {
    warnings.push(mode === 'jump'
      ? 'The camera was at an angle to you, so knee and hip angles are approximate. Jump height and timing are not affected. For technique feedback, film exactly side-on.'
      : 'The camera was at an angle to you, so joint angles are approximate. Film exactly side-on (or set the camera angle manually) for precise angles.');
  }
  // Count coverage from the first to the last detection (walking into frame is fine).
  const firstSeen = frames.findIndex((f) => f.lm);
  const lastSeen = frames.length - 1 - [...frames].reverse().findIndex((f) => f.lm);
  const coverage = valid.length / Math.max(1, lastSeen - firstSeen + 1);
  if (coverage < 0.7) warnings.push(`The player was only detected in ${Math.round(coverage * 100)}% of frames, so some numbers may be less accurate.`);

  // Aggregate per metric across reps.
  const summaryMetrics = {};
  for (const [key, def] of Object.entries(defs)) {
    const vals = res.reps.map((r) => r.metrics[key]?.value).filter((v) => v != null);
    if (!vals.length) continue;
    const scores = res.reps.map((r) => r.metrics[key]?.score).filter((v) => v != null);
    summaryMetrics[key] = {
      mean: mean(vals),
      sd: stdev(vals),
      n: vals.length,
      score: scores.length ? Math.round(mean(scores)) : null,
      minScore: scores.length ? Math.min(...scores) : null,
      worstRep: res.reps.reduce((w, r, i) => ((r.metrics[key]?.score ?? 101) < (res.reps[w].metrics[key]?.score ?? 101) ? i : w), 0),
      values: res.reps.map((r) => r.metrics[key]?.value ?? null),
    };
  }

  // Consistency across reps (shooting with ≥2 shots).
  let consistency = null;
  if (res.reps.length >= 2) {
    const parts = [];
    for (const [key, maxSd] of Object.entries(res.consistencyKeys)) {
      const sd = summaryMetrics[key]?.sd;
      if (sd != null) parts.push(Math.max(0, 100 - (100 * sd) / maxSd));
    }
    if (parts.length) consistency = Math.round(mean(parts));
  }

  const repScores = res.reps.map((r) => r.score).filter((s) => s != null);
  const formScore = repScores.length ? mean(repScores) : null;
  // Jump heights vary naturally between max efforts, so the jump grade is technique only.
  const overall = formScore == null ? null : Math.round(consistency == null || mode === 'jump' ? formScore : 0.8 * formScore + 0.2 * consistency);

  // Coaching: strengths and focus areas.
  const strengths = [];
  const focus = [];
  for (const [key, m] of Object.entries(summaryMetrics)) {
    const def = defs[key];
    if (m.score == null || !def.ideal) continue;
    if (m.score >= 90 && m.minScore >= 80) strengths.push({ key, label: def.label, score: m.score, why: def.why });
    else if (m.score < 85 || m.minScore < 70) {
      // Judge direction by the mean, or by the worst rep if the mean is in range.
      const inRange = m.mean >= def.ideal[0] && m.mean <= def.ideal[1];
      const v = inRange ? m.values[m.worstRep] : m.mean;
      const side = v < def.ideal[0] ? def.low : def.high;
      if (!side) continue;
      focus.push({ key, label: def.label, score: Math.min(m.score, m.minScore + 10), issue: side.issue, tip: side.tip, drill: side.drill, why: def.why, priority: (100 - Math.min(m.score, m.minScore + 10)) * def.weight, worstShot: res.reps.length > 1 ? res.reps[m.worstRep].label : null });
    }
  }
  focus.sort((a, b) => b.priority - a.priority);
  if (consistency != null && consistency < 70) {
    focus.push({
      key: 'consistency',
      label: 'Shot-to-shot consistency',
      score: consistency,
      issue: 'Inconsistent mechanics',
      ...(mode === 'jump' ? {
        label: 'Jump-to-jump consistency',
        tip: 'Your jumps vary a lot in height or technique. Rest fully (60–90 s) between max jumps and use the same approach every time.',
        drill: 'Quality-over-quantity sets: 4 × 3 max jumps with full rest, stop the set when height drops off.',
        why: 'Repeatable technique lets you measure progress and makes your best jump show up in games.',
      } : {
        tip: 'Your form changes noticeably from shot to shot. Groove one repeatable motion before adding range or speed.',
        drill: 'Same-spot reps: 50 shots from one spot at 70% speed, filming every 10th shot.',
        why: 'Repeatable mechanics are what turn practice makes into game makes.',
      }),
      priority: (100 - consistency) * 0.9,
    });
    focus.sort((a, b) => b.priority - a.priority);
  }

  return {
    version: 1,
    mode,
    jumpType,
    view,
    hand: res.hand || hand,
    createdAt: new Date().toISOString(),
    duration: frames.length ? frames[frames.length - 1].t - frames[0].t : 0,
    sampleCount: frames.length,
    coverage,
    reps: res.reps,
    series: res.series,
    chartSeries: res.chartSeries,
    summary: {
      metrics: summaryMetrics,
      overall,
      formScore: formScore == null ? null : Math.round(formScore),
      consistency,
      grade: grade(overall),
      strengths: strengths.sort((a, b) => b.score - a.score),
      focus: focus.slice(0, 4),
      plan: buildPlan(focus.slice(0, 3), mode),
      performance: mode === 'jump' ? jumpPerformance(res.reps, { ...opts, jumpType }) : null,
    },
    athlete: mode === 'jump' ? { heightCm: opts.heightCm || null, reachCm: opts.reachCm || null } : null,
    warnings,
  };
}
