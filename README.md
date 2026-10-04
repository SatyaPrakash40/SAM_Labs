# SAM_Labs

**Virtual Mechanical Engineering Laboratory**: a browser platform that reproduces the complete B.Tech lab workflow, not just a simulation:

**Explore → Understand → Operate → Measure → Calculate → Analyse → Plot → Report → Assess**

The first complete experiment (MVP) is the **Brinell Hardness Test** (ISO 6506-1 / IS 1500-1 / ASTM E10).

## Running it

It is a static site with no build step and no dependencies to install. Libraries load from CDNs, so an internet connection is required.

```bash
node tools/serve.js 8080
```

Then open http://localhost:8080. It can also be hosted as-is on GitHub Pages or any static web server.

## Brinell Hardness Test — what the student does

| Stage | What happens |
| --- | --- |
| 1. Explore Machine | Interactive 3D tester (rotate / zoom / pan). Clicking any of 10 components shows its function, specifications, working principle, parameters and safety precautions. All 10 must be opened to continue. |
| 2. Specifications | Machine specifications, F/D² table (ISO 6506-1 Table 3), test-force table, validity rules, theory. |
| 3. Select Specimen | Brass (CW614N), aluminium (6063-T6) or mild steel (AISI 1018), with material data. The sample matrix tracks up to 10 samples per material. |
| 4. Perform Test | The student operates every control: place specimen → choose test point → install ball → select load → raise anvil to contact with the hand wheel → apply load → hold dwell (live timer) → release → lower → remove. Wrong operations are blocked or flagged with feedback. |
| 5. Microscope | Virtual Brinell microscope with magnification, focus, illumination, stage X/Y, eyepiece rotation and draggable hairlines with a 0.01 mm micrometer. The student measures d₁ and d₂ at 90°. |
| 6. Results & Plots | Observation table, mean / SD / CoV / range, deviation from handbook values, five interactive charts, CSV export. |
| 7. Lab Report | One-click PDF with all 19 sections (aim → theory → observations → calculations → graphs → discussion → completion record), plus submission. |
| 8. Assessment | Auto-graded MCQ, numerical, procedure, component and experimental-error questions, including one built from the student's own data. |

The **dashboard** shows every experiment with its status, score and report download.

### Realism

- Each specimen has a seeded "true" hardness, and every indentation adds local scatter, slight ellipticity, an irregular edge, dwell-time creep and an edge-distance effect.
- Readings come from the student's own hairline alignment, so repeated measurements differ just as they do in a physical lab.
- Each run is checked for d/D (0.24–0.6), edge distance (≥ 2.5d), thickness (≥ 8h), dwell (10–15 s), F/D² and force-application time. Invalid runs are kept but excluded from the statistics.

## Project structure

```
index.html                     App shell and script loading
css/styles.css
js/core/                       Platform: util, store (localStorage), router, catalog, app (dashboard)
js/experiments/brinell/
  data.js                      Machine, components, materials, theory, procedure
  physics.js                   BHN equations, indentation simulation, ISO validity checks
  machine3d.js                 Procedural Three.js machine with pickable components
  shell.js                     Stage stepper and gating
  explore.js specs.js specimen.js test.js microscope.js analysis.js report.js assessment.js
  charts.js                    Statistics and Chart.js configs (shared by page and PDF)
tools/serve.js                 Local static server
```

### Adding an experiment

1. Add it to `js/core/catalog.js` with `available: true`.
2. Create `js/experiments/<id>/` following the Brinell module: data, physics, 3D model, and stage views.
3. Register its route in `js/core/app.js`.

## Current limitations

- Student records are stored in the browser's `localStorage`, keyed by roll number. They live on one device only, with no server, login or instructor view yet.
- The 3D machine is built procedurally. A CAD/GLB model of a specific lab machine can replace it later while keeping the same component ids.
