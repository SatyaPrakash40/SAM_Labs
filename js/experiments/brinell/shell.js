// Experiment shell: breadcrumb, workflow stepper, stage gating and routing.
SAM.brinell.views = SAM.brinell.views || {};

SAM.brinell.stages = [
  { id: 'explore', label: 'Explore Machine', verb: 'Explore' },
  { id: 'specs', label: 'Specifications', verb: 'Understand' },
  { id: 'specimen', label: 'Select Specimen', verb: 'Prepare' },
  { id: 'test', label: 'Perform Test', verb: 'Operate' },
  { id: 'microscope', label: 'Microscope', verb: 'Measure' },
  { id: 'analysis', label: 'Results & Plots', verb: 'Analyse' },
  { id: 'report', label: 'Lab Report', verb: 'Report' },
  { id: 'assess', label: 'Assessment', verb: 'Assess' },
];

SAM.brinell.validRuns = function (rec) {
  // Latest valid run per material/sample counts toward results.
  const best = {};
  for (const r of rec.runs) {
    if (!r.valid) continue;
    const k = r.material + '#' + r.sample;
    if (!best[k] || r.measuredAt > best[k].measuredAt) best[k] = r;
  }
  return Object.values(best).sort((a, b) => a.material.localeCompare(b.material) || a.sample - b.sample);
};

// Returns null if the stage is open, otherwise the reason it is locked.
SAM.brinell.lockReason = function (stage, rec) {
  const nComp = SAM.brinell.data.components.length;
  const valid = SAM.brinell.validRuns(rec).length;
  switch (stage) {
    case 'explore': return null;
    case 'specs': return rec.explored.length >= nComp ? null : `Explore all ${nComp} machine components first (${rec.explored.length}/${nComp}).`;
    case 'specimen': return rec.specsViewed ? null : 'Review the machine specifications first.';
    case 'test':
      if (!rec.specsViewed) return 'Review the machine specifications first.';
      return rec.current ? null : 'Select a material and sample first.';
    case 'microscope': return rec.pending ? null : 'Perform an indentation on the machine first.';
    case 'analysis':
    case 'report':
    case 'assess':
      return valid ? null : 'Complete at least one valid test first.';
  }
  return null;
};

SAM.brinell.mount = function (root, stage) {
  const B = SAM.brinell, U = SAM.util;
  if (!SAM.store.student()) { SAM.router.go('dashboard'); return; }
  const rec = SAM.store.exp('brinell');
  stage = stage || 'explore';
  if (!B.stages.some(s => s.id === stage)) stage = 'explore';
  const lock = B.lockReason(stage, rec);
  if (lock) {
    // Send the student to the furthest open stage.
    const open = B.stages.filter(s => !B.lockReason(s.id, rec));
    U.toast(lock, 'warn');
    SAM.router.go('exp/brinell/' + open[open.length - 1].id);
    return;
  }

  root.innerHTML = `
    <div class="exp-head">
      <div class="crumbs">${B.data.breadcrumb.map((c, i) => i < 2 ? `<a href="#/labs">${U.esc(c)}</a>` : `<span>${U.esc(c)}</span>`).join('<span class="sep">›</span>')}</div>
      <nav class="stepper">
        ${B.stages.map((s, i) => {
          const locked = B.lockReason(s.id, rec);
          const cls = s.id === stage ? 'active' : locked ? 'locked' : 'open';
          return `<a class="step ${cls}" ${locked ? `title="${U.esc(locked)}"` : `href="#/exp/brinell/${s.id}"`}>
            <span class="num">${i + 1}</span><span class="txt"><small>${s.verb}</small>${s.label}</span></a>`;
        }).join('')}
      </nav>
    </div>
    <div class="exp-body" id="exp-body"></div>`;
  return B.views[stage](root.querySelector('#exp-body'), rec);
};
