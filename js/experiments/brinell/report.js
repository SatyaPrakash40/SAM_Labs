// Stage 7 — automatic laboratory report (PDF via jsPDF + autoTable).
SAM.brinell.report = (function () {
  const U = SAM.util;

  // Standard PDF fonts only cover Latin-1; map the symbols we use.
  function san(s) {
    return String(s ?? '')
      .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/≥/g, '>=').replace(/≤/g, '<=')
      .replace(/→/g, '->').replace(/[−–—]/g, '-').replace(/≈/g, '~').replace(/σ/g, 's')
      .replace(/₁/g, '1').replace(/₂/g, '2').replace(/✓/g, 'OK').replace(/✗/g, 'X').replace(/…/g, '...')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  }

  function discussion(S, rec, valid) {
    const D = SAM.brinell.data, out = [];
    const ranked = [...S].sort((a, b) => b.mean - a.mean);
    if (ranked.length > 1) out.push(`The hardness ranking obtained is ${ranked.map(s => `${s.name} (${s.mean.toFixed(1)} HBW)`).join(' > ')}. This order agrees with the expected behaviour: the ferrite–pearlite structure of mild steel resists plastic flow more than the alpha–beta structure of brass, and precipitation-hardened 6063 aluminium is the softest of the three.`);
    for (const s of S) {
      const m = D.materials[s.id];
      const dir = s.dev >= 0 ? 'higher' : 'lower';
      let t = `${s.name}: the mean hardness was ${s.mean.toFixed(1)} HBW from ${s.n} valid test${s.n > 1 ? 's' : ''}`;
      if (s.n > 1) t += ` with a standard deviation of ${s.sd.toFixed(2)} HBW (CoV ${s.cov.toFixed(2)} %)`;
      t += `. This is ${Math.abs(s.dev).toFixed(1)} % ${dir} than the typical value of about ${s.ref} HBW for ${m.grade}`;
      t += Math.abs(s.dev) <= 8 ? ', which is within the normal spread for commercial material.' : '; the difference may come from the temper or processing history of the stock, or from measurement error.';
      if (s.n > 1) t += s.cov < 2 ? ' Repeatability was excellent.' : s.cov < 4 ? ' Repeatability was good and typical of Brinell testing.' : ' The scatter is high — check focusing, hairline alignment and specimen preparation.';
      if (s.id === 'steel') t += ` Using the empirical relation su ~ 3.45 HB, the estimated tensile strength is ${(3.45 * s.mean).toFixed(0)} MPa, compared with a nominal ${m.uts} MPa.`;
      if (s.n < 5) t += ' Fewer than five samples were tested, so the statistics are only indicative.';
      out.push(t);
    }
    const invalid = rec.runs.filter(r => !r.valid);
    if (invalid.length) {
      const reasons = {};
      invalid.forEach(r => r.checks.filter(c => c.level === 'err').forEach(c => { reasons[c.label] = (reasons[c.label] || 0) + 1; }));
      out.push(`${invalid.length} test${invalid.length > 1 ? 's were' : ' was'} rejected as invalid (${Object.entries(reasons).map(([k, v]) => `${k}: ${v}`).join('; ')}). These were excluded from the results, showing why the validity conditions of ISO 6506-1 must be checked for every indentation.`);
    }
    const nonStd = valid.filter(r => r.checks.some(c => c.label === 'Force–diameter ratio' && c.level === 'warn'));
    if (nonStd.length) out.push(`${nonStd.length} valid test${nonStd.length > 1 ? 's used' : ' used'} a non-recommended force–diameter ratio. Although d/D stayed within limits, such results are not strictly comparable with values obtained at the standard ratio.`);
    out.push('Sources of error in this experiment include: judging the indentation edge under the microscope (especially with a raised rim or poor focus), slight ellipticity of the impression, local variations in microstructure between samples, surface finish, and variation in dwell time. Taking two perpendicular readings and testing several samples reduces the influence of these errors on the mean.');
    return out;
  }

  function conclusion(S) {
    const parts = S.map(s => `${s.name}: ${s.mean.toFixed(1)} HBW ${s.conditions.length === 1 ? s.conditions[0] : ''}${s.n > 1 ? ` (SD ${s.sd.toFixed(2)}, n = ${s.n})` : ''}`);
    return `The Brinell hardness of the tested materials was determined as ${parts.join('; ')}. ${S.length > 1 ? `Hardness decreases in the order ${[...S].sort((a, b) => b.mean - a.mean).map(s => s.name).join(' > ')}. ` : ''}All accepted indentations satisfied the validity requirements of ISO 6506-1, and the measured values are consistent with typical handbook values for these materials.`;
  }

  function build() {
    const B = SAM.brinell, D = B.data, P = B.physics;
    const student = SAM.store.student();
    const rec = SAM.store.exp('brinell');
    const prof = student.profile;
    const valid = B.validRuns(rec);
    const S = B.charts.summary(valid);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = 210, H = 297, M = 18, CW = W - 2 * M;
    let y = M;

    const ensure = h => { if (y + h > H - 18) { doc.addPage(); y = M + 6; } };
    const setBody = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 36, 48); };
    let secNo = 0;
    const H1 = t => {
      ensure(16);
      secNo++;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(23, 70, 140);
      doc.text(san(`${secNo}. ${t}`), M, y);
      y += 1.8; doc.setDrawColor(23, 70, 140); doc.setLineWidth(0.3); doc.line(M, y, W - M, y);
      y += 5.5; setBody();
    };
    const H2 = t => { ensure(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30, 36, 48); doc.text(san(t), M, y); y += 5; setBody(); };
    const para = (t, opts = {}) => {
      setBody();
      if (opts.mono) doc.setFont('courier', 'normal');
      if (opts.bold) doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(san(t), CW - (opts.indent || 0));
      for (const l of lines) { ensure(5); doc.text(l, M + (opts.indent || 0), y); y += 4.7; }
      y += 1.6;
    };
    const list = (items, numbered) => {
      setBody();
      items.forEach((t, i) => {
        const lines = doc.splitTextToSize(san(t), CW - 7);
        ensure(5 * lines.length);
        if (numbered) doc.text(`${i + 1}.`, M + 1, y);
        else doc.circle(M + 2.4, y - 1.2, 0.6, 'F');
        lines.forEach(l => { doc.text(l, M + 7, y); y += 4.7; });
        y += 0.6;
      });
      y += 1.4;
    };
    const table = (head, body, opts = {}) => {
      doc.autoTable({
        startY: y, head: [head.map(san)], body: body.map(r => r.map(c => san(c))),
        margin: { left: M, right: M, top: M + 4 }, theme: 'grid',
        styles: { fontSize: 8.4, cellPadding: 1.5, textColor: [30, 36, 48], lineColor: [210, 216, 225] },
        headStyles: { fillColor: [23, 70, 140], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        ...opts,
      });
      y = doc.lastAutoTable.finalY + 6;
    };
    const kv = rows => table(['Parameter', 'Value'], rows, { columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } } });

    // ----- Cover block -----
    doc.setFillColor(23, 70, 140); doc.rect(0, 0, W, 34, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('Laboratory Report: Brinell Hardness Test', M, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(san('SAM Labs - Virtual Mechanical Engineering Laboratory · Material Testing'), M, 24);
    doc.text(san(`${prof.name} · ${prof.roll} · Generated ${new Date().toLocaleString()}`), M, 30);
    y = 44;

    H1('Experiment Title');
    para('Determination of Brinell Hardness Number (HBW) of Brass, Aluminium Alloy and Mild Steel', { bold: true });
    H1('Aim'); para(D.aim);
    H1('Learning Objectives'); list(D.objectives, true);
    H1('Apparatus / Virtual Machine');
    list([
      `${D.machine.model} — ${D.machine.type}`,
      'Tungsten-carbide ball indenters Ø 10, 5 and 2.5 mm',
      'Brinell microscope 20× (10× – 40×), graticule with hairline micrometer, least count 0.01 mm',
      `Test specimens: discs Ø ${D.specimen.diameter} mm × ${D.specimen.thickness} mm (${D.specimen.finish})`,
      'Dwell timer (built into the control panel)',
    ]);
    H1('Machine Specifications'); kv(D.machine.specs);
    H1('Theory');
    D.theory.forEach(p => para(p));
    para('HB = 2F / [pi D (D - sqrt(D^2 - d^2))]      (F in kgf; D, d in mm)', { mono: true, indent: 6 });
    para('HBW = 0.102 x 2F / [pi D (D - sqrt(D^2 - d^2))]   (F in N)', { mono: true, indent: 6 });
    para('h = [D - sqrt(D^2 - d^2)] / 2', { mono: true, indent: 6 });
    H2('Validity requirements (ISO 6506-1)');
    table(['Requirement', 'Limit'], D.validityRules);
    H1('Standard / Reference Procedure');
    para('Reference standards: ISO 6506-1:2014 Metallic materials — Brinell hardness test — Part 1: Test method; IS 1500 (Part 1):2019; ASTM E10-23.');
    list(D.standardProcedure, true);

    H1('Material Specifications');
    const tested = Object.values(D.materials).filter(m => S.some(s => s.id === m.id));
    table(['Material', 'Grade', 'Composition', 'Density (g/cm³)', 'E (GPa)', 'YS (MPa)', 'UTS (MPa)', 'Typical HBW', 'F/D²'],
      tested.map(m => [m.name, m.grade, m.composition, m.density, m.E, m.ys, m.uts, m.hbRange, m.ratios.join(' or ')]),
      { styles: { fontSize: 7.6, cellPadding: 1.3 } });

    H1('Experimental Procedure (as performed)');
    list([
      'Explored all components of the virtual Brinell tester and reviewed the machine specifications.',
      'Selected the specimen material and sample number, and placed the specimen on the anvil, located by the holder jaws.',
      'Chose the test point on the specimen so that the edge distance satisfied 2.5d, and confirmed the position under the indenter axis.',
      `Installed the ball indenter and set the test force on the load selector (conditions used: ${[...new Set(valid.map(r => `${r.D} mm / ${r.F} kgf`))].join(', ')}).`,
      'Raised the anvil with the hand wheel until the specimen just contacted the ball (contact lamp on).',
      'Applied the test force with the loading lever; the full force was reached in 2 – 8 s.',
      'Maintained the full force for the dwell time shown on the timer, then released it.',
      'Lowered the anvil, removed the specimen and inspected the indentation.',
      'Focused the Brinell microscope, centred the indentation, aligned the hairlines with opposite edges and read d1; rotated the eyepiece 90° and read d2.',
      'Computed d = (d1 + d2)/2 and the Brinell hardness; repeated the procedure for each sample and material.',
    ], true);

    H1('Observations');
    table(['Material', 'S.No', 'D (mm)', 'F (kgf)', 'F/D²', 'Dwell (s)', 'd1 (mm)', 'd2 (mm)', 'd (mm)', 'h (mm)', 'BHN'],
      valid.map(r => [D.materials[r.material].name, r.sample, r.D, r.F, +r.ratio.toFixed(2), r.dwell.toFixed(1), r.m1.toFixed(2), r.m2.toFixed(2), r.d.toFixed(3), r.h.toFixed(3), r.bhn.toFixed(1)]),
      { styles: { fontSize: 8, cellPadding: 1.3, halign: 'center' } });
    const invalid = rec.runs.filter(r => !r.valid);
    if (invalid.length) {
      H2('Rejected (invalid) tests');
      table(['Material', 'S.No', 'D/F', 'd (mm)', 'BHN', 'Reason'],
        invalid.map(r => [D.materials[r.material].name, r.sample, `${r.D}/${r.F}`, r.d.toFixed(3), r.bhn.toFixed(1), r.checks.filter(c => c.level === 'err').map(c => `${c.label}: ${c.detail}`).join('; ')]),
        { styles: { fontSize: 7.6, cellPadding: 1.3 } });
    }

    H1('Calculations');
    for (const s of S) {
      const r = s.runs[0];
      const root = Math.sqrt(r.D * r.D - r.d * r.d);
      H2(`${s.name} — sample ${r.sample}`);
      para(`d = (d1 + d2)/2 = (${r.m1.toFixed(2)} + ${r.m2.toFixed(2)}) / 2 = ${r.d.toFixed(3)} mm`, { mono: true, indent: 4 });
      para(`HB = 2F / [pi D (D - sqrt(D^2 - d^2))] = 2 x ${r.F} / [pi x ${r.D} x (${r.D} - sqrt(${r.D}^2 - ${r.d.toFixed(3)}^2))]`, { mono: true, indent: 4 });
      para(`   = ${(2 * r.F).toFixed(1)} / [${(Math.PI * r.D).toFixed(4)} x (${r.D} - ${root.toFixed(4)})] = ${r.bhn.toFixed(1)} HBW`, { mono: true, indent: 4 });
      para(`h = (D - sqrt(D^2 - d^2))/2 = ${r.h.toFixed(4)} mm;   8h = ${(8 * r.h).toFixed(3)} mm <= ${P.SPEC_T} mm (thickness OK);   d/D = ${(r.d / r.D).toFixed(3)}`, { mono: true, indent: 4 });
    }
    H2('Statistics');
    para('Mean  = (sum of HB_i) / n', { mono: true, indent: 4 });
    para('SD    = sqrt[ sum (HB_i - Mean)^2 / (n - 1) ]', { mono: true, indent: 4 });
    para('CoV % = SD / Mean x 100', { mono: true, indent: 4 });

    H1('Results');
    table(['Material', 'Condition', 'n', 'Avg. BHN', 'SD', 'CoV (%)', 'Range', 'Handbook', 'Deviation', 'Result'],
      S.map(s => [s.name, s.conditions.join(', '), s.n, s.mean.toFixed(1), U.fmt(s.sd, 2), U.fmt(s.cov, 2), `${s.min.toFixed(1)}-${s.max.toFixed(1)}`, s.ref, `${s.dev >= 0 ? '+' : ''}${s.dev.toFixed(1)} %`, P.designation(s.mean, s.runs[0].D, s.runs[0].F, U.mean(s.runs.map(r => r.dwell)))]),
      { styles: { fontSize: 8, cellPadding: 1.3 } });

    H1('Graphs');
    for (const k of SAM.brinell.charts.KINDS) {
      const img = SAM.brinell.charts.toImage(k, valid);
      ensure(98);
      doc.addImage(img, 'JPEG', M, y, CW, CW * 0.52);
      y += CW * 0.52 + 2;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(90, 100, 115);
      doc.splitTextToSize(san(SAM.brinell.charts.NOTES[k]), CW).forEach(l => { doc.text(l, M, y); y += 4; });
      y += 4;
      setBody();
    }

    H1('Discussion'); discussion(S, rec, valid).forEach(p => para(p));
    H1('Conclusion'); para(conclusion(S));
    H1('Precautions'); list(D.precautions);

    H1('Questions / Assessment');
    if (rec.assessment) {
      const a = rec.assessment;
      para(`Score: ${a.score} / ${a.total} (${a.pct} %) — attempt ${a.attempts}, submitted ${new Date(a.at).toLocaleString()}.`, { bold: true });
      table(['#', 'Category', 'Question', 'Response', 'Result'],
        a.answers.map((x, i) => [i + 1, x.cat, x.q, x.given ?? '-', x.correct ? 'Correct' : 'Incorrect']),
        { styles: { fontSize: 7.6, cellPadding: 1.3 }, columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 24 }, 4: { cellWidth: 18 } } });
    } else {
      para('The online assessment has not been attempted yet. Viva questions for self-study:');
      list(SAM.brinell.questions(rec).slice(0, 8).map(q => q.q), true);
    }

    H1('Student Information');
    kv([['Name', prof.name], ['Roll number', prof.roll], ['Programme / branch', prof.branch || '-'], ['Semester', prof.semester || '-'], ['Batch / group', prof.batch || '-'], ['Institution', prof.institution || '-']]);

    H1('Experiment Completion Record');
    const procErr = rec.runs.reduce((s, r) => s + (r.procErrors || 0), 0);
    const recordId = 'BH-' + U.hashStr(`${prof.roll}|${rec.startedAt}|${rec.runs.length}|${rec.assessment?.at || 0}`).toString(16).toUpperCase().padStart(8, '0');
    kv([
      ['Record ID', recordId],
      ['Experiment started', new Date(rec.startedAt).toLocaleString()],
      ['Last activity', new Date(rec.updatedAt || Date.now()).toLocaleString()],
      ['Machine components explored', `${rec.explored.length} / ${D.components.length}`],
      ['Specifications reviewed', rec.specsViewed ? 'Yes' : 'No'],
      ['Tests performed', `${rec.runs.length} (${rec.runs.filter(r => r.valid).length} valid, ${invalid.length} invalid)`],
      ['Samples accepted in results', S.map(s => `${s.name}: ${s.n}`).join(', ')],
      ['Procedural errors flagged during testing', String(procErr)],
      ['Assessment', rec.assessment ? `${rec.assessment.pct} % (attempt ${rec.assessment.attempts})` : 'Not attempted'],
      ['Report generated', new Date().toLocaleString()],
    ]);
    ensure(24);
    y += 6;
    doc.setDrawColor(150); doc.line(M, y + 8, M + 60, y + 8); doc.line(W - M - 60, y + 8, W - M, y + 8);
    doc.setFontSize(8.5); doc.setTextColor(90, 100, 115);
    doc.text('Student signature', M, y + 12); doc.text('Faculty signature', W - M - 60, y + 12);

    // Header / footer on every page
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 128, 140);
      if (i > 1) doc.text(san(`Brinell Hardness Test · ${prof.name} (${prof.roll})`), M, 10);
      doc.text(`Page ${i} of ${n}`, W - M, H - 8, { align: 'right' });
      doc.text(san(`SAM Labs · ${recordId}`), M, H - 8);
    }
    return { doc, recordId };
  }

  function fileName() {
    const s = SAM.store.student();
    return `Brinell_Hardness_Report_${s.profile.roll.replace(/\W+/g, '_')}.pdf`;
  }

  function download() {
    const { doc } = build();
    doc.save(fileName());
  }

  return { build, download, fileName };
})();

SAM.brinell.views.report = function (el, rec) {
  const B = SAM.brinell, U = SAM.util, D = B.data;
  const valid = B.validRuns(rec);
  const S = B.charts.summary(valid);
  const sections = ['Experiment Title', 'Aim', 'Learning Objectives', 'Apparatus / Virtual Machine', 'Machine Specifications', 'Theory', 'Standard / Reference Procedure', 'Material Specifications', 'Experimental Procedure', 'Observations', 'Calculations', 'Results', 'Graphs', 'Discussion', 'Conclusion', 'Precautions', 'Questions / Assessment', 'Student Information', 'Experiment Completion Record'];
  let url = null;

  const checks = [
    [rec.explored.length >= D.components.length, `Machine components explored (${rec.explored.length}/${D.components.length})`],
    [Object.keys(D.materials).every(m => S.some(s => s.id === m)), `All three materials tested (${S.length}/3)`],
    [S.length && S.every(s => s.n >= 5), `At least 5 valid samples per material (${S.map(s => `${s.name} ${s.n}`).join(', ') || 'none'})`],
    [!!rec.assessment, rec.assessment ? `Assessment completed (${rec.assessment.pct}%)` : 'Assessment not yet attempted (can be added later)'],
  ];

  el.innerHTML = `
    <div class="page-grid">
      <div class="card">
        <h2>Generate laboratory report</h2>
        <p class="muted">The report is assembled automatically from your observations, calculations and plots. You can regenerate it at any time — for example after testing more samples or completing the assessment.</p>
        <ul class="ready">${checks.map(([ok, t]) => `<li class="${ok ? 'ok' : 'warn'}">${ok ? '✓' : '!'} ${U.esc(t)}</li>`).join('')}</ul>
        <div class="stack">
          <button class="btn primary block" id="gen">Generate Laboratory Report (PDF)</button>
          <button class="btn block" id="dl" disabled>Download PDF</button>
          <button class="btn block" id="submit" ${rec.report?.generatedAt ? '' : 'disabled'}>${rec.report?.submittedAt ? 'Resubmit report' : 'Submit report'}</button>
        </div>
        <p class="small muted" id="rep-status">${rec.report?.generatedAt ? `Last generated ${U.fmtDate(rec.report.generatedAt)}${rec.report.submittedAt ? ` · submitted ${U.fmtDate(rec.report.submittedAt)}` : ''}` : 'Not generated yet.'}</p>
        <h3>Report structure</h3>
        <ol class="sections">${sections.map(s => `<li>${s}</li>`).join('')}</ol>
      </div>
      <div class="card preview-card">
        <h3>Preview</h3>
        <div id="preview" class="preview-empty">Generate the report to preview it here.</div>
      </div>
    </div>`;

  const $ = s => el.querySelector(s);
  $('#gen').onclick = () => {
    const btn = $('#gen');
    btn.disabled = true; btn.textContent = 'Generating…';
    setTimeout(() => {
      try {
        const { doc, recordId } = B.report.build();
        if (url) URL.revokeObjectURL(url);
        url = doc.output('bloburl');
        $('#preview').className = '';
        $('#preview').innerHTML = `<iframe title="Report preview" src="${url}"></iframe>`;
        $('#dl').disabled = false;
        $('#dl').onclick = () => doc.save(B.report.fileName());
        SAM.store.update('brinell', r => { r.report = { ...(r.report || {}), generatedAt: Date.now(), recordId, versions: (r.report?.versions || 0) + 1 }; });
        $('#submit').disabled = false;
        $('#rep-status').textContent = `Generated ${U.fmtDate(Date.now())} · record ${recordId}`;
        U.toast('Report generated.', 'ok');
      } catch (e) {
        console.error(e);
        U.toast('Report generation failed: ' + e.message, 'err', 6000);
      }
      btn.disabled = false; btn.textContent = 'Regenerate Laboratory Report (PDF)';
    }, 30);
  };
  $('#submit').onclick = () => {
    SAM.store.update('brinell', r => { r.report.submittedAt = Date.now(); });
    $('#rep-status').textContent = `Submitted ${U.fmtDate(Date.now())}`;
    $('#submit').textContent = 'Resubmit report';
    U.toast('Report submitted to your laboratory record.', 'ok');
  };

  return () => { if (url) URL.revokeObjectURL(url); };
};
