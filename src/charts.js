import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler,
} from 'chart.js';

import { getUnits, formatLen } from './metrics.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SERIES_COLORS = ['--c1', '--c2', '--c3'];
const EVENT_COLORS = {
  load: '--c2', set: '--c3', release: '--accent', follow: '--muted', dribble: '--c1',
  bottom: '--c2', takeoff: '--accent', peak: '--c3', landing: '--c1', absorb: '--muted',
};

/** Draws rep shading, event lines and the playhead on top of a line chart. */
const markers = {
  id: 'markers',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: a, scales: { x } } = chart;
    if (!a) return;
    ctx.save();
    for (const r of opts.reps || []) {
      const x0 = x.getPixelForValue(r.t0), x1 = x.getPixelForValue(r.t1);
      ctx.fillStyle = r.active ? 'rgba(255,122,26,.10)' : 'rgba(127,127,127,.06)';
      ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
      ctx.fillStyle = css('--muted');
      ctx.font = '11px system-ui, sans-serif';
      if (opts.reps.length > 1) ctx.fillText(r.label, x0 + 4, a.top + 12);
    }
    for (const e of opts.events || []) {
      const px = x.getPixelForValue(e.t);
      ctx.strokeStyle = css(EVENT_COLORS[e.type] || '--muted');
      ctx.globalAlpha = e.type === 'dribble' ? 0.35 : 0.9;
      ctx.setLineDash(e.type === 'follow' || e.type === 'absorb' ? [3, 3] : []);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    if (opts.playhead != null) {
      const px = x.getPixelForValue(opts.playhead);
      ctx.strokeStyle = css('--text');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
    }
    ctx.restore();
  },
};

export function timelineChart(canvas, session, { onSeek } = {}) {
  const { series, chartSeries } = session;
  const datasets = chartSeries.map((cs, i) => ({
    label: cs.label,
    data: series.t.map((t, k) => ({ x: t, y: series[cs.key][k] })),
    yAxisID: cs.axis,
    borderColor: css(SERIES_COLORS[i % 3]),
    backgroundColor: css(SERIES_COLORS[i % 3]),
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.25,
    spanGaps: true,
    hidden: !!cs.hidden,
    unit: cs.unit,
  }));
  const hasDeg = chartSeries.some((c) => c.axis === 'deg');
  const grid = css('--border');
  const tick = css('--muted');
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'linear', min: 0, max: series.t[series.t.length - 1], grid: { color: grid }, ticks: { color: tick, callback: (v) => `${v}s` } },
        ...(hasDeg ? { deg: { position: 'left', min: 40, max: 190, grid: { color: grid }, ticks: { color: tick, callback: (v) => `${v}°` } } } : {}),
        rel: { position: hasDeg ? 'right' : 'left', grid: { drawOnChartArea: !hasDeg, color: grid }, ticks: { color: tick } },
      },
      plugins: {
        legend: { labels: { color: css('--text'), boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].parsed.x.toFixed(2)} s`,
            label: (it) => `${it.dataset.label}: ${it.parsed.y == null ? '—' : it.parsed.y.toFixed(it.dataset.unit === '°' ? 0 : 2)}${it.dataset.unit}`,
          },
        },
        markers: { reps: [], events: [], playhead: null },
      },
      onClick: (evt, _els, ch) => {
        const t = ch.scales.x.getValueForPixel(evt.x);
        if (t != null) onSeek?.(Math.max(0, t));
      },
    },
    plugins: [markers],
  });
  return {
    chart,
    setPlayhead(t) { chart.options.plugins.markers.playhead = t; chart.draw(); },
    setFocus(repIdx) {
      chart.options.plugins.markers.reps = session.reps.map((r, i) => ({ ...r, active: i === repIdx }));
      chart.options.plugins.markers.events = session.reps.flatMap((r, i) => (i === repIdx || session.reps.length === 1 ? r.events : r.events.filter((e) => e.type === 'release' || e.type === 'takeoff')));
      chart.update('none');
    },
    image() {
      if (!chart.width || !chart.height) return null;
      return chart.toBase64Image('image/png', 1);
    },
    destroy() { chart.destroy(); },
  };
}

export function progressChart(canvas, sessions) {
  const sorted = sessions.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byMode = { shooting: [], dribbling: [], jump: [] };
  const heights = [];
  const k = getUnits() === 'in' ? 1 / 2.54 : 1;
  sorted.forEach((s) => {
    const x = new Date(s.createdAt).getTime();
    byMode[s.mode]?.push({ x, y: s.summary.overall });
    const best = s.summary.performance?.best;
    if (s.mode === 'jump' && best != null) heights.push({ x, y: +(best * k).toFixed(1) });
  });
  const grid = css('--border');
  const tick = css('--muted');
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Shooting', data: byMode.shooting, borderColor: css('--accent'), backgroundColor: css('--accent'), tension: 0.2, pointRadius: 4 },
        { label: 'Dribbling', data: byMode.dribbling, borderColor: css('--c1'), backgroundColor: css('--c1'), tension: 0.2, pointRadius: 4 },
        { label: 'Jump technique', data: byMode.jump, borderColor: css('--c2'), backgroundColor: css('--c2'), tension: 0.2, pointRadius: 4, borderDash: [5, 4] },
        { label: `Best jump (${getUnits()})`, data: heights, yAxisID: 'h', borderColor: css('--c3'), backgroundColor: css('--c3'), tension: 0.2, pointRadius: 5, borderWidth: 3 },
      ].filter((d) => d.data.length),
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: { type: 'linear', grid: { color: grid }, ticks: { color: tick, maxTicksLimit: 6, callback: (v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) } },
        y: { min: 0, max: 100, title: { display: true, text: 'Score', color: tick }, grid: { color: grid }, ticks: { color: tick } },
        ...(heights.length ? { h: { position: 'right', beginAtZero: false, title: { display: true, text: `Jump (${getUnits()})`, color: tick }, grid: { drawOnChartArea: false }, ticks: { color: tick } } } : {}),
      },
      plugins: {
        legend: { labels: { color: css('--text'), usePointStyle: true } },
        tooltip: {
          callbacks: {
            title: (it) => new Date(it[0].parsed.x).toLocaleString(),
            label: (it) => (it.dataset.yAxisID === 'h' ? `Best jump: ${formatLen(it.parsed.y / k)}` : `${it.dataset.label}: ${it.parsed.y}`),
          },
        },
      },
    },
  });
}
