// Stage 1 — explore the 3D machine and learn every component.
SAM.brinell.views.explore = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, comps = B.data.components;

  el.innerHTML = `
    <div class="exp-layout">
      <section class="viewer-card">
        <div class="viewer" id="viewer"></div>
        <div class="viewer-tools">
          <button class="btn sm" id="reset-view">Reset view</button>
          <label class="check"><input type="checkbox" id="isolate"> Isolate selected</label>
          <span class="hint">Drag to rotate · scroll to zoom · right-drag to pan · click a part</span>
        </div>
        <div class="hover-tip" id="tip"></div>
      </section>
      <aside class="side">
        <div class="card">
          <div class="card-head">
            <h3>Machine components</h3>
            <span class="pill" id="progress"></span>
          </div>
          <div class="progress"><div id="bar"></div></div>
          <ul class="comp-list" id="comp-list"></ul>
        </div>
        <div class="card info" id="info">
          <p class="muted">Select a component in the list or click it on the machine to study its function, specifications, working principle and safety precautions.</p>
        </div>
        <div class="card next-card" id="next"></div>
      </aside>
    </div>`;

  const machine = new B.Machine3D(el.querySelector('#viewer'), {
    onPick: id => { if (comps.some(c => c.id === id)) select(id); },
    onHover: (id, e) => {
      const tip = el.querySelector('#tip');
      const c = comps.find(x => x.id === id);
      if (!c || !e) { tip.style.display = 'none'; return; }
      const r = el.querySelector('.viewer-card').getBoundingClientRect();
      tip.textContent = c.name;
      tip.style.display = 'block';
      tip.style.left = (e.clientX - r.left + 14) + 'px';
      tip.style.top = (e.clientY - r.top + 10) + 'px';
    },
  });
  // Show a representative machine setup.
  Object.assign(machine.state, { indenterD: 10, selectedLoad: 3000, specimen: null });

  let selected = null;

  function renderList() {
    el.querySelector('#comp-list').innerHTML = comps.map(c => `
      <li class="${c.id === selected ? 'sel' : ''}" data-id="${c.id}">
        <span class="tick ${rec.explored.includes(c.id) ? 'done' : ''}">${rec.explored.includes(c.id) ? '✓' : ''}</span>
        <span>${U.esc(c.name)}</span>
      </li>`).join('');
    const n = rec.explored.length;
    el.querySelector('#progress').textContent = `${n}/${comps.length} explored`;
    el.querySelector('#bar').style.width = (100 * n / comps.length) + '%';
    const done = n >= comps.length;
    el.querySelector('#next').innerHTML = done
      ? `<p><strong>All components explored.</strong> Continue to the machine specifications.</p><a class="btn primary block" href="#/exp/brinell/specs">Continue to specifications →</a>`
      : `<p class="muted">Open every component to unlock the next stage.</p>`;
  }

  function select(id) {
    selected = id;
    const c = comps.find(x => x.id === id);
    if (!rec.explored.includes(id)) {
      SAM.store.update('brinell', r => r.explored.push(id));
      if (rec.explored.length === comps.length) U.toast('All components explored — specifications unlocked.', 'ok');
    }
    machine.setHighlight(id);
    machine.focus(id);
    el.querySelector('#info').innerHTML = `
      <h3>${U.esc(c.name)}</h3>
      <p class="lead">${U.esc(c.short)}</p>
      <h4>Function</h4><p>${U.esc(c.func)}</p>
      <h4>Technical specifications</h4>
      <table class="kv">${c.specs.map(([k, v]) => `<tr><th>${U.esc(k)}</th><td>${U.esc(v)}</td></tr>`).join('')}</table>
      <h4>Working principle</h4><p>${U.esc(c.principle)}</p>
      <h4>Relevant parameters</h4><ul>${c.params.map(p => `<li>${U.esc(p)}</li>`).join('')}</ul>
      ${c.safety.length ? `<h4>Safety precautions</h4><ul class="safety">${c.safety.map(p => `<li>${U.esc(p)}</li>`).join('')}</ul>` : ''}`;
    renderList();
  }

  el.querySelector('#comp-list').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) select(li.dataset.id);
  });
  el.querySelector('#reset-view').onclick = () => machine.resetView();
  el.querySelector('#isolate').onchange = e => machine.setIsolate(e.target.checked);
  renderList();

  return () => machine.dispose();
};
