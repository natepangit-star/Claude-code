// The static report: one HTML builder used both for the in-app "Summary" tab
// and for the downloadable stand-alone HTML file.
import { MODES, formatMetric, formatIdeal } from './metrics.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function scoreClass(s) {
  if (s == null) return 'na';
  if (s >= 85) return 'good';
  if (s >= 70) return 'ok';
  return 'bad';
}

export function ring(score, size = 120) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const p = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return `<svg class="ring ${scoreClass(score)}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Score ${score ?? 'n/a'} out of 100">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="10" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="10" fill="none" stroke-linecap="round"
      stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="ring-text" font-size="${size * 0.3}">${score ?? '—'}</text>
  </svg>`;
}

/** Horizontal gauge: ideal band + marker(s) for the measured value(s). */
export function rangeBar(def, mean, values = []) {
  if (!def.ideal) return '';
  let [lo, hi] = def.ideal;
  const tol = def.tol;
  const bandLo = def.low == null ? Math.max(lo, hi - 3 * tol) : lo;
  const bandHi = def.high == null ? Math.min(hi, lo + 3 * tol) : hi;
  const dLo = def.low == null ? bandLo : bandLo - 1.5 * tol;
  const dHi = def.high == null ? bandHi : bandHi + 1.5 * tol;
  const pos = (v) => (100 * (Math.max(dLo, Math.min(dHi, v)) - dLo)) / (dHi - dLo);
  const dots = values.filter((v) => v != null).map((v) => `<span class="rb-dot" style="left:${pos(v).toFixed(1)}%"></span>`).join('');
  return `<div class="rb" aria-hidden="true">
    <span class="rb-band" style="left:${pos(bandLo).toFixed(1)}%;width:${(pos(bandHi) - pos(bandLo)).toFixed(1)}%"></span>
    ${dots}
    ${mean != null ? `<span class="rb-mark" style="left:${pos(mean).toFixed(1)}%"></span>` : ''}
  </div>`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

/**
 * @param session analysis result
 * @param {{keyframes?: Array<{rep:string, items:Array<{label:string, src:string}>}>, timelineImg?: string, title?: string}} extra
 */
export function summaryHtml(session, extra = {}) {
  const S = session.summary;
  const defs = MODES[session.mode].metrics;
  const isShot = session.mode === 'shooting';
  const repWord = isShot ? 'shots' : 'sets';
  const metricRows = Object.entries(S.metrics).map(([key, m]) => {
    const def = defs[key];
    return `<div class="mrow">
      <div class="mrow-head">
        <span class="mrow-label">${esc(def.label)}</span>
        <span class="pill ${scoreClass(m.score)}">${m.score ?? 'info'}</span>
      </div>
      <div class="mrow-vals">
        <span><b>${esc(formatMetric(def, m.mean))}</b>${m.sd != null && m.n > 1 ? ` <span class="muted">± ${esc(formatMetric({ ...def, format: null, unit: def.unit }, m.sd))}</span>` : ''}</span>
        <span class="muted">ideal ${esc(formatIdeal(def))}</span>
      </div>
      ${rangeBar(def, m.mean, m.n > 1 ? m.values : [])}
    </div>`;
  }).join('');

  const repBars = session.reps.length > 1 ? `
    <section class="card">
      <h3>Score by ${isShot ? 'shot' : 'set'}</h3>
      <div class="bars">
        ${session.reps.map((r) => `<div class="bar-row"><span class="bar-label">${esc(r.label)}</span>
          <span class="bar-track"><span class="bar-fill ${scoreClass(r.score)}" style="width:${r.score ?? 0}%"></span></span>
          <span class="bar-val">${r.score ?? '—'}</span></div>`).join('')}
      </div>
    </section>` : '';

  const focus = S.focus.length ? S.focus.map((f, i) => `
    <div class="focus">
      <div class="focus-head"><span class="focus-n">${i + 1}</span><b>${esc(f.issue)}</b><span class="pill ${scoreClass(f.score)}">${f.score}</span></div>
      <p class="muted small">${esc(f.label)}${f.worstShot ? ` · most visible on ${esc(f.worstShot)}` : ''}</p>
      <p>${esc(f.tip)}</p>
      <p class="drill"><span>Drill</span>${esc(f.drill)}</p>
    </div>`).join('') : '<p>No major issues found. Keep stacking quality reps and re-test from a new spot or a longer distance.</p>';

  const strengths = S.strengths.length
    ? `<ul class="checks">${S.strengths.map((s) => `<li><b>${esc(s.label)}</b><span class="muted small">${esc(s.why)}</span></li>`).join('')}</ul>`
    : '<p class="muted">Strengths will show here once a metric is consistently in the ideal range.</p>';

  const plan = `<ol class="plan">${S.plan.map((d) => `<li><b>${esc(d.day)}</b><ul>${d.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>`).join('')}</ol>`;

  const kf = extra.keyframes?.length ? `
    <section class="card wide">
      <h3>Key positions</h3>
      ${extra.keyframes.map((k) => `<div class="kf-rep"><div class="muted small">${esc(k.rep)}</div><div class="kf-row">
        ${k.items.map((it) => `<figure><img src="${it.src}" alt="${esc(k.rep)} ${esc(it.label)}"/><figcaption>${esc(it.label)}</figcaption></figure>`).join('')}
      </div></div>`).join('')}
    </section>` : '';

  const timeline = extra.timelineImg ? `<section class="card wide"><h3>Movement timeline</h3><img class="timeline-img" src="${extra.timelineImg}" alt="Joint angle timeline"/></section>` : '';

  const warnings = session.warnings.length
    ? `<div class="warn">${session.warnings.map((w) => `<p>${esc(w)}</p>`).join('')}</div>` : '';

  return `<div class="report">
    <header class="rep-head card wide">
      ${ring(S.overall)}
      <div class="rep-meta">
        <div class="eyebrow">${esc(MODES[session.mode].label)}${extra.title ? ` · ${esc(extra.title)}` : ''}</div>
        <h2>${esc(S.grade.label)} <span class="grade">${esc(S.grade.letter)}</span></h2>
        <div class="chips">
          <span class="chip">${session.reps.length} ${session.reps.length === 1 && isShot ? 'shot' : repWord}${!isShot && session.reps[0]?.dribbleCount ? ` · ${session.reps[0].dribbleCount} dribbles` : ''}</span>
          <span class="chip">${esc(session.view)} view</span>
          <span class="chip">${esc(session.hand)} hand</span>
          <span class="chip">${session.duration.toFixed(1)} s</span>
          <span class="chip">${esc(fmtDate(session.createdAt))}</span>
        </div>
        <div class="subscores">
          <span>Form <b>${S.formScore ?? '—'}</b></span>
          ${S.consistency != null ? `<span>Consistency <b>${S.consistency}</b></span>` : ''}
        </div>
      </div>
    </header>
    ${warnings}
    <div class="grid">
      <section class="card"><h3>Focus areas</h3>${focus}</section>
      <section class="card"><h3>Strengths</h3>${strengths}</section>
      <section class="card"><h3>Metrics</h3><div class="mlist">${metricRows}</div>
        <p class="muted small">Orange marker = average${session.reps.length > 1 ? ', dots = individual ' + repWord : ''}. Shaded band = ideal range.</p></section>
      ${repBars}
      <section class="card"><h3>5-day practice plan</h3>${plan}</section>
      ${timeline}
      ${kf}
    </div>
    <p class="muted small foot">Measured from 2D pose tracking (${esc(session.view)} view). Angles are estimates; film from the same angle each time to track progress reliably.</p>
  </div>`;
}

export const REPORT_CSS = `
.report{display:flex;flex-direction:column;gap:16px}
.report .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.report .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px}
.report .card.wide{grid-column:1/-1}
.report h2{margin:2px 0 8px;font-size:1.6rem}
.report h3{margin:0 0 12px;font-size:1rem;letter-spacing:.02em}
.report .muted{color:var(--muted)}
.report .small{font-size:.85rem}
.rep-head{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.rep-meta{flex:1;min-width:220px}
.eyebrow{text-transform:uppercase;font-size:.75rem;letter-spacing:.08em;color:var(--muted)}
.grade{display:inline-block;margin-left:6px;padding:0 10px;border-radius:8px;background:var(--accent);color:#fff;font-size:1.1rem;vertical-align:middle}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.chip{background:var(--chip);border-radius:999px;padding:3px 10px;font-size:.8rem}
.subscores{display:flex;gap:16px;color:var(--muted)}
.subscores b{color:var(--text)}
.ring .ring-bg{stroke:var(--chip)}
.ring.good .ring-fg{stroke:var(--good)} .ring.ok .ring-fg{stroke:var(--ok)} .ring.bad .ring-fg{stroke:var(--bad)} .ring.na .ring-fg{stroke:var(--muted)}
.ring-text{fill:var(--text);font-weight:700}
.pill{font-size:.75rem;font-weight:700;border-radius:999px;padding:2px 9px;color:#fff;background:var(--muted)}
.pill.good{background:var(--good)} .pill.ok{background:var(--ok)} .pill.bad{background:var(--bad)}
.mlist{display:flex;flex-direction:column;gap:14px}
.mrow-head,.mrow-vals{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.mrow-label{font-weight:600}
.mrow-vals{font-size:.9rem;margin:2px 0 6px}
.rb{position:relative;height:10px;border-radius:5px;background:var(--chip)}
.rb-band{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--good) 45%,transparent);border-radius:5px}
.rb-mark{position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;border-radius:2px;background:var(--accent)}
.rb-dot{position:absolute;top:2px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--text);opacity:.55}
.focus{padding:12px 0;border-top:1px solid var(--border)}
.focus:first-of-type{border-top:0;padding-top:0}
.focus p{margin:6px 0}
.focus-head{display:flex;align-items:center;gap:8px}
.focus-head b{flex:1}
.focus-n{width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;display:inline-grid;place-items:center;font-size:.8rem;font-weight:700}
.drill{background:var(--chip);border-radius:10px;padding:8px 10px;font-size:.9rem}
.drill span{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:700}
.checks{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.checks li{display:flex;flex-direction:column;padding-left:26px;position:relative}
.checks li:before{content:"✓";position:absolute;left:0;top:0;color:var(--good);font-weight:700}
.plan{margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:10px}
.plan>li>ul{margin:4px 0 0;padding-left:18px;font-size:.9rem}
.bars{display:flex;flex-direction:column;gap:8px}
.bar-row{display:grid;grid-template-columns:70px 1fr 34px;gap:10px;align-items:center;font-size:.9rem}
.bar-track{height:12px;background:var(--chip);border-radius:6px;overflow:hidden}
.bar-fill{display:block;height:100%;border-radius:6px;background:var(--muted)}
.bar-fill.good{background:var(--good)} .bar-fill.ok{background:var(--ok)} .bar-fill.bad{background:var(--bad)}
.bar-val{text-align:right;font-weight:700}
.kf-rep{margin-bottom:12px}
.kf-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px}
.kf-row figure{margin:0;flex:0 0 auto}
.kf-row img{height:150px;border-radius:8px;display:block}
.kf-row figcaption{font-size:.8rem;color:var(--muted);margin-top:4px}
.timeline-img{width:100%;border-radius:8px;background:var(--surface)}
.warn{background:color-mix(in srgb,var(--ok) 18%,var(--surface));border:1px solid var(--ok);border-radius:12px;padding:4px 14px}
.foot{text-align:center}
`;

export const THEME_CSS = `
:root{--bg:#f5f3ef;--surface:#ffffff;--text:#1d1b19;--muted:#6f6a63;--border:#e5e0d8;--chip:#efebe5;--accent:#e8620c;--good:#1f9d63;--ok:#d89614;--bad:#d4473a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0f1115;--surface:#181b21;--text:#eceae6;--muted:#9a958d;--border:#2a2e36;--chip:#242830;--accent:#ff7a1a;--good:#34c27f;--ok:#e6a92b;--bad:#ef6253}}
:root[data-theme="dark"]{--bg:#0f1115;--surface:#181b21;--text:#eceae6;--muted:#9a958d;--border:#2a2e36;--chip:#242830;--accent:#ff7a1a;--good:#34c27f;--ok:#e6a92b;--bad:#ef6253}
`;

/** A self-contained HTML document for download / sharing / printing. */
export function standaloneHtml(session, extra) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>HoopLab report – ${esc(fmtDate(session.createdAt))}</title>
<style>${THEME_CSS}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1080px;margin:0 auto;padding:24px 16px}
.brand{font-weight:800;letter-spacing:.02em;margin-bottom:12px}.brand span{color:var(--accent)}
@media print{body{background:#fff}.report .card{break-inside:avoid}}
${REPORT_CSS}</style></head>
<body><main><div class="brand">Hoop<span>Lab</span> · Skill report</div>${summaryHtml(session, extra)}</main></body></html>`;
}
