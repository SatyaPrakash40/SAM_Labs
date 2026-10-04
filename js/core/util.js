// Shared helpers: seeded random numbers, statistics, formatting, toasts.
window.SAM = window.SAM || {};

SAM.util = (function () {
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Mulberry32 PRNG — deterministic for a given seed string/number.
  function rng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Standard normal sample (Box–Muller).
  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }

  // Sample standard deviation (n − 1).
  function sd(a) {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function fmt(x, dp = 2) { return Number.isFinite(x) ? x.toFixed(dp) : '—'; }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg, type = 'info', ms = 3200) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
  }

  return { hashStr, rng, gauss, mean, sd, clamp, fmt, esc, uid, fmtDate, toast };
})();
