// Minimal hash router. A route handler renders into the root element and may
// return a cleanup function (dispose WebGL, timers, charts) called on navigation.
SAM.router = (function () {
  const routes = [];
  let cleanup = null;

  function on(pattern, handler) { routes.push({ pattern, handler }); }

  function go(path) {
    const target = '#/' + path;
    if (location.hash === target) resolve();
    else location.hash = target;
  }

  function current() { return location.hash.replace(/^#\/?/, ''); }

  function resolve() {
    const path = current();
    if (cleanup) {
      try { cleanup(); } catch (e) { console.error(e); }
      cleanup = null;
    }
    const root = document.getElementById('app');
    root.innerHTML = '';
    for (const r of routes) {
      const m = path.match(r.pattern);
      if (m) {
        const c = r.handler(root, ...m.slice(1));
        if (typeof c === 'function') cleanup = c;
        window.scrollTo(0, 0);
        if (SAM.app) SAM.app.updateChrome(path);
        return;
      }
    }
    go('dashboard');
  }

  window.addEventListener('hashchange', resolve);
  return { on, go, resolve, current };
})();
