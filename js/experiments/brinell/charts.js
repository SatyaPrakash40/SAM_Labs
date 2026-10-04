// Statistics and Chart.js configurations shared by the analysis page and the PDF report.
SAM.brinell.charts = (function () {
  const U = SAM.util;
  const COLORS = { brass: '#c9971c', aluminium: '#3b82c4', steel: '#3f4a5a' };
  const mats = () => SAM.brinell.data.materials;

  function summary(runs) {
    const out = [];
    for (const m of Object.values(mats())) {
      const rs = runs.filter(r => r.material === m.id);
      if (!rs.length) continue;
      const v = rs.map(r => r.bhn);
      const mean = U.mean(v), sd = U.sd(v);
      out.push({
        id: m.id, name: m.name, color: COLORS[m.id], n: rs.length, runs: rs,
        mean, sd, cov: Number.isFinite(sd) ? (sd / mean) * 100 : NaN,
        min: Math.min(...v), max: Math.max(...v), range: Math.max(...v) - Math.min(...v),
        dMean: U.mean(rs.map(r => r.d)), ref: m.hbRef, dev: ((mean - m.hbRef) / m.hbRef) * 100,
        conditions: [...new Set(rs.map(r => `${r.D}/${r.F}`))],
      });
    }
    return out;
  }

  const errorBars = {
    id: 'errorBars',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      chart.data.datasets.forEach((ds, i) => {
        if (!ds.errorBars) return;
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach((bar, j) => {
          const e = ds.errorBars[j];
          if (!Number.isFinite(e)) return;
          const y = chart.scales.y;
          const top = y.getPixelForValue(ds.data[j] + e), bot = y.getPixelForValue(ds.data[j] - e);
          ctx.save();
          ctx.strokeStyle = '#1b2430';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bar.x, top); ctx.lineTo(bar.x, bot);
          ctx.moveTo(bar.x - 8, top); ctx.lineTo(bar.x + 8, top);
          ctx.moveTo(bar.x - 8, bot); ctx.lineTo(bar.x + 8, bot);
          ctx.stroke();
          ctx.restore();
        });
      });
    },
  };

  const whiteBg = {
    id: 'whiteBg',
    beforeDraw(chart) {
      const c = chart.ctx;
      c.save(); c.fillStyle = '#fff'; c.fillRect(0, 0, chart.width, chart.height); c.restore();
    },
  };

  const TITLES = {
    avg: 'Material vs average Brinell hardness (± 1 SD)',
    samples: 'Sample number vs Brinell hardness',
    dVsHB: 'Indentation diameter vs Brinell hardness',
    loadVsD: 'Test load vs indentation diameter',
    range: 'Hardness comparison: range and mean by material',
  };

  const NOTES = {
    avg: 'Bars show the mean HBW of each material; error bars are ± one sample standard deviation; diamonds mark typical handbook values.',
    samples: 'Scatter between samples shows experimental variation (material inhomogeneity plus measurement error). Dashed lines are material means.',
    dVsHB: 'For a fixed load and ball, hardness falls steeply as the indentation gets larger. Dashed curves are HB(d) for each test condition used.',
    loadVsD: 'Indentation diameter grows with load; a softer material gives a larger indentation at the same load. Curves use each material\'s mean hardness (D = 10 mm).',
    range: 'Floating bars span the minimum to maximum HBW measured; the marker is the mean.',
  };

  function base(title, xTitle, yTitle) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        title: { display: !!title, text: title, font: { size: 14, weight: '600' }, color: '#1b2430' },
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
      },
      scales: {
        x: { title: { display: true, text: xTitle }, grid: { color: '#eef1f5' } },
        y: { title: { display: true, text: yTitle }, grid: { color: '#eef1f5' } },
      },
    };
  }

  function config(kind, runs, { showTitle = false } = {}) {
    const S = summary(runs);
    const title = showTitle ? TITLES[kind] : '';
    const P = SAM.brinell.physics;

    if (kind === 'avg') {
      const opts = base(title, 'Material', 'Average hardness (HBW)');
      opts.scales.y.beginAtZero = true;
      opts.plugins.tooltip = { callbacks: { label: c => c.datasetIndex === 0 ? `Mean ${U.fmt(c.raw, 1)} ± ${U.fmt(S[c.dataIndex].sd, 1)} HBW (n = ${S[c.dataIndex].n})` : `Handbook ${c.raw} HBW` } };
      return {
        type: 'bar',
        data: {
          labels: S.map(s => s.name),
          datasets: [
            { label: 'Measured mean', data: S.map(s => s.mean), backgroundColor: S.map(s => s.color + 'cc'), borderColor: S.map(s => s.color), borderWidth: 1.5, errorBars: S.map(s => s.sd), maxBarThickness: 90 },
            { type: 'line', label: 'Handbook value', data: S.map(s => s.ref), showLine: false, pointStyle: 'rectRot', pointRadius: 7, pointBackgroundColor: '#d0563b', borderColor: '#d0563b' },
          ],
        },
        options: opts,
        plugins: [errorBars],
      };
    }

    if (kind === 'samples') {
      const opts = base(title, 'Sample number', 'Brinell hardness (HBW)');
      opts.scales.x.type = 'linear';
      opts.scales.x.ticks = { stepSize: 1 };
      opts.scales.x.min = 0.5;
      opts.scales.x.max = Math.max(5, ...runs.map(r => r.sample)) + 0.5;
      opts.plugins.tooltip = { callbacks: { label: c => `${c.dataset.label}: S${c.raw.x} → ${U.fmt(c.raw.y, 1)} HBW` } };
      const ds = [];
      for (const s of S) {
        ds.push({ type: 'scatter', label: s.name, data: s.runs.map(r => ({ x: r.sample, y: r.bhn })), showLine: true, borderColor: s.color, backgroundColor: s.color, pointRadius: 5, tension: 0 });
        ds.push({ type: 'line', label: `${s.name} mean`, data: [{ x: 0.5, y: s.mean }, { x: opts.scales.x.max, y: s.mean }], borderColor: s.color, borderDash: [6, 4], borderWidth: 1, pointRadius: 0 });
      }
      return { type: 'scatter', data: { datasets: ds }, options: opts };
    }

    if (kind === 'dVsHB') {
      const opts = base(title, 'Indentation diameter d (mm)', 'Brinell hardness (HBW)');
      opts.plugins.tooltip = { callbacks: { label: c => c.raw.r ? `${c.dataset.label}: d = ${c.raw.x.toFixed(3)} mm → ${U.fmt(c.raw.y, 1)} HBW` : `${c.dataset.label}` } };
      const ds = [];
      const conds = [...new Set(runs.map(r => `${r.D}|${r.F}`))];
      conds.forEach(k => {
        const [D, F] = k.split('|').map(Number);
        const pts = [];
        for (let i = 0; i <= 40; i++) { const d = D * (0.24 + 0.36 * i / 40); pts.push({ x: d, y: P.bhn(F, D, d) }); }
        ds.push({ type: 'line', label: `HB(d): ${F} kgf, Ø${D}`, data: pts, borderColor: '#9aa3ad', borderDash: [5, 4], borderWidth: 1.2, pointRadius: 0 });
      });
      for (const s of S) ds.push({ type: 'scatter', label: s.name, data: s.runs.map(r => ({ x: r.d, y: r.bhn, r: 1 })), backgroundColor: s.color, borderColor: s.color, pointRadius: 5 });
      return { type: 'scatter', data: { datasets: ds }, options: opts };
    }

    if (kind === 'loadVsD') {
      const opts = base(title, 'Test load F (kgf)', 'Indentation diameter d (mm)');
      opts.scales.x.min = 0;
      opts.scales.x.max = 3200;
      opts.plugins.tooltip = { callbacks: { label: c => c.raw.r ? `${c.dataset.label}: ${c.raw.x} kgf → d = ${c.raw.y.toFixed(3)} mm` : c.dataset.label } };
      const ds = [];
      for (const s of S) {
        const pts = [];
        for (let F = 50; F <= 3000; F += 50) pts.push({ x: F, y: P.diameterFromHB(F, 10, s.mean) });
        ds.push({ type: 'line', label: `${s.name} model (HB ${Math.round(s.mean)})`, data: pts, borderColor: s.color, borderDash: [5, 4], borderWidth: 1.2, pointRadius: 0 });
        ds.push({ type: 'scatter', label: `${s.name} measured`, data: s.runs.map(r => ({ x: r.F, y: r.d, r: 1 })), backgroundColor: s.color, borderColor: s.color, pointRadius: 6 });
      }
      return { type: 'scatter', data: { datasets: ds }, options: opts };
    }

    if (kind === 'range') {
      const opts = base(title, 'Material', 'Brinell hardness (HBW)');
      opts.indexAxis = 'x';
      opts.plugins.tooltip = { callbacks: { label: c => c.datasetIndex === 0 ? `Range ${U.fmt(c.raw[0], 1)} – ${U.fmt(c.raw[1], 1)} HBW` : `Mean ${U.fmt(c.raw, 1)} HBW` } };
      return {
        type: 'bar',
        data: {
          labels: S.map(s => s.name),
          datasets: [
            { label: 'Min – max', data: S.map(s => [s.min - (s.range ? 0 : 0.5), s.max + (s.range ? 0 : 0.5)]), backgroundColor: S.map(s => s.color + '66'), borderColor: S.map(s => s.color), borderWidth: 1.5, maxBarThickness: 70 },
            { type: 'line', label: 'Mean', data: S.map(s => s.mean), showLine: false, pointStyle: 'line', pointRadius: 22, borderWidth: 3, borderColor: '#1b2430' },
          ],
        },
        options: opts,
      };
    }
  }

  function render(canvas, kind, runs, opts) { return new Chart(canvas, config(kind, runs, opts)); }

  // Render a chart off-screen and return a JPEG data URL (for the PDF report).
  function toImage(kind, runs, w = 1000, h = 520) {
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}px;height:${h}px;`;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    host.appendChild(c);
    document.body.appendChild(host);
    const cfg = config(kind, runs, { showTitle: true });
    cfg.options.responsive = false;
    cfg.options.animation = false;
    cfg.options.devicePixelRatio = 1.6;
    // Larger type so the chart stays legible when scaled onto an A4 page.
    const f = size => ({ size });
    cfg.options.plugins.title.font = { size: 20, weight: '600' };
    cfg.options.plugins.legend.labels.font = f(15);
    for (const ax of Object.values(cfg.options.scales)) { ax.ticks = { ...(ax.ticks || {}), font: f(14) }; ax.title.font = f(15); }
    cfg.plugins = [...(cfg.plugins || []), whiteBg];
    const chart = new Chart(c, cfg);
    const url = c.toDataURL('image/jpeg', 0.9);
    chart.destroy();
    host.remove();
    return url;
  }

  return { summary, config, render, toImage, TITLES, NOTES, COLORS, KINDS: Object.keys(TITLES) };
})();
