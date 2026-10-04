// Stage 2 — machine specifications, standards and test-parameter tables.
SAM.brinell.views.specs = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, d = B.data;
  const forceRows = [30, 15, 10, 5, 2.5].map(r => [r, ...[10, 5, 2.5].map(D => r * D * D)]);

  el.innerHTML = `
    <div class="page-grid">
      <div class="card span2">
        <h2>${U.esc(d.machine.model)}</h2>
        <p class="muted">${U.esc(d.machine.type)}</p>
        <table class="kv wide">${d.machine.specs.map(([k, v]) => `<tr><th>${U.esc(k)}</th><td>${U.esc(v)}</td></tr>`).join('')}</table>
      </div>
      <div class="card">
        <h3>Recommended force–diameter ratio F/D²</h3>
        <p class="muted small">F in kgf, D in mm (equivalent to 0.102·F/D² with F in N). ISO 6506-1, Table 3.</p>
        <table class="grid-table">
          <thead><tr><th>Material</th><th>F/D²</th></tr></thead>
          <tbody>${d.ratioTable.map(([m, r]) => `<tr><td>${U.esc(m)}</td><td class="num">${r}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>Test force (kgf) for each ball diameter</h3>
        <table class="grid-table">
          <thead><tr><th>F/D²</th><th>D = 10 mm</th><th>D = 5 mm</th><th>D = 2.5 mm</th></tr></thead>
          <tbody>${forceRows.map(r => `<tr>${r.map((v, i) => `<td class="num">${i ? +v.toFixed(3) : v}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>Validity requirements</h3>
        <table class="grid-table">
          <tbody>${d.validityRules.map(([k, v]) => `<tr><td>${U.esc(k)}</td><td>${U.esc(v)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>Specimen dimensions</h3>
        <table class="kv">
          <tr><th>Shape</th><td>Disc Ø ${d.specimen.diameter} mm × ${d.specimen.thickness} mm thick</td></tr>
          <tr><th>Surface</th><td>${U.esc(d.specimen.finish)}</td></tr>
          <tr><th>Min. thickness</th><td>8 × indentation depth h</td></tr>
          <tr><th>Max. height on machine</th><td>250 mm</td></tr>
        </table>
        <h3 style="margin-top:18px">Brinell hardness equation</h3>
        <div class="formula">HBW = 0.102 × 2F / [ πD ( D − √(D² − d²) ) ]  <span class="muted">(F in N)</span></div>
        <div class="formula">HB = 2F / [ πD ( D − √(D² − d²) ) ]  <span class="muted">(F in kgf)</span></div>
      </div>
      <div class="card span2">
        <h3>Theory</h3>
        ${d.theory.map(p => `<p>${U.esc(p)}</p>`).join('')}
        <div class="actions">
          <button class="btn primary" id="ack">I have reviewed the specifications — select specimen →</button>
        </div>
      </div>
    </div>`;

  el.querySelector('#ack').onclick = () => {
    SAM.store.update('brinell', r => { r.specsViewed = true; });
    SAM.router.go('exp/brinell/specimen');
  };
};
