// Stage 4 — operate the machine. The student drives every control; each action is
// validated against the machine state and the ISO 6506-1 procedure, with feedback.
SAM.brinell.views.test = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, P = B.physics, data = B.data;

  if (rec.pending) {
    el.innerHTML = `<div class="card narrow">
      <h2>Indentation awaiting measurement</h2>
      <p>${U.esc(data.materials[rec.pending.material].name)} sample ${rec.pending.sample} has been indented but not measured yet. Measure it with the microscope before starting another test.</p>
      <a class="btn primary" href="#/exp/brinell/microscope">Open microscope →</a></div>`;
    return;
  }

  const mat = data.materials[rec.current.material];
  const sample = rec.current.sample;
  const R = P.SPEC_R;
  const ANVIL_LOW = 530, ANVIL_MIN = 450;
  const STEPS = [
    'Place the specimen on the anvil',
    'Position the test point below the indenter',
    'Select and install the indenter',
    'Select the test load',
    'Raise the anvil to contact (hand wheel)',
    'Apply the test force',
    'Maintain the dwell time (10 – 15 s)',
    'Release the test force',
    'Lower the anvil, remove & inspect the specimen',
  ];

  const st = {
    placed: false, pos: null, posOk: false, D: null, F: null,
    anvil: ANVIL_LOW, contact: false, phase: 'idle',
    loadTime: 0, t0: 0, dwellStart: 0, dwell: 0, load: 0,
    hold: 0, holdMsg: false, removed: false, sim: null,
    done: new Set(), fail: new Set(), errors: 0, log: [], dwellNotes: {},
  };

  const tip = () => 624 - (st.D || 0);               // lowest point of the indenter, mm
  const specTop = () => st.anvil + (st.placed ? 20 : 0);
  const gap = () => tip() - specTop();
  const minEdge = () => 2.5 * 0.6 * (st.D || 10);   // conservative 2.5d with d ≤ 0.6D

  el.innerHTML = `
    <div class="exp-layout test">
      <section class="viewer-card">
        <div class="viewer" id="viewer"></div>
        <div class="hud">
          <div><span>Specimen</span><strong>${U.esc(mat.name)} · S${sample}</strong></div>
          <div><span>Gap</span><strong id="h-gap">—</strong></div>
          <div><span>Contact</span><strong><i class="lamp" id="h-contact"></i></strong></div>
          <div><span>Force</span><strong id="h-load">0 kgf</strong></div>
          <div><span>Dwell</span><strong id="h-dwell">—</strong></div>
          <div><span>Status</span><strong id="h-phase">Idle</strong></div>
        </div>
        <div class="viewer-tools">
          <button class="btn sm" id="view-test">Focus test area</button>
          <button class="btn sm" id="view-reset">Whole machine</button>
          <span class="hint">You must operate each control yourself — the platform checks every step.</span>
        </div>
      </section>
      <aside class="side">
        <div class="card">
          <div class="card-head"><h3>Procedure</h3><span class="pill" id="step-pill"></span></div>
          <ol class="checklist" id="checklist"></ol>
        </div>
        <div class="card controls">
          <h3>Machine controls</h3>
          <div class="ctl">
            <label>1 · Specimen</label>
            <div class="row"><button class="btn" id="b-place">Place specimen on anvil</button></div>
          </div>
          <div class="ctl">
            <label>2 · Test point (top view of specimen — click to choose)</label>
            <div class="row pos-row">
              <canvas id="pos" width="180" height="180"></canvas>
              <div class="pos-info">
                <div id="pos-read" class="mono">No point chosen</div>
                <div class="muted small">Green zone: centre ≥ 2.5d from the edge.</div>
                <button class="btn" id="b-pos">Confirm position</button>
              </div>
            </div>
          </div>
          <div class="ctl">
            <label>3 · Indenter</label>
            <div class="row">
              <select id="s-ind"><option value="">— select ball —</option>${data.indenters.map(i => `<option value="${i.D}">${i.label}</option>`).join('')}</select>
              <button class="btn" id="b-ind">Install</button>
            </div>
          </div>
          <div class="ctl">
            <label>4 · Load selector</label>
            <div class="row">
              <select id="s-load"><option value="">— select test force —</option>${data.loads.map(l => `<option value="${l}">${l} kgf</option>`).join('')}</select>
              <span class="mono" id="ratio">F/D² —</span>
            </div>
          </div>
          <div class="ctl">
            <label>5 · Hand wheel (press and hold)</label>
            <div class="row">
              <button class="btn hold" id="b-up">▲ Raise anvil</button>
              <button class="btn hold" id="b-down">▼ Lower anvil</button>
            </div>
          </div>
          <div class="ctl">
            <label>6 – 8 · Loading lever & dwell timer</label>
            <div class="row">
              <button class="btn go" id="b-apply">Apply load</button>
              <div class="timer" id="timer">--.- s</div>
              <button class="btn stop" id="b-release">Release load</button>
            </div>
          </div>
          <div class="ctl">
            <label>9 · Finish</label>
            <div class="row">
              <button class="btn" id="b-remove">Remove specimen &amp; inspect</button>
              <button class="btn ghost sm" id="b-abort">Abort &amp; reset</button>
            </div>
          </div>
        </div>
        <div class="card" id="inspect" hidden></div>
        <div class="card">
          <div class="card-head"><h3>Feedback</h3><span class="muted small" id="err-count">0 errors</span></div>
          <ul class="log" id="log"></ul>
        </div>
      </aside>
    </div>`;

  const $ = s => el.querySelector(s);
  const machine = new B.Machine3D($('#viewer'), {});
  machine.viewTestArea();

  // ---------- feedback ----------
  function say(type, msg) {
    st.log.unshift({ type, msg, t: new Date() });
    if (type === 'err') st.errors++;
    $('#log').innerHTML = st.log.slice(0, 40).map(l =>
      `<li class="${l.type}"><time>${l.t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>${U.esc(l.msg)}</li>`).join('');
    $('#err-count').textContent = `${st.errors} procedural error${st.errors === 1 ? '' : 's'}`;
    if (type === 'err') U.toast(msg, 'err', 4200);
    renderChecklist();
  }

  function renderChecklist() {
    const next = STEPS.findIndex((_, i) => !st.done.has(i + 1) && !st.fail.has(i + 1));
    $('#checklist').innerHTML = STEPS.map((s, i) => {
      const n = i + 1;
      const cls = st.fail.has(n) ? 'fail' : st.done.has(n) ? 'done' : i === next ? 'now' : '';
      return `<li class="${cls}"><span class="mark">${st.fail.has(n) ? '✗' : st.done.has(n) ? '✓' : n}</span>${s}</li>`;
    }).join('');
    $('#step-pill').textContent = `${st.done.size}/${STEPS.length}`;
  }

  // ---------- position canvas ----------
  const pc = $('#pos');
  const dpr = window.devicePixelRatio || 1;
  pc.width = 180 * dpr; pc.height = 180 * dpr;
  pc.style.width = '180px'; pc.style.height = '180px';
  const SC = 80 / R; // px per mm

  function drawPos() {
    const g = pc.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, 180, 180);
    const cx = 90, cy = 90;
    g.fillStyle = '#9aa2ab';
    g.beginPath(); g.arc(cx, cy, 88, 0, Math.PI * 2); g.fill();
    if (!st.placed && !st.removed) {
      g.fillStyle = '#eef1f4'; g.font = '12px Inter, sans-serif'; g.textAlign = 'center';
      g.fillText('Anvil (no specimen)', cx, cy + 4);
      return;
    }
    g.fillStyle = mat.color;
    g.beginPath(); g.arc(cx, cy, R * SC, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    g.setLineDash([4, 3]); g.strokeStyle = '#167a3e'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, Math.max(0, R - minEdge()) * SC, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(22,122,62,.12)'; g.fill();
    if (st.pos) {
      const x = cx + st.pos.x * SC, y = cy - st.pos.y * SC;
      if (st.sim) {
        g.fillStyle = '#26292d';
        g.beginPath(); g.arc(x, y, (st.sim.d1 + st.sim.d2) / 4 * SC, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = st.posOk ? '#0b4fbf' : '#c8372d'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke();
    }
  }

  pc.addEventListener('click', e => {
    if (!st.placed) return say('err', 'Place a specimen on the anvil before choosing the test point.');
    if (st.phase !== 'idle') return say('err', 'The specimen cannot be moved during or after force application.');
    if (st.contact || gap() < 5) return say('err', 'Lower the anvil before repositioning the specimen — moving it in contact would scratch the surface and damage the ball.');
    const r = pc.getBoundingClientRect();
    let x = (e.clientX - r.left - 90) / SC, y = -(e.clientY - r.top - 90) / SC;
    const rr = Math.hypot(x, y);
    if (rr > R - 1) { x *= (R - 1) / rr; y *= (R - 1) / rr; }
    st.pos = { x, y };
    st.posOk = false;
    st.done.delete(2);
    machine.state.pos = st.pos;
    updatePosRead();
    drawPos();
    renderChecklist();
  });

  function updatePosRead() {
    if (!st.pos) { $('#pos-read').textContent = 'No point chosen'; return; }
    const edge = R - Math.hypot(st.pos.x, st.pos.y);
    $('#pos-read').innerHTML = `x = ${st.pos.x.toFixed(1)} mm, y = ${st.pos.y.toFixed(1)} mm<br>edge distance = ${edge.toFixed(1)} mm`;
  }

  // ---------- actions ----------
  $('#b-place').onclick = () => {
    if (st.removed) return say('err', 'This specimen has been tested. Select the next sample to continue.');
    if (st.placed) return say('info', 'The specimen is already on the anvil.');
    if (st.anvil > ANVIL_LOW + 1) return say('err', 'Lower the anvil with the hand wheel to make room before placing the specimen.');
    st.placed = true;
    st.done.add(1);
    machine.state.specimen = mat.id;
    machine.state.pos = st.pos || { x: 0, y: 0 };
    say('ok', `${mat.name} sample ${sample} placed on the anvil and located by the holder jaws. Check that it sits flat.`);
    drawPos();
  };

  $('#b-pos').onclick = () => {
    if (!st.placed) return say('err', 'Place the specimen on the anvil first.');
    if (!st.pos) return say('err', 'Click on the specimen top view to choose where the indentation will be made.');
    if (st.phase !== 'idle') return say('err', 'The position cannot be changed now.');
    const edge = R - Math.hypot(st.pos.x, st.pos.y);
    st.posOk = true;
    st.done.add(2);
    if (edge < minEdge()) say('warn', `Edge distance is ${edge.toFixed(1)} mm. ISO 6506-1 needs at least 2.5d (≈ ${minEdge().toFixed(1)} mm for the largest valid indentation). The result may be invalid.`);
    else say('ok', `Test point confirmed ${edge.toFixed(1)} mm from the edge — the specimen is aligned under the indenter axis.`);
    drawPos();
  };

  $('#b-ind').onclick = () => {
    const D = parseFloat($('#s-ind').value);
    if (!D) return say('err', 'Choose a ball diameter from the list first.');
    if (st.phase === 'loading' || st.phase === 'dwell') return say('err', 'Never change the indenter while the force is applied.');
    if (st.placed && gap() < 10) return say('err', 'Lower the anvil before changing the indenter — there is not enough clearance.');
    if (st.phase === 'released') return say('err', 'This specimen is already indented. Remove it before changing the indenter.');
    st.D = D;
    st.done.add(3);
    machine.state.indenterD = D;
    say('ok', `Ø ${D} mm tungsten-carbide ball installed in the holder.`);
    ratioFeedback();
    drawPos();
  };

  $('#s-load').onchange = e => {
    const F = parseFloat(e.target.value);
    if (st.phase === 'loading' || st.phase === 'dwell') {
      e.target.value = st.F || '';
      return say('err', 'Never turn the load selector while the test force is applied — it can damage the weight mechanism.');
    }
    if (!F) return;
    st.F = F;
    st.done.add(4);
    machine.state.selectedLoad = F;
    say('info', `Load selector set to ${F} kgf (${(F * 9.80665 / 1000).toFixed(2)} kN).`);
    ratioFeedback();
  };

  function ratioFeedback() {
    if (!st.D || !st.F) { $('#ratio').textContent = 'F/D² —'; return; }
    const r = P.ratio(st.F, st.D);
    const ok = mat.ratios.some(x => Math.abs(x - r) < 0.01);
    $('#ratio').innerHTML = `F/D² = <b class="${ok ? 'ok' : 'warn'}">${+r.toFixed(2)}</b>`;
    if (!ok) say('warn', `F/D² = ${+r.toFixed(2)} is not the recommended ratio for ${mat.name} (${mat.ratios.join(' or ')}). The indentation may fall outside 0.24D – 0.6D.`);
    else say('ok', `F/D² = ${+r.toFixed(2)} — appropriate for ${mat.name}.`);
  }

  $('#b-apply').onclick = () => {
    if (st.phase === 'released') return say('err', 'This specimen has already been indented. Lower the anvil and remove it.');
    if (st.phase !== 'idle') return say('info', 'The test force is already applied.');
    if (!st.placed) return say('err', 'No specimen on the anvil. Never load the indenter against the bare anvil.');
    if (!st.posOk) return say('err', 'Confirm the test position before applying the force.');
    if (!st.D) return say('err', 'No indenter installed.');
    if (!st.F) return say('err', 'Select the test force on the load selector first.');
    if (!st.contact) return say('err', 'The specimen is not in contact with the indenter. Raise the anvil with the hand wheel until the contact lamp lights.');
    st.phase = 'loading';
    st.loadTime = 3 + Math.random() * 2.5;
    st.t0 = performance.now();
    st.done.add(6);
    machine.state.lever = 1;
    say('info', `Loading lever pulled — force rising smoothly to ${st.F} kgf (standard: 2 – 8 s).`);
  };

  $('#b-release').onclick = () => {
    if (st.phase === 'idle') return say('err', 'No force is applied.');
    if (st.phase === 'released') return say('info', 'The force has already been released.');
    if (st.phase === 'loading') return say('err', 'The full test force has not been reached yet — wait for the needle to settle, then hold for 10 – 15 s.');
    st.dwell = (performance.now() - st.dwellStart) / 1000;
    st.phase = 'released';
    machine.state.lever = 0;
    if (st.dwell < 10) {
      st.fail.add(7);
      say('err', `Force released after ${st.dwell.toFixed(1)} s — less than the 10 s minimum. Plastic flow is incomplete; this test will be recorded as invalid.`);
    } else {
      st.done.add(7);
      if (st.dwell > 15) say('warn', `Dwell time ${st.dwell.toFixed(1)} s exceeds 15 s. It must be stated in the result designation.`);
      else say('ok', `Dwell time ${st.dwell.toFixed(1)} s — within 10 – 15 s.`);
    }
    st.done.add(8);
    st.sim = P.simulate({ studentId: SAM.store.currentId(), material: mat.id, sample, D: st.D, F: st.F, dwell: st.dwell, pos: st.pos });
    machine.state.indentD = (st.sim.d1 + st.sim.d2) / 2;
    say('info', 'Force released. Lower the anvil with the hand wheel, then remove the specimen.');
    drawPos();
  };

  $('#b-remove').onclick = () => {
    if (st.removed) return say('info', 'The specimen has already been removed.');
    if (!st.placed) return say('err', 'There is no specimen on the anvil.');
    if (st.phase === 'loading' || st.phase === 'dwell') return say('err', 'Release the test force first.');
    if (st.phase !== 'released') return say('err', 'The specimen has not been tested yet. Complete the test or use Abort & reset.');
    if (gap() < 10) return say('err', 'Lower the anvil with the hand wheel before removing the specimen.');
    st.removed = true;
    st.placed = false;
    st.done.add(9);
    machine.state.specimen = null;
    const pending = {
      id: U.uid(), material: mat.id, sample, D: st.D, F: st.F, ratio: P.ratio(st.F, st.D),
      dwell: st.dwell, loadTime: st.loadTime, pos: st.pos, edge: st.sim.edge,
      sim: st.sim, procErrors: st.errors, testedAt: Date.now(),
    };
    SAM.store.update('brinell', r => { r.pending = pending; });
    say('ok', 'Specimen removed. A clear circular indentation is visible on the test surface.');
    $('#inspect').hidden = false;
    $('#inspect').innerHTML = `
      <h3>Inspect the indentation</h3>
      <p>The ${U.esc(mat.name.toLowerCase())} specimen shows a circular impression roughly ${((st.sim.d1 + st.sim.d2) / 2).toFixed(1)} mm across by eye. Measure it precisely with the Brinell microscope in two perpendicular directions.</p>
      <a class="btn primary block" href="#/exp/brinell/microscope">Measure with microscope →</a>`;
    $('#inspect').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    drawPos();
  };

  $('#b-abort').onclick = () => {
    if (st.phase === 'loading' || st.phase === 'dwell') return say('err', 'Release the force before resetting the machine.');
    if (st.phase === 'released' && !st.removed) return say('err', 'The specimen is already indented — lower the anvil and remove it to finish this test.');
    if (st.removed) return say('info', 'This test is complete. Go to the microscope to measure it.');
    Object.assign(st, { placed: false, pos: null, posOk: false, anvil: ANVIL_LOW, contact: false, phase: 'idle', sim: null });
    st.done.clear(); st.fail.clear();
    Object.assign(machine.state, { specimen: null, indentD: null, pos: { x: 0, y: 0 }, load: 0, lever: 0 });
    if (st.D) st.done.add(3);
    if (st.F) st.done.add(4);
    say('info', 'Machine reset: anvil lowered and specimen removed.');
    updatePosRead();
    drawPos();
  };

  // Hand wheel: press-and-hold buttons
  for (const [id, dir] of [['#b-up', 1], ['#b-down', -1]]) {
    const b = $(id);
    const start = e => { e.preventDefault(); st.hold = dir; st.holdMsg = false; b.classList.add('pressed'); };
    const stop = () => { if (st.hold === dir) st.hold = 0; b.classList.remove('pressed'); };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('pointercancel', stop);
  }

  function holdFail(type, msg) {
    if (!st.holdMsg) say(type, msg);
    st.holdMsg = true;
    st.hold = 0;
    el.querySelectorAll('.hold').forEach(b => b.classList.remove('pressed'));
  }

  function stepWheel(dt) {
    if (st.hold === 1) {
      if (st.phase === 'loading' || st.phase === 'dwell') return holdFail('err', 'Do not turn the hand wheel while the force is applied.');
      if (st.phase === 'released') return holdFail('err', 'The test is finished — lower the anvil, not raise it.');
      if (!st.D) return holdFail('err', 'Install the indenter before raising the anvil.');
      if (!st.placed) {
        if (gap() <= 15) return holdFail('err', 'Never raise the bare anvil toward the indenter — place a specimen first.');
      } else if (!st.posOk) {
        if (gap() <= 15) return holdFail('err', 'Confirm the test position before bringing the specimen up to the indenter.');
      }
      const g = gap();
      if (g <= 0.001) return holdFail('warn', 'The indenter is already in contact. Turning further would preload the specimen — stop at contact.');
      const v = g > 8 ? 32 : 3.5; // fast approach, then slow near contact
      st.anvil += Math.min(g, v * dt);
      if (st.placed && gap() <= 0.001) {
        st.anvil = tip() - 20;
        st.contact = true;
        st.done.add(5);
        say('ok', 'Specimen touching the ball — contact lamp on. Stop turning the hand wheel.');
        st.hold = 0;
        el.querySelectorAll('.hold').forEach(b => b.classList.remove('pressed'));
      }
    } else if (st.hold === -1) {
      if (st.phase === 'loading' || st.phase === 'dwell') return holdFail('err', 'Release the test force before lowering the anvil.');
      if (st.anvil <= ANVIL_MIN) return holdFail('info', 'The anvil is fully lowered.');
      st.anvil = Math.max(ANVIL_MIN, st.anvil - 32 * dt);
      if (st.contact && gap() > 0.05) st.contact = false;
    }
  }

  // ---------- main loop ----------
  let raf, last = performance.now();
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepWheel(dt);

    if (st.phase === 'loading') {
      const f = Math.min(1, (now - st.t0) / 1000 / st.loadTime);
      st.load = st.F * (1 - Math.pow(1 - f, 2));
      if (f >= 1) {
        st.phase = 'dwell';
        st.dwellStart = now;
        st.load = st.F;
        st.dwellNotes = {};
        say('ok', `Full test force of ${st.F} kgf reached in ${st.loadTime.toFixed(1)} s. Dwell timer started — hold for 10 – 15 s.`);
      }
    } else if (st.phase === 'dwell') {
      const t = (now - st.dwellStart) / 1000;
      if (t >= 10 && !st.dwellNotes.a) { st.dwellNotes.a = 1; say('info', 'Minimum dwell of 10 s reached — release the force before 15 s.'); }
      if (t >= 15 && !st.dwellNotes.b) { st.dwellNotes.b = 1; say('warn', 'Dwell has passed 15 s — release the force now.'); }
    } else {
      st.load = 0;
    }

    const dwellT = st.phase === 'dwell' ? (now - st.dwellStart) / 1000 : st.phase === 'released' ? st.dwell : null;
    Object.assign(machine.state, { anvilTopMm: st.anvil, load: st.load, timerText: dwellT == null ? '--.-' : dwellT.toFixed(1) });
    machine.setContact(st.contact);

    const g = gap();
    $('#h-gap').textContent = st.contact ? '0.0 mm' : `${Math.max(0, g).toFixed(1)} mm`;
    $('#h-contact').className = 'lamp' + (st.contact ? ' on' : '');
    $('#h-load').textContent = `${Math.round(st.load)} kgf`;
    $('#h-dwell').textContent = dwellT == null ? '—' : `${dwellT.toFixed(1)} s`;
    $('#h-phase').textContent = { idle: st.contact ? 'In contact' : 'Idle', loading: 'Loading…', dwell: 'Holding force', released: st.removed ? 'Specimen removed' : 'Force released' }[st.phase];
    const tEl = $('#timer');
    tEl.textContent = dwellT == null ? '--.- s' : `${dwellT.toFixed(1)} s`;
    tEl.className = 'timer' + (st.phase === 'dwell' ? (dwellT < 10 ? ' wait' : dwellT <= 15 ? ' good' : ' over') : '');
  }
  raf = requestAnimationFrame(tick);

  say('info', `Test started for ${mat.name} sample ${sample}. Follow the standard procedure — the machine will not run itself.`);
  drawPos();
  renderChecklist();

  return () => { cancelAnimationFrame(raf); machine.dispose(); };
};
