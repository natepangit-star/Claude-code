// Draws a pose skeleton onto a 2D canvas context.
import { LM } from './analysis.js';

const BONES = [
  [LM.L_SH, LM.R_SH], [LM.L_SH, LM.L_HIP], [LM.R_SH, LM.R_HIP], [LM.L_HIP, LM.R_HIP],
  [LM.L_SH, LM.L_EL], [LM.L_EL, LM.L_WR], [LM.R_SH, LM.R_EL], [LM.R_EL, LM.R_WR],
  [LM.L_HIP, LM.L_KN], [LM.L_KN, LM.L_AN], [LM.R_HIP, LM.R_KN], [LM.R_KN, LM.R_AN],
];

/**
 * @param ctx canvas 2D context
 * @param lm landmarks in video-height units
 * @param w,h canvas size in pixels
 * @param hand 'left'|'right' arm to highlight
 */
export function drawSkeleton(ctx, lm, w, h, { hand = 'right', color = '#ffffff', accent = '#ff7a1a', lineWidth } = {}) {
  if (!lm) return;
  const s = h; // x and y both in video-height units
  const P = (i) => (lm[i] && (lm[i].v ?? 1) >= 0.4 ? [lm[i].x * s, lm[i].y * s] : null);
  const lw = lineWidth ?? Math.max(2, h / 140);
  const hl = hand === 'left' ? [LM.L_SH, LM.L_EL, LM.L_WR] : [LM.R_SH, LM.R_EL, LM.R_WR];
  ctx.save();
  ctx.lineCap = 'round';
  for (const [a, b] of BONES) {
    const pa = P(a), pb = P(b);
    if (!pa || !pb) continue;
    const isHl = hl.includes(a) && hl.includes(b);
    ctx.strokeStyle = isHl ? accent : color;
    ctx.globalAlpha = isHl ? 1 : 0.85;
    ctx.lineWidth = isHl ? lw * 1.4 : lw;
    ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const i of [LM.NOSE, LM.L_SH, LM.R_SH, LM.L_EL, LM.R_EL, LM.L_WR, LM.R_WR, LM.L_HIP, LM.R_HIP, LM.L_KN, LM.R_KN, LM.L_AN, LM.R_AN]) {
    const p = P(i);
    if (!p) continue;
    ctx.fillStyle = hl.includes(i) ? accent : color;
    ctx.beginPath(); ctx.arc(p[0], p[1], (i === LM.NOSE ? 2.2 : 1.4) * lw, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function nearestFrame(frames, t) {
  if (!frames.length) return null;
  let lo = 0, hi = frames.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (frames[m].t < t) lo = m; else hi = m;
  }
  return Math.abs(frames[lo].t - t) <= Math.abs(frames[hi].t - t) ? frames[lo] : frames[hi];
}
