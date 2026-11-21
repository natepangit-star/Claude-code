// Run-up visuals: phase ribbon, stroboscopic "ghost" sequence, step-rhythm
// chart and flaw cards. Pure HTML/SVG strings so the same markup works in the
// app and in the downloadable report.
import { t } from './i18n.js';
import { localDefs, formatMetric, formatLen } from './metrics.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ROLE_COLOR = {
  approach: 'var(--muted)', penultimate: 'var(--c2)', plant: 'var(--accent)',
  takeoff: 'var(--bad)', peak: 'var(--c3)', flight: 'var(--c3)', landing: 'var(--c1)',
};
const ROLE_LABEL = {
  approach: 'Run-up', penultimate: 'Penultimate', plant: 'Plant', takeoff: 'Take-off', peak: 'Peak', flight: 'Flight', landing: 'Landing',
};

// Which metrics belong to which phase (for phase grades and flaw badges).
export const PHASE_METRICS = {
  approach: ['speedKeep', 'stepRhythm'],
  penultimate: ['penultimateRatio', 'penultimateDrop'],
  plant: ['plantContact', 'plantAngle', 'plantLean', 'loadDepth'],
  takeoff: ['armDrive', 'takeoffExtension', 'freeKnee'],
  landing: ['landingFlex', 'kneeValgus'],
};
const METRIC_PHASE = Object.fromEntries(Object.entries(PHASE_METRICS).flatMap(([p, ks]) => ks.map((k) => [k, p])));
const RUNUP_KEYS = new Set([...PHASE_METRICS.approach, ...PHASE_METRICS.penultimate, 'plantContact', 'plantAngle', 'plantLean', 'freeKnee']);

const gradeClass = (s) => (s == null ? 'na' : s >= 85 ? 'good' : s >= 70 ? 'ok' : 'bad');

/** Flaws for one jump, worst first: run-up flaws plus any take-off/landing ones. */
export function runupFlaws(session, rep) {
  const defs = localDefs(session);
  const out = [];
  for (const [key, m] of Object.entries(rep.metrics)) {
    const def = defs[key];
    if (!def?.ideal || m.score == null || m.score >= 85) continue;
    const side = m.value < def.ideal[0] ? def.low : def.high;
    if (!side) continue;
    out.push({ key, phase: METRIC_PHASE[key] || 'takeoff', score: m.score, value: formatMetric(def, m.value), ideal: def.ideal, def, ...side, runup: RUNUP_KEYS.has(key) });
  }
  // Stutter steps are visible as individual steps too.
  return out.sort((a, b) => a.score - b.score);
}

function phaseScores(rep) {
  const res = {};
  for (const [phase, keys] of Object.entries(PHASE_METRICS)) {
    const s = keys.map((k) => rep.metrics[k]?.score).filter((v) => v != null);
    res[phase] = s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  }
  return res;
}

/** Horizontal ribbon of phases with durations and grades. */
function phaseRibbon(rep) {
  const ph = rep.approach.phases;
  const t0 = ph[0].t0, t1 = ph[ph.length - 1].t1;
  const scores = phaseScores(rep);
  const W = 1000;
  let x = 0;
  const segs = ph.map((p) => {
    const w = Math.max(70, ((p.t1 - p.t0) / (t1 - t0)) * W);
    const seg = { ...p, x, w };
    x += w;
    return seg;
  });
  const k = W / x; // squeeze back to full width after enforcing a minimum
  const score = (key) => (key === 'flight' ? null : scores[key]);
  return `<svg class="ribbon" viewBox="0 0 ${W} 64" role="img" aria-label="${esc(t('Jump phases'))}">
    ${segs.map((s) => {
      const sx = s.x * k, sw = s.w * k;
      const sc = score(s.key);
      return `<g data-seek="${s.t0.toFixed(3)}" class="seekable">
        <rect x="${(sx + 1).toFixed(1)}" y="4" width="${(sw - 2).toFixed(1)}" height="34" rx="8" fill="${ROLE_COLOR[s.key]}" opacity="0.9"/>
        <text x="${(sx + sw / 2).toFixed(1)}" y="26" text-anchor="middle" class="rib-t">${esc(t(ROLE_LABEL[s.key]))}</text>
        <text x="${(sx + sw / 2).toFixed(1)}" y="56" text-anchor="middle" class="rib-s">${(s.t1 - s.t0).toFixed(2)}s${sc != null ? ` · <tspan class="g-${gradeClass(sc)}">${sc}</tspan>` : ''}</text>
      </g>`;
    }).join('')}
  </svg>`;
}

const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30]];

/** Stroboscopic sequence: each step's pose drawn as a ghost along the run. */
function ghostStrip(session, rep, flaws) {
  const A = rep.approach;
  const poses = A.poses.filter((p) => p.pose);
  if (!poses.length) return '';
  const pts = poses.flatMap((p) => Object.values(p.pose));
  const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
  const hipX = (p) => ((p.pose[23]?.[0] ?? 0) + (p.pose[24]?.[0] ?? 0)) / 2;
  const H = 262, pad = 44, W = 1000;
  const sy = (H - pad * 2) / Math.max(1e-6, maxY - minY);
  // Side-on: real positions (a true stroboscope). Otherwise: evenly spaced.
  let placeX;
  if (A.sideOn) {
    const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
    const s = Math.min(sy, (W - pad * 2) / Math.max(1e-6, maxX - minX));
    placeX = (p, x) => pad + (x - minX) * s * (A.dir < 0 ? -1 : 1) + (A.dir < 0 ? (maxX - minX) * s : 0);
    poses.forEach((p) => { p.s = s; });
  } else {
    const slot = (W - pad * 2) / poses.length;
    placeX = (p, x, i) => pad + slot * (i + 0.5) + (x - hipX(p)) * p.s;
    poses.forEach((p) => {
      const ys = Object.values(p.pose).map((q) => q[1]);
      p.s = Math.min(sy, (slot * 1.6) / Math.max(1e-6, (Math.max(...ys) - Math.min(...ys)) * 0.6));
    });
  }
  const Y = (p, y) => pad + (y - minY) * (A.sideOn ? p.s : sy);
  const opacity = { approach: 0.35, penultimate: 0.8, plant: 1, takeoff: 1, peak: 0.75, landing: 0.45 };
  // Numbered flaw badges sit above the pose they belong to (a stutter on the stutter step).
  const badges = {};
  const stutterIdx = poses.findIndex((p) => p.stutter);
  flaws.forEach((f, i) => {
    const where = f.key === 'stepRhythm' && stutterIdx >= 0 ? `#${stutterIdx}` : f.phase === 'approach' ? 'penultimate' : f.phase;
    (badges[where] ||= []).push(i + 1);
  });
  // Stagger labels onto two rows when figures are close together.
  let lastX = -Infinity, row = 0;
  const labelRow = poses.map((p, i) => {
    const hx = placeX(p, hipX(p), i);
    row = hx - lastX < 90 ? 1 - row : 0;
    lastX = hx;
    return row;
  });
  const figs = poses.map((p, i) => {
    const P = (k) => p.pose[k] && [placeX(p, p.pose[k][0], i), Y(p, p.pose[k][1])];
    const col = p.stutter ? 'var(--bad)' : ROLE_COLOR[p.role];
    const lines = BONES.map(([a, b]) => {
      const pa = P(a), pb = P(b);
      return pa && pb ? `<line x1="${pa[0].toFixed(1)}" y1="${pa[1].toFixed(1)}" x2="${pb[0].toFixed(1)}" y2="${pb[1].toFixed(1)}"/>` : '';
    }).join('');
    const head = P(0);
    const hx = placeX(p, hipX(p), i);
    const top = Math.min(...Object.keys(p.pose).map((k) => P(k)[1]));
    const tag = p.stutter ? t('Stutter') : t(ROLE_LABEL[p.role]);
    const b = [...(badges[p.role] && p.role !== 'approach' ? badges[p.role] : []), ...(badges[`#${i}`] || [])].map((n, j) => `<g><circle cx="${(hx + 14 * j).toFixed(1)}" cy="${(top - 16).toFixed(1)}" r="9" class="badge"/><text x="${(hx + 14 * j).toFixed(1)}" y="${(top - 12).toFixed(1)}" text-anchor="middle" class="badge-t">${n}</text></g>`).join('');
    const xs = Object.keys(p.pose).map((k) => P(k)[0]);
    const hit = `<rect x="${(Math.min(...xs) - 8).toFixed(1)}" y="${(top - 8).toFixed(1)}" width="${(Math.max(...xs) - Math.min(...xs) + 16).toFixed(1)}" height="${(H - top + 8).toFixed(1)}" fill="transparent" stroke="none"/>`;
    return `<g class="ghost seekable" data-seek="${p.t.toFixed(3)}" stroke="${col}" opacity="${opacity[p.role] ?? 0.6}">
      ${hit}${lines}${head ? `<circle cx="${head[0].toFixed(1)}" cy="${head[1].toFixed(1)}" r="5" fill="${col}" stroke="none"/>` : ''}
      <text x="${hx.toFixed(1)}" y="${H - 22 + 17 * labelRow[i]}" text-anchor="middle" class="ghost-t" fill="${col}" stroke="none">${esc(tag)}</text>
      ${b}
    </g>`;
  }).join('');
  return `<svg class="ghosts" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Run-up sequence'))}">
    <line x1="0" x2="${W}" y1="${(H - pad + 6).toFixed(1)}" y2="${(H - pad + 6).toFixed(1)}" class="floor"/>
    ${figs}
  </svg>`;
}

/** Step bars: length (side-on) or time per step, with the long–short target and speed line. */
function rhythmChart(rep) {
  const A = rep.approach;
  const steps = A.steps.filter((s) => s.stepTime != null);
  if (!steps.length) return '';
  const useLen = A.sideOn && steps.every((s) => s.stepLen != null);
  const val = (s) => (useLen ? (s.stepLenCm ?? s.stepLen) : s.stepTime);
  const max = Math.max(...steps.map(val)) * 1.15;
  const W = 1000, H = 190, padB = 46, padT = 18;
  const bw = Math.min(120, (W - 40) / steps.length - 24);
  const gap = (W - steps.length * bw) / (steps.length + 1);
  const speeds = steps.map((s) => s.speedMs ?? s.speed);
  const hasSpeed = speeds.every((v) => v != null);
  const smax = hasSpeed ? Math.max(...speeds) * 1.15 : 1;
  const y = (v) => H - padB - (v / max) * (H - padB - padT);
  const ys = (v) => H - padB - (v / smax) * (H - padB - padT);
  const fmtV = (s) => (useLen ? (s.stepLenCm != null ? formatLen(s.stepLenCm) : `${s.stepLen.toFixed(2)}`) : `${s.stepTime.toFixed(2)}s`);
  const bars = steps.map((s, i) => {
    const x = gap + i * (bw + gap);
    const col = s.stutter ? 'var(--bad)' : ROLE_COLOR[s.role];
    const name = s.role === 'approach' ? t('Step {n}', { n: i + 1 }) : t(ROLE_LABEL[s.role]);
    return `<g class="seekable" data-seek="${s.tOn.toFixed(3)}">
      <rect x="${x.toFixed(1)}" y="${y(val(s)).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - padB - y(val(s))).toFixed(1)}" rx="6" fill="${col}" opacity="0.85"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y(val(s)) - 6).toFixed(1)}" text-anchor="middle" class="bar-t">${esc(fmtV(s))}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" class="bar-n">${esc(name)}${s.stutter ? ' ⚠' : ''}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - padB + 34}" text-anchor="middle" class="bar-c">${esc(t('{v}s on floor', { v: s.contact.toFixed(2) }))}</text>
    </g>`;
  }).join('');
  const line = hasSpeed
    ? `<polyline class="spd" points="${steps.map((s, i) => `${(gap + i * (bw + gap) + bw / 2).toFixed(1)},${ys(speeds[i]).toFixed(1)}`).join(' ')}"/>
       ${steps.map((s, i) => `<circle class="spd-d" cx="${(gap + i * (bw + gap) + bw / 2).toFixed(1)}" cy="${ys(speeds[i]).toFixed(1)}" r="4"/>`).join('')}`
    : '';
  // Target: penultimate longer than the plant step.
  const n = steps.length;
  const hint = n >= 2 && useLen
    ? `<text x="${(gap + (n - 2) * (bw + gap) + bw + gap / 2).toFixed(1)}" y="${padT}" text-anchor="middle" class="hint">${esc(t('target: long → short'))}</text>` : '';
  const unit = hasSpeed ? (steps[0].speedMs != null ? 'm/s' : t('torso/s')) : '';
  return `<div class="rhythm">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Step rhythm'))}">${bars}${line}${hint}</svg>
    <div class="rhythm-legend small muted">${esc(useLen ? t('Bars: step length') : t('Bars: step time'))}${hasSpeed ? ` · <span class="spd-key"></span> ${esc(t('Speed ({u})', { u: unit }))}` : ''}</div>
  </div>`;
}

/** Full run-up section for one jump. `interactive` adds "watch" buttons. */
export function approachHtml(session, rep, { interactive = false } = {}) {
  const A = rep.approach;
  if (!A) return '';
  const flaws = runupFlaws(session, rep);
  const style = { 'one-two': '1-2 step (two-foot)', 'two-foot': 'Two-foot jump stop', 'one-foot': 'One-foot take-off' }[A.takeoff];
  const m = rep.metrics;
  const chips = [
    t(style),
    t('{n} run-up steps', { n: A.steps.length - 1 }),
    m.approachSpeed ? t('{v} m/s into the plant', { v: m.approachSpeed.value.toFixed(1) }) : null,
    m.plantContact ? t('plant {v}s', { v: m.plantContact.value.toFixed(2) }) : null,
  ].filter(Boolean);
  const card = (f, i) => `
    <div class="flaw">
      <div class="flaw-head"><span class="flaw-n">${i + 1}</span><b>${esc(f.issue)}</b>
        <span class="phase-tag" style="background:${ROLE_COLOR[f.phase]}">${esc(t(ROLE_LABEL[f.phase]))}</span></div>
      <div class="small muted">${esc(f.def.label)}: <b>${esc(f.value)}</b></div>
      <p class="small">${esc(f.tip)}</p>
      <p class="drill small"><span>${esc(t('Drill'))}</span>${esc(f.drill)}</p>
      ${interactive ? `<button class="link small" data-seek="${(rep.events.find((e) => e.type === (f.phase === 'approach' ? 'penultimate' : f.phase))?.t ?? A.plantT).toFixed(3)}">▶ ${esc(t('Watch this moment'))}</button>` : ''}
    </div>`;
  const TOP = 4;
  const cards = !flaws.length
    ? `<p>${esc(t(A.sideOn
      ? 'Clean run-up: no clear flaws found. Next, try one more approach step or a little more speed.'
      : 'No flaws found in what this camera angle can measure. Film the run-up side-on to also check step lengths, speed and the plant angle.'))}</p>`
    : `<div class="flaws">${flaws.slice(0, TOP).map(card).join('')}</div>${flaws.length > TOP
      ? `<details class="more"><summary>${esc(t('+{n} more', { n: flaws.length - TOP }))}</summary><div class="flaws">${flaws.slice(TOP).map((f, i) => card(f, i + TOP)).join('')}</div></details>` : ''}`;
  const angleNote = A.sideOn ? '' : `<p class="small muted">${esc(t('Step lengths, speed and plant angles need a side-on view of the run-up. From this angle, timing, contact and hip lowering are measured.'))}</p>`;
  return `<div class="runup">
    <div class="runup-head"><h3>${esc(t('Run-up to take-off'))}</h3><div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div></div>
    <div class="hscroll">${phaseRibbon(rep)}</div>
    <div class="hscroll">${ghostStrip(session, rep, flaws)}</div>
    <div class="hscroll">${rhythmChart(rep)}</div>
    ${angleNote}
    <h4>${esc(t('What to fix, in order'))}</h4>
    ${cards}
  </div>`;
}

export const APPROACH_CSS = `
.runup h3{margin:0}
.runup h4{margin:16px 0 8px;font-size:.95rem}
.runup-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.runup svg{width:100%;height:auto;display:block}
.runup .hscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
@media (max-width:640px){.runup .hscroll>svg,.runup .hscroll>.rhythm{min-width:620px}}
.ribbon .rib-t{fill:#fff;font-size:15px;font-weight:700}
.ribbon .rib-s{fill:var(--muted);font-size:13px}
.ribbon .g-good{fill:var(--good);font-weight:700}.ribbon .g-ok{fill:var(--ok);font-weight:700}.ribbon .g-bad{fill:var(--bad);font-weight:700}
.ghosts{background:linear-gradient(180deg,var(--chip),transparent);border-radius:12px;margin:10px 0}
.ghosts line{stroke-width:3.5;stroke-linecap:round}
.ghosts .floor{stroke:var(--border);stroke-width:2}
.ghosts .ghost-t{font-size:13px;font-weight:700}
.ghosts .badge{fill:var(--bad);stroke:#fff;stroke-width:2}
.ghosts .badge-t{fill:#fff;font-size:11px;font-weight:700;stroke:none}
.seekable{cursor:pointer}
.rhythm .bar-t{fill:var(--text);font-size:14px;font-weight:700}
.rhythm .bar-n{fill:var(--text);font-size:13px}
.rhythm .bar-c{fill:var(--muted);font-size:12px}
.rhythm .hint{fill:var(--c2);font-size:13px;font-weight:700}
.rhythm .spd{fill:none;stroke:var(--text);stroke-width:2.5;stroke-dasharray:6 4}
.rhythm .spd-d{fill:var(--text)}
.spd-key{display:inline-block;width:18px;border-top:2.5px dashed var(--text);vertical-align:middle}
.flaws{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:10px}
.more{margin-top:10px}.more summary{cursor:pointer;color:var(--accent);font-weight:600}.more .flaws{margin-top:10px}
.flaw{border:1px solid var(--border);border-radius:12px;padding:10px 12px}
.flaw p{margin:6px 0}
.flaw-head{display:flex;align-items:center;gap:8px}
.flaw-head b{flex:1}
.flaw-n{width:22px;height:22px;border-radius:50%;background:var(--bad);color:#fff;display:inline-grid;place-items:center;font-size:.8rem;font-weight:700;flex:none}
.phase-tag{color:#fff;font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 8px}
`;
