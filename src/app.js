import './style.css';
import { analyzeSession } from './analysis.js';
import { MODES, formatMetric, formatIdeal } from './metrics.js';
import { summaryHtml, standaloneHtml, rangeBar, scoreClass, ring, REPORT_CSS } from './summary.js';
import { timelineChart, progressChart } from './charts.js';
import { Player } from './player.js';
import { demoShooting, demoDribbling } from './demo.js';
import { listSessions, saveSession, getSession, deleteSession, clearSessions } from './storage.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Report styles are shared with the downloadable file.
const style = document.createElement('style');
style.textContent = REPORT_CSS;
document.head.appendChild(style);

// ------------------------------------------------------------------ theme
const THEME_KEY = 'hooplab.theme';
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch { /* ignore */ }
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  if (state.current) renderReport(state.current, { keepTab: true });
  if (location.hash === '#progress') renderProgress();
};

// ------------------------------------------------------------------ routing
const state = { file: null, current: null, player: null, chart: null, progress: null, abort: null, rep: 0 };

function route() {
  const v = (location.hash || '#analyze').slice(1).split('/')[0];
  const view = ['analyze', 'report', 'progress'].includes(v) ? v : 'analyze';
  $$('.view').forEach((el) => { el.hidden = el.id !== `view-${view}`; });
  $$('nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  if (view === 'progress') renderProgress();
  if (view === 'report' && state.chart) state.chart.chart.resize();
}
window.addEventListener('hashchange', route);

/** Show the report view before rendering so charts measure a visible canvas. */
function showReportView() {
  if (location.hash !== '#report') history.pushState(null, '', '#report');
  route();
}

// ------------------------------------------------------------------ upload
const preview = $('#preview');
const fileInput = $('#file');
const drop = $('#drop');

function setFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name)) {
    showError('Please choose a video file.');
    return;
  }
  state.file = file;
  hideError();
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  $('#dropInner').hidden = true;
  preview.onloadedmetadata = () => {
    const d = Number.isFinite(preview.duration) ? preview.duration : 60;
    $('#tStart').value = 0;
    $('#tEnd').value = Math.min(d, 60).toFixed(1);
    $('#tEnd').max = d.toFixed(1);
    $('#trim').hidden = false;
    $('#analyzeBtn').disabled = false;
    if (d > 60) showError('Long video: only the first 60 s are selected. Adjust Start/End to pick the part you want analyzed.', 'info');
  };
}
fileInput.onchange = () => setFile(fileInput.files[0]);
drop.addEventListener('click', (e) => { if (e.target === preview) e.preventDefault(); });
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
$('#useCurrent').onclick = (e) => { e.preventDefault(); $('#tStart').value = preview.currentTime.toFixed(1); };

function showError(msg, kind = 'error') {
  const el = $('#error');
  el.textContent = msg;
  el.className = kind === 'info' ? 'info' : 'error';
  el.hidden = false;
}
function hideError() { $('#error').hidden = true; }

function opts() {
  return {
    mode: document.querySelector('input[name=mode]:checked').value,
    hand: $('#hand').value,
    view: $('#view').value,
    quality: $('#quality').value,
  };
}

$('#analyzeBtn').onclick = async () => {
  if (!state.file) return;
  const o = opts();
  hideError();
  $('#analyzeBtn').disabled = true;
  $('#cancelBtn').hidden = false;
  $('#progress').hidden = false;
  setProgress(0, 'Loading video…');
  state.abort = new AbortController();
  try {
    const { loadVideo, extractPoses } = await import('./pose.js');
    const video = document.createElement('video');
    await loadVideo(video, state.file);
    const start = Number($('#tStart').value) || 0;
    const end = Number($('#tEnd').value) || Infinity;
    const { frames, aspect, offset } = await extractPoses(video, {
      quality: o.quality,
      fps: o.mode === 'dribbling' ? 20 : 15,
      start,
      end,
      signal: state.abort.signal,
      onStatus: (s) => setProgress(null, s),
      onProgress: (p) => setProgress(p, `Tracking your movement… ${Math.round(p * 100)}%`),
    });
    setProgress(1, 'Crunching the numbers…');
    const session = analyzeSession(frames, o);
    if (session.error) throw new Error(session.error);
    await finishSession(session, { frames, aspect, video, offset, title: state.file.name });
  } catch (err) {
    if (err.name === 'AbortError') showError('Analysis cancelled.', 'info');
    else {
      console.error(err);
      showError(err.message || 'Something went wrong while analyzing the video.');
    }
  } finally {
    $('#analyzeBtn').disabled = false;
    $('#cancelBtn').hidden = true;
    $('#progress').hidden = true;
  }
};
$('#cancelBtn').onclick = () => state.abort?.abort();

function setProgress(p, text) {
  if (p != null) $('#progressFill').style.width = `${Math.round(p * 100)}%`;
  if (text) $('#status').textContent = text;
}

async function runDemo(kind) {
  const d = kind === 'shooting' ? demoShooting() : demoDribbling();
  const session = analyzeSession(d.frames, { mode: d.mode });
  if (session.error) return showError(session.error);
  await finishSession(session, { frames: d.frames, aspect: d.aspect, video: null, offset: 0, title: d.label, demo: true });
}
$('#demoShoot').onclick = () => runDemo('shooting');
$('#demoDribble').onclick = () => runDemo('dribbling');

// ------------------------------------------------------------------ session lifecycle

async function finishSession(session, media) {
  session.id = `s_${Date.now().toString(36)}`;
  session.title = media.title;
  session.demo = !!media.demo;
  state.current = session;
  state.media = media;
  showReportView();
  renderReport(session);
  // Capture key positions for the static report.
  session.keyframes = await captureKeyframes(session);
  state.chart?.chart.resize();
  session.timelineImg = state.chart?.image();
  renderSummaryTab(session);
  if (!media.demo) {
    const ok = saveSession(compact(session));
    if (!ok) console.warn('Could not save session history (storage full).');
  }
}

async function captureKeyframes(session) {
  if (!state.player) return session.keyframes || [];
  const was = state.player.t;
  const out = [];
  if (session.mode === 'shooting') {
    for (const r of session.reps) {
      const items = [];
      for (const e of r.events.filter((x) => x.type !== 'follow')) {
        items.push({ label: `${e.label} · ${e.t.toFixed(2)}s`, src: await state.player.snapshot(e.t, 260) });
      }
      out.push({ rep: r.label, items });
    }
  } else {
    const ev = session.reps[0].events;
    const pick = [0, Math.floor(ev.length / 2), ev.length - 1].map((i) => ev[i]).filter(Boolean);
    const items = [];
    for (const e of pick) items.push({ label: `${e.label} · ${e.t.toFixed(2)}s`, src: await state.player.snapshot(e.t, 260) });
    out.push({ rep: 'Dribble snapshots', items });
  }
  state.player.seek(was);
  return out;
}

/** Strip heavy fields before saving to history. */
function compact({ timelineImg, ...rest }) {
  return rest;
}

// ------------------------------------------------------------------ report rendering

function previousOf(session) {
  return listSessions()
    .filter((s) => s.mode === session.mode && s.id !== session.id && s.createdAt < session.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}

function renderReport(session, { keepTab = false } = {}) {
  $('#reportEmpty').hidden = true;
  $('#reportBody').hidden = false;
  $('#repMode').textContent = `${MODES[session.mode].label}${session.demo ? ' · sample data' : ''}`;
  $('#repTitle').textContent = session.title || 'Session';
  if (!keepTab) { setTab('interactive'); state.rep = 0; }

  // KPIs
  const S = session.summary;
  const prev = previousOf(session);
  const delta = prev && S.overall != null && prev.summary.overall != null ? S.overall - prev.summary.overall : null;
  $('#kpis').innerHTML = `
    <div class="kpi ring-kpi">${ring(S.overall, 92)}<div><div class="eyebrow">Overall</div><b>${esc(S.grade.label)}</b>
      ${delta != null ? `<div class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last session</div>` : ''}</div></div>
    <div class="kpi"><div class="eyebrow">Form</div><b class="big">${S.formScore ?? '—'}</b></div>
    <div class="kpi"><div class="eyebrow">Consistency</div><b class="big">${S.consistency ?? '—'}</b>${S.consistency == null ? `<span class="small muted">${session.mode === 'shooting' ? 'needs 2+ shots' : 'see rhythm metric'}</span>` : ''}</div>
    <div class="kpi"><div class="eyebrow">${session.mode === 'shooting' ? 'Shots found' : 'Dribbles'}</div><b class="big">${session.mode === 'shooting' ? session.reps.length : session.reps[0].dribbleCount}</b></div>
    <div class="kpi"><div class="eyebrow">Top focus</div><b>${esc(S.focus[0]?.issue || 'Keep it up!')}</b></div>`;

  // Player
  state.player?.destroy();
  state.player = null;
  const media = state.media && state.current === session ? state.media : null;
  if (media?.frames) {
    $('#player').hidden = false;
    $('#noPlayer').hidden = true;
    state.player = new Player($('#player'), { frames: media.frames, aspect: media.aspect, hand: session.hand, video: media.video, offset: media.offset });
  } else {
    $('#player').hidden = true;
    $('#noPlayer').hidden = false;
    $('#noPlayer').innerHTML = (session.keyframes?.length
      ? `<div class="kf-grid">${session.keyframes.flatMap((k) => k.items.map((it) => `<figure><img src="${it.src}" alt=""/><figcaption>${esc(k.rep)} · ${esc(it.label)}</figcaption></figure>`)).join('')}</div>`
      : '') + '<p>The original video is not stored. Re-upload it to replay with the skeleton overlay.</p>';
  }

  // Chart
  state.chart?.destroy();
  state.chart = timelineChart($('#timeline'), session, { onSeek: (t) => { state.player?.seek(t); state.chart.setPlayhead(t); selectRepAt(session, t); } });
  state.player?.onTime((t) => { state.chart.setPlayhead(t); });
  const evTypes = [...new Set(session.reps.flatMap((r) => r.events.map((e) => e.type)))];
  const evLabel = { load: 'Load', set: 'Set point', release: 'Release', follow: 'Follow-through end', dribble: 'Dribble' };
  $('#eventLegend').innerHTML = evTypes.map((t) => `<span class="ev ev-${t}">${evLabel[t]}</span>`).join('');

  // Rep chips
  $('#repChips').innerHTML = session.reps.length > 1
    ? session.reps.map((r, i) => `<button class="chip-btn ${i === state.rep ? 'active' : ''}" data-rep="${i}">${esc(r.label)} <span class="pill ${scoreClass(r.score)}">${r.score ?? '—'}</span></button>`).join('')
    : '';
  $$('#repChips [data-rep]').forEach((b) => { b.onclick = () => selectRep(session, Number(b.dataset.rep), true); });
  selectRep(session, Math.min(state.rep, session.reps.length - 1), false);

  renderSummaryTab(session);
}

function selectRepAt(session, t) {
  const i = session.reps.findIndex((r) => t >= r.t0 && t <= r.t1);
  if (i >= 0 && i !== state.rep) selectRep(session, i, false);
}

function selectRep(session, i, seek) {
  state.rep = i;
  const rep = session.reps[i];
  $$('#repChips [data-rep]').forEach((b) => b.classList.toggle('active', Number(b.dataset.rep) === i));
  const defs = MODES[session.mode].metrics;
  $('#metricCards').innerHTML = Object.entries(rep.metrics).map(([key, m]) => {
    const def = defs[key];
    const evType = rep.metricEvent[key];
    const ev = rep.events.find((e) => e.type === evType);
    const dir = def.ideal && m.score < 100 ? (m.value < def.ideal[0] ? def.low : def.high) : null;
    return `<div class="mcard">
      <div class="mrow-head"><span class="mrow-label">${esc(def.label)}</span><span class="pill ${scoreClass(m.score)}">${m.score ?? 'info'}</span></div>
      <div class="mrow-vals"><b>${esc(formatMetric(def, m.value))}</b><span class="muted small">ideal ${esc(formatIdeal(def))}</span></div>
      ${rangeBar(def, m.value)}
      ${dir ? `<p class="small mtip">${esc(dir.issue)}: ${esc(dir.tip)}</p>` : ''}
      ${ev && state.player ? `<button class="link small" data-seek="${ev.t}">▶ View ${esc(ev.label.toLowerCase())} (${ev.t.toFixed(2)}s)</button>` : ''}
    </div>`;
  }).join('') || '<p class="muted">No measurable metrics for this view.</p>';
  $$('#metricCards [data-seek]').forEach((b) => {
    b.onclick = () => { const t = Number(b.dataset.seek); state.player?.pause(); state.player?.seek(t); state.chart.setPlayhead(t); };
  });
  state.chart.setFocus(i);
  if (seek && state.player) {
    const t = rep.events[0]?.t ?? rep.t0;
    state.player.seek(Math.max(rep.t0, t - 0.3));
  }
}

function renderSummaryTab(session) {
  $('#tab-summary').innerHTML = summaryHtml(session, { keyframes: session.keyframes, timelineImg: session.timelineImg, title: session.title });
}

function setTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('#tab-interactive').hidden = name !== 'interactive';
  $('#tab-summary').hidden = name !== 'summary';
  if (name === 'interactive') state.chart?.chart.resize();
}
$$('.tab').forEach((t) => { t.onclick = () => setTab(t.dataset.tab); });

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const stamp = (s) => s.createdAt.slice(0, 16).replace(/[:T]/g, '-');
$('#dlHtml').onclick = () => {
  const s = state.current;
  if (s) download(`hooplab-${s.mode}-${stamp(s)}.html`, standaloneHtml(s, { keyframes: s.keyframes, timelineImg: s.timelineImg, title: s.title }), 'text/html');
};
$('#dlJson').onclick = () => {
  const s = state.current;
  if (!s) return;
  const { keyframes, timelineImg, ...data } = s;
  download(`hooplab-${s.mode}-${stamp(s)}.json`, JSON.stringify(data, null, 2), 'application/json');
};
$('#printBtn').onclick = () => { setTab('summary'); setTimeout(() => window.print(), 50); };

// ------------------------------------------------------------------ progress

function renderProgress() {
  const sessions = listSessions();
  state.progress?.destroy();
  state.progress = null;
  $('#progressEmpty').hidden = sessions.length > 0;
  if (sessions.length) state.progress = progressChart($('#progressChart'), sessions);
  $('#sessionList').innerHTML = sessions.length
    ? sessions.map((s) => `<div class="session">
        ${ring(s.summary.overall, 48)}
        <div class="session-main">
          <b>${esc(s.title || 'Session')}</b>
          <span class="small muted">${esc(MODES[s.mode].label)} · ${new Date(s.createdAt).toLocaleString()} · ${s.reps.length} ${s.mode === 'shooting' ? 'shots' : 'set'}</span>
          ${s.summary.focus[0] ? `<span class="small">Focus: ${esc(s.summary.focus[0].issue)}</span>` : ''}
        </div>
        <div class="session-actions">
          <button class="btn small" data-open="${s.id}">Open</button>
          <button class="btn ghost small" data-del="${s.id}" aria-label="Delete session">✕</button>
        </div>
      </div>`).join('')
    : '<p class="muted">No saved sessions yet. Every video you analyze is saved here (in this browser only).</p>';
  $$('[data-open]').forEach((b) => {
    b.onclick = () => {
      const s = getSession(b.dataset.open);
      if (!s) return;
      state.current = s;
      state.media = null;
      showReportView();
      renderReport(s);
    };
  });
  $$('[data-del]').forEach((b) => {
    b.onclick = () => { if (confirm('Delete this session?')) { deleteSession(b.dataset.del); renderProgress(); } };
  });
}
$('#clearHistory').onclick = () => { if (confirm('Delete all saved sessions?')) { clearSessions(); renderProgress(); } };

route();
