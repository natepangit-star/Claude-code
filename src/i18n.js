// Tiny i18n: strings are keyed by their English text, so the analysis engine
// and saved sessions stay in English and are translated when displayed.
import ZH from './zh.js';

const DICTS = { zh: ZH };
export const LANGS = { en: 'English', zh: '中文' };

// Strings that carry numbers.
const PATTERNS = {
  zh: [
    [/^Shot (\d+)$/, '第 $1 投'],
    [/^Jump (\d+)$/, '第 $1 跳'],
    [/^Dribble (\d+)$/, '第 $1 次运球'],
    [/^Day (\d+)$/, '第 $1 天'],
    [/^The player was only detected in (\d+)% of frames, so some numbers may be less accurate\.$/, '只有 $1% 的画面检测到运动员，部分数据可能不够准确。'],
    [/^Could not read the video at ([\d.]+)s$/, '无法读取视频 $1 秒处的画面'],
  ],
};

let LANG = 'en';

export function setLang(lang) {
  LANG = DICTS[lang] || lang === 'en' ? lang : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
}
export const getLang = () => LANG;
/** BCP 47 locale for dates and numbers. */
export const locale = () => (LANG === 'zh' ? 'zh-CN' : 'en');

/** Translate English text (optionally a template with {placeholders}). */
export function t(text, params) {
  if (text == null) return '';
  let out = String(text);
  const dict = DICTS[LANG];
  if (dict) {
    if (Object.prototype.hasOwnProperty.call(dict, out)) out = dict[out];
    else {
      for (const [re, rep] of PATTERNS[LANG] || []) {
        if (re.test(out)) { out = out.replace(re, rep); break; }
      }
    }
  }
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return out;
}

/** True when a translation exists (used by tests). */
export function hasTranslation(lang, text) {
  const dict = DICTS[lang];
  if (!dict) return true;
  if (Object.prototype.hasOwnProperty.call(dict, text)) return true;
  return (PATTERNS[lang] || []).some(([re]) => re.test(text));
}
