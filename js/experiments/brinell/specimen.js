// Stage 3 — choose a material and sample number; shows the sample test matrix.
SAM.brinell.views.specimen = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, mats = B.data.materials;
  const MAX_SAMPLES = 10;
  let sel = rec.current ? { ...rec.current } : { material: 'brass', sample: 1 };

  function status(mat, s) {
    const runs = rec.runs.filter(r => r.material === mat && r.sample === s);
    if (runs.some(r => r.valid)) return 'valid';
    if (runs.length) return 'invalid';
    return '';
  }

  function render() {
    el.innerHTML = `
      <div class="card">
        <h2>Select the test specimen</h2>
        <p class="muted">Each specimen is a disc Ø ${B.data.specimen.diameter} mm × ${B.data.specimen.thickness} mm (surface: ${U.esc(B.data.specimen.finish)}). Test at least 5 samples of each material to study repeatability (up to ${MAX_SAMPLES}).</p>
        <div class="mat-grid">
          ${Object.values(mats).map(m => `
            <div class="mat-card ${sel.material === m.id ? 'sel' : ''}" data-mat="${m.id}" role="button" tabindex="0">
              <span class="swatch" style="background:${m.color}"></span>
              <span class="mat-name">${U.esc(m.name)}</span>
              <span class="mat-grade">${U.esc(m.grade)}</span>
              <table class="kv compact">
                <tr><th>Composition</th><td>${U.esc(m.composition)}</td></tr>
                <tr><th>Density</th><td>${m.density} g/cm³</td></tr>
                <tr><th>Young's modulus</th><td>${m.E} GPa</td></tr>
                <tr><th>Yield strength</th><td>${m.ys} MPa</td></tr>
                <tr><th>Tensile strength</th><td>${m.uts} MPa</td></tr>
                <tr><th>Typical hardness</th><td>${m.hbRange} HBW</td></tr>
              </table>
              <span class="mat-note">${U.esc(m.notes)}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Sample matrix</h3>
          <span class="legend"><span class="cell valid">✓</span> valid <span class="cell invalid">✗</span> invalid only <span class="cell"></span> not tested</span>
        </div>
        <div class="table-scroll">
        <table class="matrix">
          <thead><tr><th>Material</th>${Array.from({ length: MAX_SAMPLES }, (_, i) => `<th>S${i + 1}</th>`).join('')}</tr></thead>
          <tbody>
            ${Object.values(mats).map(m => `<tr><th>${U.esc(m.name)}</th>${Array.from({ length: MAX_SAMPLES }, (_, i) => {
              const st = status(m.id, i + 1);
              const isSel = sel.material === m.id && sel.sample === i + 1;
              return `<td><button class="cell ${st} ${isSel ? 'sel' : ''}" data-mat="${m.id}" data-s="${i + 1}" title="${U.esc(m.name)} sample ${i + 1}">${st === 'valid' ? '✓' : st === 'invalid' ? '✗' : i + 1}</button></td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
        </div>
        <div class="actions">
          <div class="selected-sum">Selected: <strong>${U.esc(mats[sel.material].name)} — Sample ${sel.sample}</strong>
            ${status(sel.material, sel.sample) ? '<span class="pill warn">already tested — this will be a retest</span>' : ''}</div>
          <button class="btn primary" id="go">Take specimen to the machine →</button>
        </div>
      </div>`;
  }

  el.addEventListener('click', e => {
    const b = e.target.closest('[data-mat]');
    if (b) {
      sel.material = b.dataset.mat;
      if (b.dataset.s) sel.sample = +b.dataset.s;
      else {
        // Jump to the first untested sample of that material.
        const next = Array.from({ length: MAX_SAMPLES }, (_, i) => i + 1).find(s => !status(sel.material, s));
        sel.sample = next || 1;
      }
      render();
      return;
    }
    if (e.target.id === 'go') {
      if (rec.pending) { U.toast('You have an indentation waiting to be measured — open the microscope first.', 'warn'); SAM.router.go('exp/brinell/microscope'); return; }
      SAM.store.update('brinell', r => { r.current = { ...sel }; });
      SAM.router.go('exp/brinell/test');
    }
  });
  render();
};
