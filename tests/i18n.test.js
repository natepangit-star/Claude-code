import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MODES } from '../src/metrics.js';
import { analyzeSession } from '../src/analysis.js';
import { demoShooting, demoDribbling, demoJump } from '../src/demo.js';
import { summaryHtml } from '../src/summary.js';
import { t, setLang, hasTranslation } from '../src/i18n.js';

const missing = (strings) => [...new Set(strings)].filter((s) => s && !hasTranslation('zh', s));

test('every metric label, tip and drill has a Chinese translation', () => {
  const all = [];
  for (const mode of Object.values(MODES)) {
    all.push(mode.label);
    for (const d of Object.values(mode.metrics)) {
      all.push(d.label, d.why);
      for (const side of [d.low, d.high]) if (side) all.push(side.issue, side.tip, side.drill);
    }
  }
  assert.deepEqual(missing(all), []);
});

test('every string the analysis produces has a Chinese translation', () => {
  const sessions = [
    analyzeSession(demoJump().frames, { mode: 'jump', jumpType: 'standing', heightCm: 185 }),
    analyzeSession(demoShooting().frames, { mode: 'shooting' }),
    analyzeSession(demoDribbling().frames, { mode: 'dribbling' }),
  ];
  const all = [];
  for (const s of sessions) {
    all.push(s.summary.grade.label, ...s.warnings);
    s.summary.plan.forEach((d) => all.push(d.day, ...d.items));
    s.summary.focus.forEach((f) => all.push(f.label, f.issue, f.tip, f.drill, f.why));
    s.chartSeries.forEach((c) => all.push(c.label));
    s.reps.forEach((r) => { all.push(r.label); r.events.forEach((e) => all.push(e.label)); });
  }
  // Errors and warnings written as literals in the engine.
  const src = readFileSync(new URL('../src/analysis.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/pose.js', import.meta.url), 'utf8');
  for (const m of src.matchAll(/(?:error: |warnings\.push\(|new Error\(\s*|onStatus\?\.\()'([^']+)'/g)) if (!m[1].endsWith(' ')) all.push(m[1]); // concatenated messages use patterns
  for (const m of src.matchAll(/\?\s*'([^']{20,})'\s*:\s*'([^']{20,})'/g)) all.push(m[1], m[2]);
  assert.deepEqual(missing(all), []);
});

test('every t() literal in the UI code and every tagged element in index.html is translated', () => {
  const dir = new URL('../src/', import.meta.url);
  const all = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'zh.js')) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) all.push(m[1].replace(/\\'/g, "'"));
    // t(cond ? 'a' : 'b') and nested ternaries
    for (const m of src.matchAll(/\bt\(([^;]*?)\)/g)) {
      for (const q of m[1].matchAll(/[?:]\s*'((?:[^'\\]|\\.)+)'/g)) all.push(q[1].replace(/\\'/g, "'"));
    }
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of html.matchAll(/<(\w+)\b[^>]*?\sdata-i18n(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) all.push(m[2].replace(/\s+/g, ' ').trim());
  for (const m of html.matchAll(/placeholder="([^"]+)"[^>]*data-i18n-ph/g)) all.push(m[1]);
  assert.ok(all.length > 100, `found ${all.length} strings`);
  assert.deepEqual(missing(all.filter((x) => /[A-Za-z]/.test(x))), []);
});

test('Chinese report renders with translated text and numbers filled in', () => {
  setLang('zh');
  try {
    assert.equal(t('Jump 2'), '第 2 跳');
    assert.equal(t('{r} to touch the rim · {d} to dunk.', { r: '8 cm', d: '23 cm' }), '距摸筐 8 cm · 距扣篮 23 cm');
    const s = analyzeSession(demoJump().frames, { mode: 'jump', jumpType: 'standing', heightCm: 185 });
    const html = summaryHtml(s);
    for (const zh of ['改进重点', '5 天训练计划', '扣篮进度', '每跳高度', '第 1 跳']) assert.ok(html.includes(zh), zh);
    assert.ok(!/Focus areas|Dunk meter|Height by jump/.test(html), 'no leftover English headings');
  } finally {
    setLang('en');
  }
});
