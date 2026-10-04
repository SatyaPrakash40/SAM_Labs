// Brinell calculations, indentation simulation and validity checks (ISO 6506-1).
SAM.brinell.physics = (function () {
  const U = SAM.util;
  const SPEC_R = 25;      // specimen radius, mm
  const SPEC_T = 20;      // specimen thickness, mm

  // HB from force F (kgf), ball D (mm), indentation diameter d (mm).
  function bhn(F, D, d) {
    if (!(d > 0 && d < D)) return NaN;
    return (2 * F) / (Math.PI * D * (D - Math.sqrt(D * D - d * d)));
  }

  function depth(D, d) { return (D - Math.sqrt(D * D - d * d)) / 2; }

  // Inverse: indentation diameter produced by a material of hardness HB.
  function diameterFromHB(F, D, HB) {
    const h = F / (Math.PI * D * HB);
    if (h >= D / 2) return D * 0.98;
    return 2 * Math.sqrt(h * (D - h));
  }

  function ratio(F, D) { return F / (D * D); }

  function designation(hb, D, F, dwell) {
    const dw = dwell < 10 || dwell > 15 ? `/${Math.round(dwell)}` : '';
    const f = Number.isInteger(F) ? F : F.toFixed(2).replace(/0+$/, '');
    return `${Math.round(hb)} HBW ${D}/${f}${dw}`;
  }

  // Simulate the physical indentation for one test. Specimen hardness is seeded by
  // student + material + sample so a specimen keeps its "true" hardness on retest.
  function simulate({ studentId, material, sample, D, F, dwell, pos }) {
    const m = SAM.brinell.data.materials[material];
    const rs = U.rng(`${studentId}|${material}|${sample}`);
    const specimenHB = m.hbMean + U.gauss(rs) * m.hbSD;
    const ri = U.rng(`${studentId}|${material}|${sample}|${Date.now()}|${Math.random()}`);
    let hb = specimenHB * (1 + U.gauss(ri) * m.localSD);
    // Longer dwell → more creep under the ball → slightly larger indentation.
    hb = hb / (1 + m.creepK * Math.log(Math.max(dwell, 1) / 12.5));
    let d = diameterFromHB(F, D, hb);
    // Indenting too close to the edge lets material flow outward (lower apparent HB).
    const edge = SPEC_R - Math.hypot(pos.x, pos.y);
    if (edge < 2.5 * d) d = Math.min(D * 0.98, d * (1 + 0.05 * (1 - edge / (2.5 * d))));
    const e = (ri() - 0.5) * 0.014;              // slight ellipticity
    return {
      trueHB: hb,
      d1: d * (1 + e),
      d2: d * (1 - e),
      edge,
      ox: (ri() - 0.5) * 2.6,                     // offset in microscope field, mm
      oy: (ri() - 0.5) * 2.6,
      focus: 30 + ri() * 40,                      // best-focus knob position
      seed: Math.floor(ri() * 1e9),
    };
  }

  // Returns [{level: 'ok'|'warn'|'err', label, detail}] for a measured run.
  function checks(run) {
    const m = SAM.brinell.data.materials[run.material];
    const out = [];
    const dD = run.d / run.D;
    out.push(dD >= 0.24 && dD <= 0.6
      ? { level: 'ok', label: 'd/D ratio', detail: `${dD.toFixed(3)} within 0.24 – 0.60` }
      : { level: 'err', label: 'd/D ratio', detail: `${dD.toFixed(3)} outside 0.24 – 0.60 — choose a ${dD > 0.6 ? 'lower' : 'higher'} test force` });
    const r = ratio(run.F, run.D);
    out.push(m.ratios.some(x => Math.abs(x - r) < 0.01)
      ? { level: 'ok', label: 'Force–diameter ratio', detail: `F/D² = ${U.fmt(r, 1)} (recommended for ${m.name})` }
      : { level: 'warn', label: 'Force–diameter ratio', detail: `F/D² = ${U.fmt(r, 2)}; recommended ${m.ratios.join(' or ')} for ${m.name}` });
    out.push(run.dwell < 10
      ? { level: 'err', label: 'Dwell time', detail: `${run.dwell.toFixed(1)} s — shorter than the 10 s minimum` }
      : run.dwell > 15
        ? { level: 'warn', label: 'Dwell time', detail: `${run.dwell.toFixed(1)} s — longer than 15 s; dwell must be stated in the designation` }
        : { level: 'ok', label: 'Dwell time', detail: `${run.dwell.toFixed(1)} s within 10 – 15 s` });
    out.push(run.edge >= 2.5 * run.d
      ? { level: 'ok', label: 'Edge distance', detail: `${run.edge.toFixed(1)} mm ≥ 2.5d = ${(2.5 * run.d).toFixed(1)} mm` }
      : { level: 'err', label: 'Edge distance', detail: `${run.edge.toFixed(1)} mm < 2.5d = ${(2.5 * run.d).toFixed(1)} mm — indentation too close to edge` });
    const h = depth(run.D, run.d);
    out.push(SPEC_T >= 8 * h
      ? { level: 'ok', label: 'Specimen thickness', detail: `${SPEC_T} mm ≥ 8h = ${(8 * h).toFixed(2)} mm` }
      : { level: 'err', label: 'Specimen thickness', detail: `${SPEC_T} mm < 8h = ${(8 * h).toFixed(2)} mm` });
    out.push(run.loadTime >= 2 && run.loadTime <= 8
      ? { level: 'ok', label: 'Force application time', detail: `${run.loadTime.toFixed(1)} s within 2 – 8 s` }
      : { level: 'warn', label: 'Force application time', detail: `${run.loadTime.toFixed(1)} s` });
    return out;
  }

  return { bhn, depth, diameterFromHB, ratio, designation, simulate, checks, SPEC_R, SPEC_T };
})();
