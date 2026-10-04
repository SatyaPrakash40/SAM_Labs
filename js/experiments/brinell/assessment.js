// Stage 8 — auto-graded assessment: concepts, procedure, components, calculations, errors.
SAM.brinell.questions = function (rec) {
  const P = SAM.brinell.physics, mats = SAM.brinell.data.materials;
  const own = SAM.brinell.validRuns(rec)[0];
  const qs = [
    { cat: 'Concept', q: 'The Brinell hardness number is defined as the test force divided by:', options: ['the projected (flat) area of the indentation', 'the curved surface area of the spherical indentation', 'the depth of the indentation', 'the volume of displaced material'], answer: 1, explain: 'HB = F / (πDh) — force per unit curved (spherical-cap) area.' },
    { cat: 'Concept', q: 'Why is the ratio F/D² kept constant when a smaller ball is used?', options: ['To keep the dwell time the same', 'To produce geometrically similar indentations so the hardness values are comparable', 'To reduce friction between ball and specimen', 'To keep the indentation depth constant'], answer: 1, explain: 'Equal F/D² gives the same d/D ratio, i.e. geometrically similar impressions.' },
    { cat: 'Concept', q: 'What does the letter "W" in the designation 126 HBW 10/3000 indicate?', options: ['Weight of the machine', 'A tungsten-carbide ball indenter', 'Wrought material', 'Width of the indentation'], answer: 1, explain: 'HBW denotes a tungsten carbide (W) ball; steel balls (HBS) were withdrawn from ISO 6506.' },
    { cat: 'Concept', q: 'For carbon steels, the approximate tensile strength in MPa can be estimated from Brinell hardness as:', options: ['σu ≈ 0.345 × HB', 'σu ≈ 3.45 × HB', 'σu ≈ 34.5 × HB', 'σu ≈ HB / 3.45'], answer: 1, explain: 'An empirical correlation σu (MPa) ≈ 3.45 HB is widely used for steels.' },
    { cat: 'Procedure', q: 'According to ISO 6506-1, the full test force should be maintained for:', options: ['2 – 8 s', '10 – 15 s', '30 – 60 s', 'Until the needle stops moving, with no time limit'], answer: 1, explain: 'Dwell at full force: 10 – 15 s (2 – 8 s is the force-application time).' },
    { cat: 'Procedure', q: 'A Brinell test is valid only if the indentation diameter d lies between:', options: ['0.1 D and 0.4 D', '0.24 D and 0.6 D', '0.5 D and 0.9 D', 'Any value less than D'], answer: 1, explain: 'ISO 6506-1 requires 0.24D ≤ d ≤ 0.6D.' },
    { cat: 'Procedure', q: 'Which test force is NOT appropriate for brass (≈ 100 HBW) with a 10 mm ball?', options: ['1000 kgf', '3000 kgf', 'Both are appropriate', 'Neither is appropriate'], answer: 1, explain: 'Copper alloys use F/D² = 10 → 1000 kgf; 3000 kgf (ratio 30) is for steels.' },
    { cat: 'Procedure', q: 'The minimum distance from the centre of an indentation to the specimen edge is:', options: ['1 d', '2.5 d', '5 d', '8 h'], answer: 1, explain: 'Edge distance ≥ 2.5 d; spacing between indentations ≥ 3 d.' },
    { cat: 'Components', q: 'Which component brings the specimen into contact with the indenter?', options: ['Load selector knob', 'Hand wheel and elevating screw', 'Dead-weight hanger', 'Brinell microscope'], answer: 1, explain: 'The hand wheel drives the elevating screw to raise the anvil until contact.' },
    { cat: 'Components', q: 'In a hydraulic Brinell tester, what keeps the test force constant during the dwell?', options: ['The operator holding the lever', 'Dead weights that float and control the relief valve', 'The hand wheel friction', 'The microscope illumination'], answer: 1, explain: 'When pressure reaches the value set by the weights, the weights float and excess oil is bypassed.' },
    { cat: 'Components', q: 'The load indicator dial on a hydraulic Brinell machine actually senses:', options: ['Indentation depth', 'Oil pressure in the loading cylinder', 'Ball temperature', 'Anvil displacement'], answer: 1, explain: 'Force = pressure × ram area, so the pressure gauge is calibrated in kgf.' },
    { cat: 'Experimental error', q: 'Why are two diameters measured at 90° to each other?', options: ['To double the number of readings for the report', 'To account for slight ellipticity of the indentation (anisotropy, tilt)', 'Because the microscope cannot measure large diameters', 'To find the depth of the indentation'], answer: 1, explain: 'Averaging two perpendicular diameters compensates for non-circular impressions.' },
    { cat: 'Experimental error', q: 'If the indentation is made too close to the specimen edge, the measured hardness will usually be:', options: ['Higher than the true value', 'Lower than the true value', 'Unaffected', 'Zero'], answer: 1, explain: 'Material near the edge is less constrained, so it flows more and d is larger → HB is lower.' },
    { cat: 'Experimental error', q: 'Releasing the force after only 5 s (instead of 10 – 15 s) tends to:', options: ['Give a smaller indentation and an overestimated hardness', 'Give a larger indentation and an underestimated hardness', 'Have no effect', 'Damage the microscope'], answer: 0, explain: 'Plastic flow (creep) under the ball is incomplete, so d is smaller and HB too high.' },
    { cat: 'Calculation', type: 'num', q: 'A steel specimen tested with a 10 mm ball under 3000 kgf gives d = 4.00 mm. Calculate the Brinell hardness number.', answer: P.bhn(3000, 10, 4), tol: 0.01, unit: 'HBW', explain: `HB = 2×3000 / [π×10×(10 − √(100 − 16))] = ${P.bhn(3000, 10, 4).toFixed(1)}` },
    { cat: 'Calculation', type: 'num', q: 'For D = 10 mm and d = 4.00 mm, calculate the depth of the indentation h.', answer: P.depth(10, 4), tol: 0.01, unit: 'mm', explain: `h = (D − √(D² − d²)) / 2 = (10 − 9.1652) / 2 = ${P.depth(10, 4).toFixed(4)} mm` },
  ];
  if (own) {
    qs.push({
      cat: 'Calculation', type: 'num',
      q: `Using your own observation — ${mats[own.material].name} sample ${own.sample}: D = ${own.D} mm, F = ${own.F} kgf, d₁ = ${own.m1.toFixed(2)} mm, d₂ = ${own.m2.toFixed(2)} mm — calculate the Brinell hardness number.`,
      answer: own.bhn, tol: 0.01, unit: 'HBW',
      explain: `d = (${own.m1.toFixed(2)} + ${own.m2.toFixed(2)}) / 2 = ${own.d.toFixed(3)} mm → HB = ${own.bhn.toFixed(1)}`,
    });
  }
  // Shuffle MCQ options per student (stable across reloads).
  qs.forEach((q, i) => {
    if (q.type === 'num') return;
    const r = SAM.util.rng(`${SAM.store.currentId()}|brinell|q${i}`);
    const order = q.options.map((_, j) => j);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    q.options = order.map(j => q.options[j]);
    q.answer = order.indexOf(q.answer);
  });
  return qs;
};

SAM.brinell.views.assess = function (el, rec) {
  const U = SAM.util;
  const qs = SAM.brinell.questions(rec);
  const prev = rec.assessment;

  el.innerHTML = `
    <div class="card narrow-wide">
      <div class="card-head">
        <h2>Assessment — Brinell Hardness Test</h2>
        ${prev ? `<span class="pill ${prev.pct >= 60 ? 'ok' : 'warn'}">Last score ${prev.pct}% · attempt ${prev.attempts}</span>` : ''}
      </div>
      <p class="muted">${qs.length} questions covering concepts, procedure, machine components, calculations and experimental error. Numerical answers are accepted within ± 1 %.</p>
      <form id="quiz">
        ${qs.map((q, i) => `
          <fieldset class="q" data-i="${i}">
            <legend><span class="pill">${q.cat}</span> Q${i + 1}. ${U.esc(q.q)}</legend>
            ${q.type === 'num'
              ? `<div class="row"><input type="number" step="any" name="q${i}" placeholder="Your answer" required> <span>${q.unit}</span></div>`
              : q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}" required> ${U.esc(o)}</label>`).join('')}
            <div class="fb"></div>
          </fieldset>`).join('')}
        <div class="actions"><button class="btn primary" type="submit">Submit answers</button></div>
      </form>
      <div id="result"></div>
    </div>`;

  el.querySelector('#quiz').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let score = 0;
    const answers = qs.map((q, i) => {
      const raw = fd.get('q' + i);
      let correct;
      if (q.type === 'num') {
        const v = parseFloat(raw);
        correct = Number.isFinite(v) && Math.abs(v - q.answer) <= Math.abs(q.answer) * q.tol;
      } else correct = +raw === q.answer;
      if (correct) score++;
      const fs = el.querySelector(`fieldset[data-i="${i}"]`);
      fs.classList.remove('right', 'wrong');
      fs.classList.add(correct ? 'right' : 'wrong');
      fs.querySelector('.fb').innerHTML = `<b>${correct ? 'Correct.' : 'Incorrect.'}</b> ${q.type === 'num' ? `Expected ${q.answer.toFixed(q.unit === 'mm' ? 4 : 1)} ${q.unit}. ` : `Answer: ${U.esc(q.options[q.answer])}. `}${U.esc(q.explain)}`;
      return { q: q.q, cat: q.cat, given: q.type === 'num' ? raw : q.options[+raw], correct };
    });
    const pct = Math.round((score / qs.length) * 100);
    SAM.store.update('brinell', r => {
      r.assessment = { score, total: qs.length, pct, at: Date.now(), attempts: (r.assessment?.attempts || 0) + 1, answers };
    });
    el.querySelector('#result').innerHTML = `
      <div class="result ${pct >= 60 ? 'ok' : 'warn'}">
        <div class="big">${pct}%</div>
        <div>${score} of ${qs.length} correct. ${pct >= 60 ? 'Well done — the experiment is complete once your report is generated.' : 'Review the theory and procedure, then try again.'}</div>
        <div class="row"><a class="btn" href="#/exp/brinell/report">Update laboratory report</a><a class="btn primary" href="#/dashboard">Go to dashboard</a></div>
      </div>`;
    el.querySelector('#result').scrollIntoView({ behavior: 'smooth' });
  };
};
