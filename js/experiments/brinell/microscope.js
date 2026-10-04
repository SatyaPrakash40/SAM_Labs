// Stage 5 — virtual Brinell microscope. The student focuses, centres the
// indentation, aligns two hairlines with its edges and reads two diameters at 90°.
SAM.brinell.views.microscope = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, P = B.physics, data = B.data;
  const p = rec.pending;
  const mat = data.materials[p.material];
  const sim = p.sim;
  const LC = 0.01; // least count, mm

  const st = {
    mag: 20, focus: 50, light: 1.0, sx: 0, sy: 0, rot: 0,
    lines: [-1.2, 1.2],           // hairline positions, object-plane mm from field centre
    active: 1, d1: null, d2: null, saved: null, attempts: 0,
  };

  el.innerHTML = `
    <div class="exp-layout scope">
      <section class="card scope-card">
        <div class="card-head">
          <h3>Brinell microscope — ${U.esc(mat.name)} sample ${p.sample}</h3>
          <span class="pill" id="orient">Eyepiece 0°</span>
        </div>
        <div class="scope-wrap"><canvas id="scope"></canvas></div>
        <div class="readout">
          <div><span>Hairline separation</span><strong class="mono" id="sep">—</strong></div>
          <div><span>Magnification</span><strong id="r-mag">20×</strong></div>
          <div><span>Image</span><strong id="r-focus">—</strong></div>
        </div>
        <p class="hint">Drag a hairline to move it, or drag the image to move the stage. Use the micrometer buttons for 0.01 mm steps.</p>
      </section>
      <aside class="side">
        <div class="card controls">
          <h3>Microscope controls</h3>
          <div class="ctl"><label>Objective / magnification</label>
            <div class="row seg" id="mags">${[10, 20, 40].map(m => `<button class="btn sm ${m === 20 ? 'on' : ''}" data-mag="${m}">${m}×</button>`).join('')}</div></div>
          <div class="ctl"><label>Focus (coarse / fine)</label>
            <div class="row"><input type="range" id="focus" min="0" max="100" step="0.1" value="50">
              <button class="btn sm" data-f="-0.5">−</button><button class="btn sm" data-f="0.5">+</button></div></div>
          <div class="ctl"><label>Illumination</label>
            <div class="row"><input type="range" id="light" min="0.3" max="1.6" step="0.01" value="1"></div></div>
          <div class="ctl"><label>Stage X / Y (mm)</label>
            <div class="row"><input type="range" id="sx" min="-4" max="4" step="0.01" value="0"><input type="range" id="sy" min="-4" max="4" step="0.01" value="0"></div></div>
          <div class="ctl"><label>Eyepiece orientation</label>
            <div class="row seg" id="rots"><button class="btn sm on" data-rot="0">0° (read d₁)</button><button class="btn sm" data-rot="90">90° (read d₂)</button></div></div>
          <div class="ctl"><label>Hairline micrometer (0.01 mm)</label>
            <div class="row micro">
              <span>Left</span><button class="btn sm" data-l="0" data-d="-1">◀</button><button class="btn sm" data-l="0" data-d="1">▶</button>
              <span>Right</span><button class="btn sm" data-l="1" data-d="-1">◀</button><button class="btn sm" data-l="1" data-d="1">▶</button>
            </div></div>
          <button class="btn primary block" id="record">Record reading</button>
        </div>
        <div class="card">
          <h3>Readings</h3>
          <table class="kv">
            <tr><th>d₁ (0°)</th><td class="mono" id="v-d1">—</td></tr>
            <tr><th>d₂ (90°)</th><td class="mono" id="v-d2">—</td></tr>
            <tr><th>Mean d</th><td class="mono" id="v-d">—</td></tr>
          </table>
        </div>
        <div class="card" id="calc" hidden></div>
      </aside>
    </div>`;

  const $ = s => el.querySelector(s);
  const cv = $('#scope');
  let size = 520, dpr = window.devicePixelRatio || 1;

  // ---------- specimen surface texture (seeded per indentation) ----------
  const TEX_MM = 24;
  const tex = document.createElement('canvas');
  tex.width = tex.height = 1024;
  (function makeTexture() {
    const g = tex.getContext('2d');
    const r = U.rng(sim.seed);
    const [cr, cg, cb] = mat.surface;
    const img = g.createImageData(1024, 1024);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 26;
      img.data[i] = cr + n; img.data[i + 1] = cg + n; img.data[i + 2] = cb + n; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const ang = r() * Math.PI;
    for (let i = 0; i < 260; i++) {
      const x = r() * 1024, y = r() * 1024, len = 60 + r() * 500, a = ang + (r() - 0.5) * 0.25;
      g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.05 + r() * 0.12})`;
      g.lineWidth = 0.5 + r() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(20,20,20,${0.2 + r() * 0.4})`;
      g.beginPath(); g.arc(r() * 1024, r() * 1024, 0.6 + r() * 2.2, 0, Math.PI * 2); g.fill();
    }
  })();

  // Slightly irregular outline (seeded harmonics) — real indentations are not perfect circles.
  const harm = (() => {
    const r = U.rng(sim.seed + 7);
    return [2, 3, 5, 7, 11].map(k => ({ k, amp: (r() * 0.004) / Math.sqrt(k), ph: r() * Math.PI * 2 }));
  })();

  function outline(g, a, b, s = 1) {
    g.beginPath();
    for (let i = 0; i <= 180; i++) {
      const t = (i / 180) * Math.PI * 2;
      let rr = 1;
      for (const h of harm) rr += h.amp * Math.cos(h.k * t + h.ph);
      const x = a * rr * s * Math.cos(t), y = b * rr * s * Math.sin(t);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  }

  const fieldMm = () => 160 / st.mag;
  const ppm = () => size / fieldMm();
  const blurPx = () => Math.min(12, Math.abs(st.focus - sim.focus) * 0.16 * (st.mag / 20));

  function draw() {
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = size / 2;
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    g.save();
    g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.clip();

    const s = ppm();
    g.save();
    try { g.filter = `blur(${blurPx().toFixed(2)}px) brightness(${st.light})`; } catch (e) { /* unsupported */ }
    g.translate(c, c);
    g.rotate(st.rot ? -Math.PI / 2 : 0);
    g.scale(s, s);
    g.translate(-(sim.ox + st.sx), -(sim.oy + st.sy));
    g.drawImage(tex, -TEX_MM / 2, -TEX_MM / 2, TEX_MM, TEX_MM);
    const a = sim.d1 / 2, b = sim.d2 / 2;
    // faint pile-up halo
    outline(g, a, b, 1.05);
    g.lineWidth = 0.18; g.strokeStyle = 'rgba(255,255,255,0.10)'; g.stroke();
    // dish
    outline(g, a, b);
    const gr = g.createRadialGradient(-a * 0.08, -b * 0.08, 0, 0, 0, Math.max(a, b));
    gr.addColorStop(0, '#6d7075');
    gr.addColorStop(0.18, '#45484c');
    gr.addColorStop(0.75, '#2e3033');
    gr.addColorStop(0.95, '#1a1b1d');
    gr.addColorStop(1, '#0f1011');
    g.fillStyle = gr; g.fill();
    // concentric tool marks inside the dish
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 0.02;
    for (let k = 0.3; k < 0.95; k += 0.12) { outline(g, a, b, k); g.stroke(); }
    // sharp rim
    outline(g, a, b);
    g.lineWidth = 0.03; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke();
    g.restore();

    // vignette
    const vg = g.createRadialGradient(c, c, c * 0.55, c, c, c);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, size, size);

    // graticule scale (eyepiece, fixed): 0.1 mm ticks
    const half = fieldMm() * 0.42;
    const y0 = c + c * 0.62;
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 3;
    g.lineWidth = 1; g.font = 'bold 11px "JetBrains Mono", monospace'; g.textAlign = 'center';
    const step = st.mag >= 20 ? 0.1 : 0.2;
    g.beginPath(); g.moveTo(c - half * s, y0); g.lineTo(c + half * s, y0); g.stroke();
    for (let v = -Math.floor(half); v <= half + 1e-9; v += step) {
      const x = c + v * s;
      const major = Math.abs(v - Math.round(v)) < 1e-6;
      const mid = Math.abs(v * 2 - Math.round(v * 2)) < 1e-6;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 - (major ? 12 : mid ? 8 : 4)); g.stroke();
      if (major) g.fillText(String(Math.round(v + Math.floor(half))), x, y0 + 14);
    }
    g.fillText('mm', c + half * s + 18, y0 + 4);
    g.shadowBlur = 0;

    // hairlines
    st.lines.forEach((v, i) => {
      const x = c + v * s;
      g.strokeStyle = i === st.active ? '#ffdd55' : '#ff6b5a';
      g.lineWidth = i === st.active ? 1.6 : 1.2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke();
      g.fillStyle = g.strokeStyle;
      g.beginPath(); g.moveTo(x - 6, 14); g.lineTo(x + 6, 14); g.lineTo(x, 24); g.closePath(); g.fill();
      g.font = 'bold 11px Inter, sans-serif';
      g.fillText(i ? 'R' : 'L', x, 10);
    });
    // horizontal reference line
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, c); g.lineTo(size, c); g.stroke();
    g.restore();

    // ring
    g.strokeStyle = '#222'; g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.stroke();

    const sep = Math.abs(st.lines[1] - st.lines[0]);
    $('#sep').textContent = `${(Math.round(sep / LC) * LC).toFixed(2)} mm`;
    $('#r-mag').textContent = `${st.mag}×`;
    const bpx = blurPx();
    $('#r-focus').innerHTML = bpx <= 1.0 ? '<span class="ok">Sharp</span>' : bpx <= 3 ? '<span class="warn">Slightly blurred</span>' : '<span class="err">Out of focus</span>';
    $('#orient').textContent = `Eyepiece ${st.rot ? 90 : 0}° — reading ${st.rot ? 'd₂' : 'd₁'}`;
  }

  function resize() {
    const w = Math.min(560, $('.scope-wrap').clientWidth || 520);
    size = Math.max(260, w);
    dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe($('.scope-wrap'));

  // ---------- interaction ----------
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, c = size / 2;
    const d = st.lines.map(v => Math.abs(c + v * ppm() - x));
    const i = d[0] < d[1] ? 0 : 1;
    cv.setPointerCapture(e.pointerId);
    if (d[i] < 12) { st.active = i; drag = { kind: 'line', i }; }
    else drag = { kind: 'pan', x: e.clientX, y: e.clientY, sx: st.sx, sy: st.sy };
    draw();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) {
      const r = cv.getBoundingClientRect(), c = size / 2;
      const near = st.lines.some(v => Math.abs(c + v * ppm() - (e.clientX - r.left)) < 12);
      cv.style.cursor = near ? 'ew-resize' : 'grab';
      return;
    }
    if (drag.kind === 'line') {
      const r = cv.getBoundingClientRect();
      st.lines[drag.i] = (e.clientX - r.left - size / 2) / ppm();
    } else {
      // Moving the image with the stage; account for eyepiece rotation.
      let dx = (e.clientX - drag.x) / ppm(), dy = (e.clientY - drag.y) / ppm();
      if (st.rot) [dx, dy] = [-dy, dx];
      st.sx = U.clamp(drag.sx - dx, -4, 4);
      st.sy = U.clamp(drag.sy - dy, -4, 4);
      $('#sx').value = st.sx; $('#sy').value = st.sy;
    }
    draw();
  });
  const end = () => { drag = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  $('#mags').onclick = e => {
    const b = e.target.closest('[data-mag]');
    if (!b) return;
    st.mag = +b.dataset.mag;
    $('#mags').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    draw();
  };
  $('#rots').onclick = e => {
    const b = e.target.closest('[data-rot]');
    if (!b) return;
    st.rot = +b.dataset.rot;
    $('#rots').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    draw();
  };
  $('#focus').oninput = e => { st.focus = +e.target.value; draw(); };
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    st.focus = U.clamp(st.focus + +b.dataset.f, 0, 100);
    $('#focus').value = st.focus;
    draw();
  });
  $('#light').oninput = e => { st.light = +e.target.value; draw(); };
  $('#sx').oninput = e => { st.sx = +e.target.value; draw(); };
  $('#sy').oninput = e => { st.sy = +e.target.value; draw(); };
  el.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
    const i = +b.dataset.l;
    st.active = i;
    st.lines[i] = Math.round(st.lines[i] / LC + +b.dataset.d) * LC;
    draw();
  });

  $('#record').onclick = () => {
    if (st.saved) return U.toast('This test has already been saved.', 'info');
    if (blurPx() > 1.0) return U.toast('The image is not sharp — adjust the focus before reading the diameter.', 'warn');
    if (st.light < 0.6 || st.light > 1.4) return U.toast('Illumination is poor — adjust it so the edge of the indentation is clearly visible.', 'warn');
    const read = Math.round(Math.abs(st.lines[1] - st.lines[0]) / LC) * LC;
    if (read < 0.2) return U.toast('Place the two hairlines on opposite edges of the indentation.', 'warn');
    // Hairlines must lie on the indentation edges in the current orientation.
    const along = st.rot ? sim.d2 : sim.d1;
    const centre = st.rot ? (sim.oy + st.sy) : (sim.ox + st.sx);
    const mid = (st.lines[0] + st.lines[1]) / 2;
    st.attempts++;
    if (Math.abs(read - along) / along > 0.025 || Math.abs(mid + centre) > along * 0.06) {
      return U.toast('The hairlines do not appear to be tangent to opposite edges of the indentation. Centre the indentation and re-align both lines.', 'warn', 4500);
    }
    if (st.rot) st.d2 = read; else st.d1 = read;
    U.toast(`${st.rot ? 'd₂' : 'd₁'} = ${read.toFixed(2)} mm recorded.`, 'ok');
    if (st.d1 != null && st.d2 == null) U.toast('Now rotate the eyepiece 90° and measure d₂.', 'info', 4000);
    showReadings();
  };

  function showReadings() {
    $('#v-d1').textContent = st.d1 != null ? st.d1.toFixed(2) + ' mm' : '—';
    $('#v-d2').textContent = st.d2 != null ? st.d2.toFixed(2) + ' mm' : '—';
    if (st.d1 == null || st.d2 == null) return;
    const d = (st.d1 + st.d2) / 2;
    $('#v-d').textContent = d.toFixed(3) + ' mm';
    const hb = P.bhn(p.F, p.D, d);
    const run = { ...p, sim: undefined, m1: st.d1, m2: st.d2, d, bhn: hb, h: P.depth(p.D, d) };
    const checks = P.checks(run);
    run.valid = !checks.some(c => c.level === 'err');
    run.checks = checks;
    run.designation = P.designation(hb, p.D, p.F, p.dwell);
    const root = Math.sqrt(p.D * p.D - d * d);
    $('#calc').hidden = false;
    $('#calc').innerHTML = `
      <h3>Brinell hardness calculation</h3>
      <div class="chain">
        <span>${U.esc(mat.name)}</span><i>→</i><span>Ø ${p.D} mm ball</span><i>→</i><span>${p.F} kgf</span><i>→</i><span>d = ${d.toFixed(3)} mm</span><i>→</i><span class="hl">${U.fmt(hb, 1)} HBW</span>
      </div>
      <div class="formula small">HB = 2F / [πD (D − √(D² − d²))]<br>
        = 2 × ${p.F} / [π × ${p.D} × (${p.D} − √(${p.D}² − ${d.toFixed(3)}²))]<br>
        = ${(2 * p.F).toFixed(1)} / [${(Math.PI * p.D).toFixed(3)} × (${p.D} − ${root.toFixed(4)})]<br>
        = <b>${U.fmt(hb, 1)}</b></div>
      <p class="small">Depth h = ${run.h.toFixed(3)} mm · d/D = ${(d / p.D).toFixed(3)} · F/D² = ${+p.ratio.toFixed(2)} · dwell ${p.dwell.toFixed(1)} s</p>
      <p>Result: <strong>${U.esc(run.designation)}</strong></p>
      <ul class="checks">${checks.map(c => `<li class="${c.level}"><b>${U.esc(c.label)}</b> ${U.esc(c.detail)}</li>`).join('')}</ul>
      <p class="${run.valid ? 'ok' : 'err'}"><strong>${run.valid ? 'Valid test per ISO 6506-1.' : 'Invalid test — it will be stored but excluded from the results. Retest this sample.'}</strong></p>
      <button class="btn primary block" id="save">Save observation</button>
      <div id="after"></div>`;
    $('#save').onclick = () => save(run);
  }

  function save(run) {
    if (st.saved) return;
    run.measuredAt = Date.now();
    run.measureAttempts = st.attempts;
    delete run.sim;
    st.saved = run;
    SAM.store.update('brinell', r => {
      r.runs.push(run);
      r.pending = null;
    });
    const recNow = SAM.store.exp('brinell');
    const tested = new Set(recNow.runs.filter(x => x.material === run.material && x.valid).map(x => x.sample));
    let next = run.valid ? run.sample + 1 : run.sample;
    while (run.valid && tested.has(next) && next <= 10) next++;
    $('#save').remove();
    $('#after').innerHTML = `
      <p class="ok">Observation saved.</p>
      <div class="stack">
        ${next <= 10 ? `<button class="btn primary block" id="next">${run.valid ? 'Test next sample' : 'Retest'}: ${U.esc(mat.name)} S${next} →</button>` : ''}
        <a class="btn block" href="#/exp/brinell/specimen">Choose another material / sample</a>
        <a class="btn block" href="#/exp/brinell/analysis">View results &amp; plots</a>
      </div>`;
    const nb = $('#next');
    if (nb) nb.onclick = () => {
      SAM.store.update('brinell', r => { r.current = { material: run.material, sample: next }; });
      SAM.router.go('exp/brinell/test');
    };
  }

  resize();
  return () => ro.disconnect();
};
