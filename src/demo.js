// Synthetic pose data so the app can be explored without a video.
// Generates a side-view stick figure taking jump shots, or a front-view
// figure dribbling, in the same frame format the pose extractor produces.

import { LM } from './analysis.js';

const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => u * u * (3 - 2 * u);
const rad = (d) => (d * Math.PI) / 180;

function interp(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      const u = ease((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, k) => lerp(v, b[k + 1], u));
    }
  }
  return keys[keys.length - 1].slice(1);
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

function blank() {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0.2 }));
}

// Segment lengths in video-height units.
const SHANK = 0.15, THIGH = 0.16, TORSO = 0.24, UARM = 0.12, FARM = 0.11;

/** Side-view figure facing +x. Angles in degrees. */
function sidePose({ cx, knee, hipFlex = 0, lean, shoulder, elbow, lift, offShoulder, offElbow, raise = 0 }, noise) {
  const lm = blank();
  const set = (i, p, v = 0.95) => { lm[i] = { x: p.x + noise() * 0.004, y: p.y + noise() * 0.004, v }; };
  const a = rad((180 - knee) / 2);
  const ankle = { x: cx, y: 0.88 - lift - 0.025 * raise }; // heel raise pivots about the toes
  const kneeP = { x: ankle.x + SHANK * Math.sin(a), y: ankle.y - SHANK * Math.cos(a) };
  const hip = { x: kneeP.x - THIGH * Math.sin(a + rad(hipFlex)), y: kneeP.y - THIGH * Math.cos(a + rad(hipFlex)) };
  const b = rad(lean);
  const sh = { x: hip.x + TORSO * Math.sin(b), y: hip.y - TORSO * Math.cos(b) };
  const arm = (shDeg, elDeg) => {
    const p = rad(shDeg);
    const el = { x: sh.x + UARM * Math.sin(p), y: sh.y + UARM * Math.cos(p) };
    const q = rad(shDeg + (180 - elDeg));
    const wr = { x: el.x + FARM * Math.sin(q), y: el.y + FARM * Math.cos(q) };
    return { el, wr };
  };
  const main = arm(shoulder, elbow);
  const off = arm(offShoulder, offElbow);
  const nose = { x: sh.x + 0.035 + 0.05 * Math.sin(b), y: sh.y - 0.085 };
  const depth = 0.012; // far-side joints sit slightly behind
  set(LM.NOSE, nose);
  set(LM.R_SH, sh); set(LM.L_SH, { x: sh.x - depth, y: sh.y }, 0.7);
  set(LM.R_EL, main.el); set(LM.R_WR, main.wr);
  set(LM.L_EL, { x: off.el.x - depth, y: off.el.y }, 0.65); set(LM.L_WR, { x: off.wr.x - depth, y: off.wr.y }, 0.65);
  set(LM.R_HIP, hip); set(LM.L_HIP, { x: hip.x - depth, y: hip.y }, 0.75);
  set(LM.R_KN, kneeP); set(LM.L_KN, { x: kneeP.x - depth, y: kneeP.y }, 0.75);
  set(LM.R_AN, ankle); set(LM.L_AN, { x: ankle.x - depth, y: ankle.y }, 0.75);
  const toe = { x: cx + 0.05, y: 0.905 - lift };
  const heel = { x: cx - 0.02, y: 0.905 - lift - 0.035 * raise };
  set(LM.R_TOE, toe); set(LM.L_TOE, { x: toe.x - depth, y: toe.y }, 0.7);
  set(LM.R_HEEL, heel); set(LM.L_HEEL, { x: heel.x - depth, y: heel.y }, 0.7);
  return lm;
}

// [time, knee, lean, shoulder, elbow, lift, drift]
const SHOT_KEYS = [
  [0.0, 172, 5, 35, 95, 0, 0],
  [0.3, 170, 6, 40, 92, 0, 0],
  [0.65, 126, 13, 62, 78, 0, 0],
  [0.85, 156, 9, 118, 82, 0.015, 0.005],
  [1.0, 176, 4, 150, 168, 0.065, 0.01],
  [1.1, 177, 4, 152, 171, 0.075, 0.012],
  [1.5, 172, 5, 148, 166, 0, 0.015],
  [1.85, 170, 5, 60, 120, 0, 0.015],
  [2.3, 172, 5, 35, 95, 0, 0.015],
];

// Per-shot variation so the demo produces realistic feedback.
const SHOT_VARIANTS = [
  { knee: 0, shoulder: 0, elbow: 0, hold: 1, drift: 1 },
  { knee: 34, shoulder: -30, elbow: -10, hold: 0.3, drift: 3 }, // stiff legs, flat, drops follow-through
  { knee: 20, shoulder: -18, elbow: -4, hold: 0.5, drift: 10 }, // drifts forward
  { knee: 26, shoulder: -22, elbow: -2, hold: 0.6, drift: 2 },
];

export function demoShooting({ fps = 30, shots = 4, seed = 7 } = {}) {
  const noise = rng(seed);
  const shotLen = 2.3;
  const frames = [];
  const total = shots * shotLen + 0.4;
  for (let i = 0; i <= total * fps; i++) {
    const t = i / fps;
    const k = Math.min(shots - 1, Math.floor(t / shotLen));
    const local = t - k * shotLen;
    const v = SHOT_VARIANTS[k % SHOT_VARIANTS.length];
    // Stretch the follow-through hold window by variant.
    const keys = SHOT_KEYS.map(([tt, ...rest]) => [tt > 1.1 && tt <= 1.5 ? 1.1 + (tt - 1.1) * v.hold : tt, ...rest]);
    const [knee, lean, shoulder, elbow, lift, drift] = interp(keys, local);
    const dip = Math.max(0, Math.min(1, (local - 0.3) / 0.35)) * Math.max(0, Math.min(1, (0.85 - local) / 0.2));
    const releasing = local > 0.85 && local < 1.6 ? 1 : 0;
    frames.push({
      t,
      lm: sidePose({
        cx: 0.78 + drift * v.drift,
        knee: knee + v.knee * dip,
        lean,
        shoulder: shoulder + v.shoulder * releasing,
        elbow: elbow + v.elbow * releasing,
        lift,
        offShoulder: Math.min(shoulder, 130) - 5,
        offElbow: elbow - 15,
      }, noise),
    });
  }
  return { frames, aspect: 16 / 9, mode: 'shooting', label: 'Demo: 4 jump shots (side view)' };
}

/** Front-view dribbling figure. */
export function demoDribbling({ fps = 30, seconds = 8, seed = 3 } = {}) {
  const noise = rng(seed);
  const frames = [];
  const cx = 0.5;
  for (let i = 0; i <= seconds * fps; i++) {
    const t = i / fps;
    const rate = 2.4 + 0.25 * Math.sin(t * 0.9); // dribbles per second, slightly uneven
    const phase = 2 * Math.PI * (rate * t);
    const bounce = 0.5 + 0.5 * Math.cos(phase); // 1 = hand at top
    const crouch = 0.035 + 0.01 * Math.sin(t * 0.5);
    const headDrop = t > 4 && t < 6 ? 0.03 : 0; // looks down for a while
    const lm = blank();
    const set = (idx, x, y, v = 0.95) => { lm[idx] = { x: x + noise() * 0.004, y: y + noise() * 0.004, v }; };
    const hipY = 0.56 + crouch;
    const shY = hipY - TORSO + 0.01;
    set(LM.NOSE, cx, shY - 0.1 + headDrop);
    set(LM.L_SH, cx - 0.085, shY); set(LM.R_SH, cx + 0.085, shY);
    set(LM.L_HIP, cx - 0.06, hipY); set(LM.R_HIP, cx + 0.06, hipY);
    set(LM.L_KN, cx - 0.09, hipY + 0.15); set(LM.R_KN, cx + 0.09, hipY + 0.15);
    set(LM.L_AN, cx - 0.1, 0.88); set(LM.R_AN, cx + 0.1, 0.88);
    // Right hand dribbles; top of dribble slightly above the waist.
    const wrY = hipY + 0.11 - 0.14 * bounce;
    set(LM.R_EL, cx + 0.15, shY + 0.13); set(LM.R_WR, cx + 0.2, wrY);
    set(LM.L_EL, cx - 0.14, shY + 0.12); set(LM.L_WR, cx - 0.12, shY + 0.18);
    frames.push({ t, lm });
  }
  return { frames, aspect: 1, mode: 'dribbling', label: 'Demo: 8 s of dribbling (front view)' };
}

// Standing vertical jumps. The figure is ~0.71 units tall, so 185 cm ≈ 259 cm/unit.
const JUMP_VARIANTS = [
  { heightCm: 52, knee: 108, hinge: 42, arm: 170, landKnee: 118 },
  { heightCm: 41, knee: 142, hinge: 18, arm: 80, landKnee: 125 }, // shallow dip, weak arm swing
  { heightCm: 49, knee: 112, hinge: 38, arm: 165, landKnee: 170 }, // stiff landing
];

export function demoJump({ fps = 30, seed = 11, athleteCm = 185 } = {}) {
  const noise = rng(seed);
  const cmPerUnit = (athleteCm * 0.925) / 0.66;
  const period = 3.4, tk = 1.3;
  const frames = [];
  const total = JUMP_VARIANTS.length * period + 0.3;
  for (let i = 0; i <= total * fps; i++) {
    const t = i / fps;
    const k = Math.min(JUMP_VARIANTS.length - 1, Math.floor(t / period));
    const v = JUMP_VARIANTS[k];
    const local = t - k * period;
    const T0 = 2 * Math.sqrt((2 * v.heightCm) / 100 / 9.81);
    const L = tk + T0;
    // [time, knee, lean, shoulder, elbow, raise]
    const keys = [
      [0, 174, 4, 10, 170, 0],
      [0.5, 174, 4, 10, 170, 0],
      [0.95, v.knee, v.hinge, -45, 165, 0],
      [1.2, 172, 8, v.arm * 0.85, 170, 0.6],
      [tk, 178, 3, v.arm, 172, 1],
      [tk + T0 * 0.6, 176, 3, v.arm - 10, 172, 1],
      [L, 172, 5, 110, 170, 1],
      [L + 0.08, (172 + v.landKnee) / 2, 15, 80, 165, 0],
      [L + 0.2, v.landKnee, 30, 50, 160, 0],
      [L + 0.85, 174, 4, 10, 170, 0],
      [period, 174, 4, 10, 170, 0],
    ];
    const [knee, lean, shoulder, elbow, raise] = interp(keys, local);
    const air = local > tk && local < L ? 1 - ((local - tk - T0 / 2) / (T0 / 2)) ** 2 : 0;
    frames.push({
      t,
      lm: sidePose({
        cx: 0.85,
        knee, lean, shoulder, elbow, raise,
        lift: (air * v.heightCm) / cmPerUnit,
        offShoulder: shoulder - 4,
        offElbow: elbow - 4,
      }, noise),
    });
  }
  return { frames, aspect: 16 / 9, mode: 'jump', label: 'Demo: 3 standing vertical jumps (side view)', athlete: { heightCm: athleteCm }, jumpType: 'standing' };
}

// ---------------------------------------------------------------- run-up demo

/**
 * Side-view athlete running a 4-step approach into a jump, built from a foot
 * contact schedule (so the run-up analysis has a known answer).
 * `takeoff`: 'one-two' (penultimate foot stays down, both feet push off) or 'one-foot'.
 */
export function demoApproach({
  fps = 60, seed = 5, athleteCm = 185, takeoff = 'one-two',
  stepTimes = [0.27, 0.15, 0.26], // approach step intervals (s); the short one is a stutter
  penStep = 0.17, finalStep = 0.27, // time into the penultimate step, then into the plant
  speeds = [3.4, 4.2, 4.6, 4.6, 3.6, 3.2], // m/s at each touchdown (last two = penultimate, plant)
  penDrop = 0.02, // hip lowering on the penultimate step (fraction of hip height)
  plantContact = 0.34, plantAngle = 70, plantLean = 18, jumpCm = 55,
} = {}) {
  const noise = rng(seed);
  const H = 0.46; // figure height in video-height units
  const perM = H / (athleteCm / 100);
  const G = 0.93; // floor line
  const thigh = 0.245 * H, shank = 0.246 * H, ankleH = 0.039 * H, torso = 0.30 * H;
  const standHip = thigh + shank + ankleH; // 0.53 H
  const dir = 1;

  // Touchdown schedule.
  const tds = [0.25];
  for (const st of stepTimes) tds.push(tds[tds.length - 1] + st);
  tds.push(tds[tds.length - 1] + penStep); // penultimate touchdown
  tds.push(tds[tds.length - 1] + finalStep); // plant touchdown
  const tPen = tds[tds.length - 2], tPlant = tds[tds.length - 1];
  const tTake = tPlant + plantContact;
  const T0 = 2 * Math.sqrt((2 * jumpCm) / 100 / 9.81);
  const tLand = tTake + T0;
  const end = tLand + 1.0;

  // Horizontal hip speed (units/s), piecewise linear through the touchdowns.
  const vKeys = tds.map((t, i) => [t, speeds[Math.min(i, speeds.length - 1)] * perM]);
  vKeys.unshift([0, speeds[0] * perM * 0.9]);
  vKeys.push([tTake, speeds[speeds.length - 1] * perM * 0.55]);
  const vAt = (t) => {
    if (t <= vKeys[0][0]) return vKeys[0][1];
    for (let i = 1; i < vKeys.length; i++) if (t <= vKeys[i][0]) {
      const [a, va] = vKeys[i - 1], [b, vb] = vKeys[i];
      return va + ((vb - va) * (t - a)) / (b - a);
    }
    return vKeys[vKeys.length - 1][1];
  };
  const dtI = 1 / 600;
  const xs = [];
  let x = 0.12;
  for (let t = 0; t <= end + 0.01; t += dtI) {
    xs.push(x);
    const v = t < tTake ? vAt(t) : t < tLand ? vKeys[vKeys.length - 1][1] : vKeys[vKeys.length - 1][1] * Math.max(0, 1 - (t - tLand) / 0.25);
    x += v * dtI;
  }
  const hipXAt = (t) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(t / dtI)))];

  // Hip height above the floor.
  const hipHAt = (t) => {
    if (t >= tTake && t <= tLand) {
      const u = (t - tTake) / T0;
      return standHip * 1.04 + 4 * (jumpCm / 100) * perM * u * (1 - u);
    }
    if (t > tLand) {
      const k = [[0, 1.04], [0.18, 0.8], [0.8, 0.98], [5, 0.98]];
      const [a, b] = [k.findLast((q) => q[0] <= t - tLand), k.find((q) => q[0] > t - tLand)];
      return standHip * lerp(a[1], b[1], ease((t - tLand - a[0]) / (b[0] - a[0])));
    }
    if (t >= tPlant) { // plant: compress then extend onto the toes
      const u = (t - tPlant) / plantContact;
      return standHip * (u < 0.45 ? lerp(0.9 - penDrop, 0.84, ease(u / 0.45)) : lerp(0.84, 1.04, ease((u - 0.45) / 0.55)));
    }
    const run = 0.93;
    if (t >= tPen) return standHip * lerp(run, run - penDrop, ease(Math.min(1, (t - tPen) / (penStep * 0.6))));
    // Running bounce: lower in stance, higher between steps.
    const i = tds.findLastIndex((q) => q <= t);
    const u = i < 0 ? 0.5 : (t - tds[i]) / ((tds[i + 1] ?? tds[i] + 0.25) - tds[i]);
    return standHip * (run - 0.03 * Math.sin(Math.PI * Math.min(1, u * 2)));
  };

  // Foot stances: alternate feet, the plant foot is the opposite of the penultimate.
  const feet = { left: [], right: [] };
  tds.forEach((t, i) => {
    const side = (tds.length - 2 - i) % 2 === 0 ? 'left' : 'right'; // penultimate = left
    const isPlant = i === tds.length - 1, isPen = i === tds.length - 2;
    const dy = hipHAt(t) - ankleH;
    const reach = isPlant ? (dy + ankleH) / Math.tan(rad(plantAngle)) : isPen ? 0.2 * H : 0.12 * H;
    const off = isPlant ? tTake : isPen ? (takeoff === 'one-two' ? tTake : tPen + 0.13) : t + 0.12;
    feet[side].push({ on: t, off, x: hipXAt(t) + reach * dir });
  });
  const landX = { left: hipXAt(tLand) - 0.03 * H, right: hipXAt(tLand) + 0.06 * H };
  const freeSide = takeoff === 'one-foot' ? 'left' : null;

  const footAt = (side, t) => {
    if (t >= tLand) return { x: landX[side], y: G - ankleH, raise: 0 };
    if (t > tTake) { // flight: straight legs under the hips (free knee tucks early on)
      const hx = hipXAt(t), hy = G - hipHAt(t);
      const tuck = side === freeSide ? Math.max(0, 1 - (t - tTake) / (T0 * 0.5)) : 0;
      return { x: hx + (0.02 + 0.18 * tuck) * H * dir, y: hy + (standHip * 1.04 - ankleH - 0.035 * H) - 0.25 * H * tuck, raise: 1 };
    }
    const st = feet[side];
    const cur = st.find((s) => t >= s.on && t <= s.off);
    if (cur) {
      const raise = t > cur.off - 0.06 ? (t - (cur.off - 0.06)) / 0.06 : 0;
      return { x: cur.x, y: G - ankleH - 0.035 * H * raise, raise };
    }
    const next = st.find((s) => s.on > t);
    const prev = [...st].reverse().find((s) => s.off < t);
    if (side === freeSide && !next) { // drive the free knee up into take-off
      const u = Math.min(1, (t - prev.off) / (tTake - prev.off));
      const hx = hipXAt(t), hy = G - hipHAt(t);
      return { x: lerp(prev.x, hx + 0.2 * H * dir, ease(u)), y: lerp(G - ankleH, hy + 0.3 * H, ease(u)), raise: 1 };
    }
    const from = prev ? { x: prev.x, t: prev.off } : { x: (next?.x ?? hipXAt(t)) - 2 * speeds[0] * perM * (next?.on ?? 0.3), t: 0 };
    const to = next ? { x: next.x, t: next.on } : { x: from.x, t: t + 1 };
    // Swing at steady speed (a real swing foot doesn't stop before touchdown).
    const u = Math.max(0, Math.min(1, (t - from.t) / (to.t - from.t)));
    return { x: lerp(from.x, to.x, u), y: G - ankleH - 0.16 * H * Math.sin(Math.PI * u), raise: 0.5 };
  };

  const knee = (hip, ank) => {
    let dx = ank.x - hip.x, dy = ank.y - hip.y;
    let d = Math.hypot(dx, dy);
    const maxD = thigh + shank - 1e-4;
    if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
    const a = Math.acos(Math.min(1, (thigh * thigh + d * d - shank * shank) / (2 * thigh * d)));
    const th = Math.atan2(dy, dx) - a * dir;
    return { x: hip.x + thigh * Math.cos(th), y: hip.y + thigh * Math.sin(th) };
  };
  const leanAt = (t) => {
    if (t < tPen) return 12;
    if (t < tPlant) return lerp(12, plantLean, ease((t - tPen) / (tPlant - tPen)));
    if (t < tTake) return lerp(plantLean, 3, ease((t - tPlant) / plantContact));
    if (t < tLand) return 3;
    return lerp(3, 25, Math.min(1, (t - tLand) / 0.18)) * (t - tLand < 0.5 ? 1 : 0.5);
  };
  // Arm angle: 0 = hanging, 90 = forward, 180 = overhead; negative = behind.
  const armAt = (side, t, legAng) => {
    const run = 10 - legAng;
    if (t < tPen) return run;
    if (t < tPlant) return lerp(run, -55, ease((t - tPen) / (tPlant - tPen)));
    if (t < tTake) return lerp(-55, 165, ease((t - tPlant) / plantContact));
    if (t < tLand) return 165;
    return lerp(165, 30, Math.min(1, (t - tLand) / 0.4));
  };

  const frames = [];
  for (let i = 0; i <= end * fps; i++) {
    const t = i / fps;
    const lm = blank();
    const set = (idx, p, v = 0.95) => { lm[idx] = { x: p.x + noise() * 0.002, y: p.y + noise() * 0.002, v }; };
    const hip = { x: hipXAt(t), y: G - hipHAt(t) };
    const lean = rad(leanAt(t));
    const sh = { x: hip.x + torso * Math.sin(lean) * dir, y: hip.y - torso * Math.cos(lean) };
    set(LM.NOSE, { x: sh.x + 0.05 * H * dir, y: sh.y - 0.1 * H });
    for (const side of ['left', 'right']) {
      const far = side === 'left';
      const v = far ? 0.75 : 0.95;
      const depth = far ? -0.004 : 0;
      const ids = far
        ? { sh: LM.L_SH, el: LM.L_EL, wr: LM.L_WR, hip: LM.L_HIP, kn: LM.L_KN, an: LM.L_AN, he: LM.L_HEEL, to: LM.L_TOE }
        : { sh: LM.R_SH, el: LM.R_EL, wr: LM.R_WR, hip: LM.R_HIP, kn: LM.R_KN, an: LM.R_AN, he: LM.R_HEEL, to: LM.R_TOE };
      const f = footAt(side, t);
      const ank = { x: f.x, y: f.y };
      const kn = knee(hip, ank);
      set(ids.hip, { x: hip.x + depth, y: hip.y }, v);
      set(ids.kn, { x: kn.x + depth, y: kn.y }, v);
      set(ids.an, { x: ank.x + depth, y: ank.y }, v);
      set(ids.he, { x: ank.x - 0.03 * H * dir + depth, y: ank.y + ankleH }, v);
      set(ids.to, { x: ank.x + 0.08 * H * dir + depth, y: ank.y + ankleH + 0.035 * H * f.raise }, v);
      const legAng = (Math.atan2((ank.x - hip.x) * dir, ank.y - hip.y) * 180) / Math.PI;
      const p = rad(armAt(side, t, legAng));
      const el = { x: sh.x + 0.17 * H * Math.sin(p) * dir, y: sh.y + 0.17 * H * Math.cos(p) };
      const q = p + rad(t > tPlant && t < tLand ? 10 : 70);
      const wr = { x: el.x + 0.15 * H * Math.sin(q) * dir, y: el.y + 0.15 * H * Math.cos(q) };
      set(ids.sh, { x: sh.x + depth, y: sh.y }, v);
      set(ids.el, { x: el.x + depth, y: el.y }, v);
      set(ids.wr, { x: wr.x + depth, y: wr.y }, v);
    }
    frames.push({ t, lm });
  }
  return {
    frames, aspect: 16 / 9, mode: 'jump', jumpType: 'approach', athlete: { heightCm: athleteCm },
    label: 'Demo: run-up dunk attempt (side view)',
    truth: { tPen, tPlant, tTake, tLand, jumpCm, plantContact, steps: tds.length - 1 },
  };
}
