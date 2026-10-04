// App shell: routes, student profile, dashboard and laboratory catalogue.
SAM.app = (function () {
  const U = SAM.util, R = SAM.router, S = SAM.store;

  function updateChrome(path) {
    document.querySelectorAll('[data-nav]').forEach(a => {
      const n = a.dataset.nav;
      a.classList.toggle('active', path.startsWith(n) || (n === 'labs' && path.startsWith('exp/')));
    });
    const s = S.student();
    document.getElementById('student-chip').innerHTML = s
      ? `<span class="avatar">${U.esc(s.profile.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</span>
         <span class="who"><b>${U.esc(s.profile.name)}</b><small>${U.esc(s.profile.roll)}</small></span>
         <a href="#/profile" class="link">Profile</a><button class="link" id="logout">Switch</button>`
      : '';
    const lo = document.getElementById('logout');
    if (lo) lo.onclick = () => { S.logout(); R.go('dashboard'); };
  }

  // Status of an experiment for the dashboard.
  function expStatus(id) {
    const s = S.student();
    const rec = s && s.experiments[id];
    if (!rec) return { status: 'Not started', cls: '' };
    if (rec.report?.generatedAt && rec.assessment) return { status: 'Completed', cls: 'ok' };
    return { status: 'In progress', cls: 'warn' };
  }

  function profileView(root) {
    const p = S.student()?.profile || {};
    root.innerHTML = `
      <div class="card narrow">
        <h2>${S.student() ? 'Student profile' : 'Welcome to SAM Labs'}</h2>
        <p class="muted">${S.student() ? 'Update your details. They appear on your laboratory reports.' : 'Enter your details to start. Your experiments, observations and reports are saved on this device under your roll number.'}</p>
        <form id="pf" class="form">
          <label>Full name<input name="name" required value="${U.esc(p.name || '')}" autocomplete="name"></label>
          <label>Roll / enrolment number<input name="roll" required value="${U.esc(p.roll || '')}" ${p.roll ? 'readonly' : ''}></label>
          <div class="two">
            <label>Programme / branch<input name="branch" value="${U.esc(p.branch || 'B.Tech Mechanical Engineering')}"></label>
            <label>Semester<input name="semester" value="${U.esc(p.semester || '')}" placeholder="e.g. IV"></label>
          </div>
          <div class="two">
            <label>Batch / lab group<input name="batch" value="${U.esc(p.batch || '')}" placeholder="e.g. B2"></label>
            <label>Institution<input name="institution" value="${U.esc(p.institution || '')}"></label>
          </div>
          <button class="btn primary" type="submit">${S.student() ? 'Save profile' : 'Start laboratory'}</button>
        </form>
      </div>`;
    root.querySelector('#pf').onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      for (const k in f) f[k] = f[k].trim();
      if (!f.name || !f.roll) return;
      S.login(f);
      U.toast(`Welcome, ${f.name}.`, 'ok');
      R.go('dashboard');
    };
  }

  function dashboardView(root) {
    const s = S.student();
    if (!s) return profileView(root);
    const all = SAM.catalog[0].groups.flatMap(g => g.items);
    const br = s.experiments.brinell;
    const brValid = br ? SAM.brinell.validRuns(br) : [];
    const workflow = [
      ['Explore', br && br.explored.length >= SAM.brinell.data.components.length],
      ['Understand', br && br.specsViewed],
      ['Operate', br && br.runs.length > 0],
      ['Measure', br && br.runs.length > 0],
      ['Calculate', brValid.length > 0],
      ['Analyse', brValid.length > 1],
      ['Plot', brValid.length > 1],
      ['Report', br && !!br.report?.generatedAt],
      ['Assess', br && !!br.assessment],
    ];
    const continueStage = br ? [...SAM.brinell.stages].reverse().find(st => !SAM.brinell.lockReason(st.id, br))?.id : 'explore';

    root.innerHTML = `
      <div class="dash-head">
        <div>
          <h1>Hello, ${U.esc(s.profile.name.split(' ')[0])}</h1>
          <p class="muted">${U.esc(s.profile.branch || '')}${s.profile.semester ? ' · Semester ' + U.esc(s.profile.semester) : ''}${s.profile.batch ? ' · ' + U.esc(s.profile.batch) : ''}</p>
        </div>
        <a class="btn primary" href="#/exp/brinell/${continueStage || 'explore'}">${br ? 'Continue' : 'Start'} Brinell Hardness Test →</a>
      </div>

      <div class="card">
        <h3>Brinell Hardness Test — workflow progress</h3>
        <div class="flow">${workflow.map(([w, ok]) => `<span class="flow-step ${ok ? 'done' : ''}">${ok ? '✓ ' : ''}${w}</span>`).join('<i>→</i>')}</div>
        ${br ? `<div class="mini-stats">
          <div><b>${br.explored.length}/${SAM.brinell.data.components.length}</b><span>components explored</span></div>
          <div><b>${br.runs.length}</b><span>tests performed</span></div>
          <div><b>${brValid.length}</b><span>valid samples</span></div>
          <div><b>${new Set(brValid.map(r => r.material)).size}/3</b><span>materials</span></div>
          <div><b>${br.assessment ? br.assessment.pct + '%' : '—'}</b><span>assessment</span></div>
        </div>` : '<p class="muted">Not started yet.</p>'}
      </div>

      <div class="card">
        <div class="card-head"><h3>Student performance dashboard</h3></div>
        <div class="table-scroll">
        <table class="data-table dash">
          <thead><tr><th>Experiment</th><th>Laboratory</th><th>Status</th><th>Valid tests</th><th>Score</th><th>Report</th><th></th></tr></thead>
          <tbody>
            ${all.map(it => {
              const group = SAM.catalog[0].groups.find(g => g.items.includes(it)).name;
              if (!it.available) return `<tr class="na"><td>${U.esc(it.name)}</td><td>${U.esc(group)}</td><td><span class="pill">Pending</span></td><td>—</td><td>—</td><td>—</td><td><span class="muted small">Coming soon</span></td></tr>`;
              const st = expStatus(it.id);
              const rec = s.experiments[it.id];
              return `<tr><td><b>${U.esc(it.name)}</b></td><td>${U.esc(group)}</td><td><span class="pill ${st.cls}">${st.status}</span></td>
                <td>${rec ? SAM.brinell.validRuns(rec).length : '—'}</td>
                <td>${rec?.assessment ? rec.assessment.pct + '%' : '—'}</td>
                <td>${rec?.report?.generatedAt ? `<button class="btn sm" data-dl="${it.id}">Download</button>${rec.report.submittedAt ? ' <span class="pill ok">Submitted</span>' : ''}` : '—'}</td>
                <td><a class="btn sm" href="#/${it.route}/${it.id === 'brinell' ? continueStage || 'explore' : ''}">${rec ? 'Open' : 'Start'}</a></td></tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
      ${br ? `<p class="muted small">Data is stored in this browser for roll number ${U.esc(S.currentId())}. <button class="link danger" id="reset">Reset Brinell experiment data</button></p>` : ''}`;

    root.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => {
      try { SAM.brinell.report.download(); } catch (e) { console.error(e); U.toast('Could not build the report: ' + e.message, 'err'); }
    });
    const rs = root.querySelector('#reset');
    if (rs) rs.onclick = () => {
      if (confirm('Delete all Brinell observations, assessment and report records for this student? This cannot be undone.')) {
        S.resetExp('brinell');
        U.toast('Experiment data reset.', 'info');
        R.resolve();
      }
    };
  }

  function labsView(root) {
    root.innerHTML = SAM.catalog.map(lab => `
      <div class="lab">
        <h1>${U.esc(lab.name)}</h1>
        <p class="muted">Select an experiment. Each one follows the same workflow: Explore → Understand → Operate → Measure → Calculate → Analyse → Plot → Report → Assess.</p>
        ${lab.groups.map(g => `
          <h3 class="group-title">${U.esc(g.name)}</h3>
          <div class="exp-grid">
            ${g.items.map(it => it.available
              ? `<a class="exp-tile live" href="#/${it.route}/explore">
                   <span class="tag ok">Available</span><b>${U.esc(it.name)}</b><span>${U.esc(it.blurb || '')}</span></a>`
              : `<div class="exp-tile"><span class="tag">Coming soon</span><b>${U.esc(it.name)}</b></div>`).join('')}
          </div>`).join('')}
      </div>`).join('');
  }

  function requireStudent(view) {
    return (root, ...a) => (S.student() ? view(root, ...a) : profileView(root));
  }

  R.on(/^$/, dashboardView);
  R.on(/^dashboard$/, dashboardView);
  R.on(/^profile$/, profileView);
  R.on(/^labs$/, labsView);
  R.on(/^exp\/brinell(?:\/(\w+))?$/, requireStudent((root, stage) => SAM.brinell.mount(root, stage)));

  document.addEventListener('DOMContentLoaded', () => R.resolve());
  if (document.readyState !== 'loading') setTimeout(() => R.resolve(), 0);

  return { updateChrome };
})();
