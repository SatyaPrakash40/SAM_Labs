// Stage 6 — observation table, statistics and interactive plots.
SAM.brinell.views.analysis = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, C = B.charts, mats = B.data.materials;
  const runs = B.validRuns(rec);
  const invalid = rec.runs.filter(r => !r.valid);
  const S = C.summary(runs);
  const charts = [];

  el.innerHTML = `
    <div class="stat-row">
      ${S.map(s => `
        <div class="stat card" style="--accent:${s.color}">
          <div class="stat-label">${U.esc(s.name)}</div>
          <div class="stat-value">${U.fmt(s.mean, 1)} <small>HBW</small></div>
          <div class="stat-sub">± ${U.fmt(s.sd, 2)} SD · CoV ${U.fmt(s.cov, 2)} % · n = ${s.n}</div>
          <div class="stat-sub">Handbook ≈ ${s.ref} HBW (${s.dev >= 0 ? '+' : ''}${U.fmt(s.dev, 1)} %)</div>
        </div>`).join('')}
      ${S.length < 3 ? `<div class="stat card dashed"><div class="stat-label">Not yet tested</div><div class="stat-sub">${Object.values(mats).filter(m => !S.some(s => s.id === m.id)).map(m => m.name).join(', ')}</div><a class="btn sm" href="#/exp/brinell/specimen">Test more specimens</a></div>` : ''}
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Experimental data</h3>
        <div class="row"><button class="btn sm" id="csv">Export CSV</button><a class="btn sm primary" href="#/exp/brinell/report">Generate laboratory report →</a></div>
      </div>
      <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>Material</th><th>Sample</th><th>D (mm)</th><th>F (kgf)</th><th>F/D²</th><th>Dwell (s)</th>
          <th>d₁ (mm)</th><th>d₂ (mm)</th><th>d (mm)</th><th>h (mm)</th><th>BHN</th><th>Designation</th>
        </tr></thead>
        <tbody>
          ${S.map(s => s.runs.map(r => `<tr>
            <td><span class="dot" style="background:${s.color}"></span>${U.esc(s.name)}</td><td>${r.sample}</td><td>${r.D}</td><td>${r.F}</td><td>${+r.ratio.toFixed(2)}</td><td>${r.dwell.toFixed(1)}</td>
            <td>${r.m1.toFixed(2)}</td><td>${r.m2.toFixed(2)}</td><td>${r.d.toFixed(3)}</td><td>${r.h.toFixed(3)}</td><td><b>${U.fmt(r.bhn, 1)}</b></td><td>${U.esc(r.designation)}</td>
          </tr>`).join('') + `<tr class="sub">
            <td colspan="8">${U.esc(s.name)} — average / SD / CoV / range</td><td>${s.dMean.toFixed(3)}</td><td></td>
            <td><b>${U.fmt(s.mean, 1)}</b></td><td>SD ${U.fmt(s.sd, 2)} · CoV ${U.fmt(s.cov, 2)} % · R ${U.fmt(s.range, 1)}</td></tr>`).join('')}
        </tbody>
      </table>
      </div>
      ${invalid.length ? `<details class="invalid"><summary>${invalid.length} invalid test${invalid.length > 1 ? 's' : ''} excluded from results</summary>
        <table class="data-table"><thead><tr><th>Material</th><th>Sample</th><th>D/F</th><th>d (mm)</th><th>BHN</th><th>Reason</th></tr></thead><tbody>
        ${invalid.map(r => `<tr><td>${U.esc(mats[r.material].name)}</td><td>${r.sample}</td><td>${r.D}/${r.F}</td><td>${r.d.toFixed(3)}</td><td>${U.fmt(r.bhn, 1)}</td>
          <td>${r.checks.filter(c => c.level === 'err').map(c => U.esc(c.label + ': ' + c.detail)).join('<br>')}</td></tr>`).join('')}
        </tbody></table></details>` : ''}
    </div>

    <div class="card">
      <h3>Statistical summary</h3>
      <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Material</th><th>Test condition (D/F)</th><th>n</th><th>Mean d (mm)</th><th>Average BHN</th><th>Std. deviation</th><th>CoV (%)</th><th>Min</th><th>Max</th><th>Range</th><th>Handbook</th><th>Deviation</th></tr></thead>
        <tbody>${S.map(s => `<tr><td>${U.esc(s.name)}</td><td>${s.conditions.join(', ')}</td><td>${s.n}</td><td>${s.dMean.toFixed(3)}</td><td><b>${U.fmt(s.mean, 1)}</b></td><td>${U.fmt(s.sd, 2)}</td><td>${U.fmt(s.cov, 2)}</td><td>${U.fmt(s.min, 1)}</td><td>${U.fmt(s.max, 1)}</td><td>${U.fmt(s.range, 1)}</td><td>${s.ref}</td><td>${s.dev >= 0 ? '+' : ''}${U.fmt(s.dev, 1)} %</td></tr>`).join('')}</tbody>
      </table>
      </div>
      <p class="muted small">SD is the sample standard deviation (n − 1). CoV = SD / mean × 100. A CoV below about 3 % indicates good repeatability for Brinell tests on wrought metals. SD needs at least two valid samples.</p>
    </div>

    <div class="chart-grid">
      ${C.KINDS.map(k => `<div class="card chart-card ${k === 'avg' ? 'wide' : ''}">
        <h3>${C.TITLES[k]}</h3>
        <div class="chart-box"><canvas data-kind="${k}"></canvas></div>
        <p class="muted small">${C.NOTES[k]}</p>
      </div>`).join('')}
    </div>`;

  el.querySelectorAll('canvas[data-kind]').forEach(c => charts.push(C.render(c, c.dataset.kind, runs)));

  el.querySelector('#csv').onclick = () => {
    const head = ['Material', 'Sample', 'D_mm', 'F_kgf', 'F_over_D2', 'Dwell_s', 'LoadTime_s', 'd1_mm', 'd2_mm', 'd_mm', 'h_mm', 'BHN', 'Designation', 'Valid'];
    const rows = rec.runs.map(r => [mats[r.material].name, r.sample, r.D, r.F, r.ratio.toFixed(2), r.dwell.toFixed(1), r.loadTime.toFixed(1), r.m1.toFixed(2), r.m2.toFixed(2), r.d.toFixed(3), r.h.toFixed(3), r.bhn.toFixed(1), r.designation, r.valid ? 'yes' : 'no']);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `brinell_observations_${SAM.store.currentId()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return () => charts.forEach(c => c.destroy());
};
