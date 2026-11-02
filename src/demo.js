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
