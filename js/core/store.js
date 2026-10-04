// Persistent student records (browser localStorage). One record per roll number,
// each holding per-experiment progress, observations, assessment and report status.
SAM.store = (function () {
  const KEY = 'samlabs.v1';
  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return { students: {}, current: null };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { SAM.util.toast('Could not save progress in this browser (storage blocked).', 'err'); }
  }

  function currentId() { return db.current; }
  function student() { return db.current ? db.students[db.current] : null; }

  function login(profile) {
    const id = profile.roll.trim().toUpperCase();
    const existing = db.students[id];
    db.students[id] = existing ? { ...existing, profile } : { profile, experiments: {}, createdAt: Date.now() };
    db.current = id;
    save();
  }

  function logout() { db.current = null; save(); }

  function exp(expId) {
    const s = student();
    if (!s) return null;
    if (!s.experiments[expId]) {
      s.experiments[expId] = {
        startedAt: Date.now(),
        explored: [],
        specsViewed: false,
        current: null,
        pending: null,
        runs: [],
        assessment: null,
        report: null,
        log: [],
      };
      save();
    }
    return s.experiments[expId];
  }

  function resetExp(expId) {
    const s = student();
    if (s) { delete s.experiments[expId]; save(); }
  }

  // Mutate through this so every change is persisted.
  function update(expId, fn) {
    const rec = exp(expId);
    fn(rec);
    rec.updatedAt = Date.now();
    save();
    return rec;
  }

  return { currentId, student, login, logout, exp, update, resetExp, save };
})();
