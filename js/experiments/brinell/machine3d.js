// Procedural 3D model of the Brinell tester. Scene unit = 10 mm.
// Parts are tagged with a component id (see data.components) for picking/highlighting.
// The test controller drives the model through `machine.state`; the render loop
// eases the visible mechanism toward that state.
SAM.brinell.Machine3D = class Machine3D {
  constructor(container, { onPick, onHover } = {}) {
    this.container = container;
    this.onPick = onPick;
    this.onHover = onHover;
    this.parts = {};
    this.state = {
      specimen: null,          // material id or null
      indentD: null,           // indentation diameter on specimen (mm) or null
      pos: { x: 0, y: 0 },     // test point offset on specimen (mm)
      anvilTopMm: 530,         // height of anvil top surface (mm)
      indenterD: null,         // installed ball diameter (mm)
      selectedLoad: null,      // kgf, drives knob + weights
      load: 0,                 // currently applied force (kgf), drives needle
      lever: 0,                // 0 = up, 1 = applied
      timerText: '--.-',
      highlight: null,
      isolate: false,
    };
    this._a = { anvil: 530, lever: 0, needle: 0, knob: 0, float: 0 };
    this._fly = null;

    const w = container.clientWidth || 800, h = container.clientHeight || 500;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9eef4);
    this.camera = new THREE.PerspectiveCamera(38, w / h, 1, 2000);
    this.camera.position.set(92, 96, 128);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(9, 44, 3);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 280;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.home = { pos: this.camera.position.clone(), target: this.controls.target.clone() };

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(60, 140, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 120, bottom: -40, near: 10, far: 400 });
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(-80, 60, -40);
    this.scene.add(fill);

    this._build();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._hovered = null;
    this._down = null;
    const el = this.renderer.domElement;
    this._onMove = e => this._handleMove(e);
    this._onDown = e => { this._down = { x: e.clientX, y: e.clientY }; };
    this._onUp = e => {
      if (this._down && Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y) < 5) this._handleClick(e);
      this._down = null;
    };
    this._onLeave = () => { this._setHover(null); if (this.onHover) this.onHover(null); };
    el.addEventListener('pointermove', this._onMove);
    el.addEventListener('pointerdown', this._onDown);
    el.addEventListener('pointerup', this._onUp);
    el.addEventListener('pointerleave', this._onLeave);

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this._clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---------- construction ----------
  _mat(color, { metal = 0.2, rough = 0.55, map = null } = {}) {
    return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, map });
  }

  _add(part, mesh, parent = this.scene) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (part) {
      mesh.userData.part = part;
      (this.parts[part] = this.parts[part] || []).push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  _box(part, w, h, d, color, x, y, z, opts, parent) {
    const m = this._add(part, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(color, opts)), parent);
    m.position.set(x, y, z);
    return m;
  }

  _cyl(part, rt, rb, h, color, x, y, z, opts, parent, seg = 40) {
    const m = this._add(part, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), this._mat(color, opts)), parent);
    m.position.set(x, y, z);
    return m;
  }

  _canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return { tex: t, canvas: c };
  }

  _build() {
    const PAINT = 0x2f5d8a, PAINT_DARK = 0x234766, STEEL = 0xb9c0c8, DARK = 0x2b3038, CHROME = 0xdde3ea;
    const AX = 10; // indenter axis z position (x = 0)

    // Bench (context only, not a component)
    const bench = new THREE.Mesh(new THREE.BoxGeometry(170, 3, 80), this._mat(0xcdb99a, { rough: 0.9, metal: 0 }));
    bench.position.set(12, -1.5, 0);
    bench.receiveShadow = true;
    this.scene.add(bench);

    // Frame: base + column
    this._box('frame', 46, 8, 36, PAINT_DARK, 0, 4, 0);
    this._box('frame', 16, 62, 16, PAINT, 0, 39, -10);
    for (const [x, z] of [[-20, -15], [20, -15], [-20, 15], [20, 15]]) this._cyl('frame', 1.4, 1.6, 1, DARK, x, -0.2, z);

    // Loading head (houses the hydraulic ram) + rear dead-weight bracket
    this._box('loading', 22, 18, 38, PAINT, 0, 79, -2);
    this._box('loading', 23, 1.2, 39, PAINT_DARK, 0, 88.4, -2);
    this._box('loading', 10, 4, 8, PAINT_DARK, 0, 84, -24);
    this.hanger = new THREE.Group();
    this.scene.add(this.hanger);
    this._cyl('loading', 0.35, 0.35, 42, CHROME, 0, 63, -26, { metal: 0.8, rough: 0.25 }, this.hanger);
    this._cyl('loading', 4.4, 4.4, 0.6, DARK, 0, 41.7, -26, { metal: 0.5 }, this.hanger);
    this.weights = [];
    for (let i = 0; i < 6; i++) {
      const wgt = this._cyl('loading', 4, 4, 1.6, i % 2 ? 0x3c434d : 0x4a525d, 0, 42.9 + i * 1.75, -26, { metal: 0.5, rough: 0.4 }, this.hanger);
      this.weights.push(wgt);
    }

    // Name plate
    const plate = this._canvasTex(512, 80, (g, w, h) => {
      g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8eef5'; g.font = 'bold 34px Arial'; g.textBaseline = 'middle';
      g.fillText('SAM-BH3000', 18, h / 2);
      const x2 = 18 + g.measureText('SAM-BH3000').width + 18;
      g.font = '20px Arial'; g.fillStyle = '#9fb6cc';
      g.fillText('BRINELL HARDNESS TESTER', x2, h / 2, w - x2 - 14);
    });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.5), new THREE.MeshBasicMaterial({ map: plate.tex }));
    pm.position.set(0, 86, 17.02);
    this._add('loading', pm);

    // Load indicator dial
    this.dial = new THREE.Group();
    this.dial.position.set(0, 78.5, 17);
    this.scene.add(this.dial);
    const bezel = this._cyl('loadIndicator', 4.8, 4.8, 0.8, CHROME, 0, 0, 0.3, { metal: 0.85, rough: 0.25 }, this.dial);
    bezel.rotation.x = Math.PI / 2;
    const face = this._canvasTex(512, 512, (g, w) => this._drawDial(g, w));
    const faceMesh = new THREE.Mesh(new THREE.CircleGeometry(4.3, 48), new THREE.MeshBasicMaterial({ map: face.tex }));
    faceMesh.position.z = 0.72;
    this._add('loadIndicator', faceMesh, this.dial);
    this.needle = new THREE.Group();
    this.needle.position.z = 0.8;
    this.dial.add(this.needle);
    const ng = new THREE.BoxGeometry(0.22, 3.6, 0.08);
    ng.translate(0, 1.5, 0);
    this._add('loadIndicator', new THREE.Mesh(ng, this._mat(0xd23b2f, { rough: 0.4 })), this.needle);
    this._cyl('loadIndicator', 0.35, 0.35, 0.2, DARK, 0, 0, 0.05, {}, this.needle).rotation.x = Math.PI / 2;

    // Load selection knob (right side of head)
    this.knob = new THREE.Group();
    this.knob.position.set(11, 82, 4);
    this.scene.add(this.knob);
    const kb = this._cyl('loadSelector', 2.4, 2.6, 1.4, DARK, 0.7, 0, 0, { rough: 0.35 }, this.knob);
    kb.rotation.z = Math.PI / 2;
    this._box('loadSelector', 0.3, 2.2, 0.5, 0xf2f2f2, 1.45, 1.0, 0, {}, this.knob);
    const scale = this._canvasTex(256, 256, (g, w) => {
      g.fillStyle = '#d8dee6'; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b3038'; g.lineWidth = 6;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * 0.75 + i * (Math.PI * 1.5 / 9);
        g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * 96, w / 2 - Math.cos(a) * 96); g.lineTo(w / 2 + Math.sin(a) * 124, w / 2 - Math.cos(a) * 124); g.stroke();
      }
    });
    const sm = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), new THREE.MeshBasicMaterial({ map: scale.tex }));
    sm.position.set(11.02, 82, 4);
    sm.rotation.y = Math.PI / 2;
    this._add('loadSelector', sm);

    // Loading lever (applies / releases the force)
    this.lever = new THREE.Group();
    this.lever.position.set(11.4, 75, 10);
    this.scene.add(this.lever);
    const hub = this._cyl('loading', 1.1, 1.1, 1.6, DARK, 0.6, 0, 0, {}, this.lever);
    hub.rotation.z = Math.PI / 2;
    const rod = this._cyl('loading', 0.35, 0.35, 9, CHROME, 1.0, 0, 4.5, { metal: 0.85, rough: 0.2 }, this.lever);
    rod.rotation.x = Math.PI / 2;
    this._add('loading', new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), this._mat(0xc0392b, { rough: 0.35 })), this.lever).position.set(1.0, 0, 9.4);

    // Indenter holder + chuck + ball
    this._cyl('indenter', 1.3, 1.3, 6, CHROME, 0, 67, AX, { metal: 0.9, rough: 0.2 });
    this._cyl('indenter', 1.3, 0.7, 1.6, CHROME, 0, 63.2, AX, { metal: 0.9, rough: 0.2 });
    this.ball = this._add('indenter', new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), this._mat(0x5c636d, { metal: 0.9, rough: 0.15 })));
    this.ball.position.set(0, 62.4, AX);
    this.ball.visible = false;

    // Elevating screw, nut housing, hand wheel
    this._cyl('handwheel', 3.4, 3.8, 6, PAINT_DARK, 0, 11, AX);
    this.screw = this._cyl('handwheel', 1.4, 1.4, 1, CHROME, 0, 0, AX, { metal: 0.85, rough: 0.3 }, this.scene, 24);
    this.wheel = new THREE.Group();
    this.wheel.position.set(0, 17.5, AX);
    this.scene.add(this.wheel);
    const rim = this._add('handwheel', new THREE.Mesh(new THREE.TorusGeometry(7, 0.55, 14, 64), this._mat(0x9aa3ad, { metal: 0.8, rough: 0.3 })), this.wheel);
    rim.rotation.x = Math.PI / 2;
    this._cyl('handwheel', 1.9, 1.9, 1.6, 0x9aa3ad, 0, 0, 0, { metal: 0.8, rough: 0.3 }, this.wheel);
    for (let i = 0; i < 3; i++) {
      const sp = this._box('handwheel', 6, 0.5, 0.7, 0x9aa3ad, 0, 0, 0, { metal: 0.8, rough: 0.3 }, this.wheel);
      const a = i * (Math.PI * 2 / 3);
      sp.position.set(Math.cos(a) * 4.2, 0, Math.sin(a) * 4.2);
      sp.rotation.y = -a;
    }
    this._cyl('handwheel', 0.5, 0.5, 3.4, DARK, 7, 1.7, 0, {}, this.wheel);

    // Anvil + specimen holder jaws + specimen (moved together)
    this.carriage = new THREE.Group();
    this.carriage.position.set(0, 0, AX);
    this.scene.add(this.carriage);
    this._cyl('anvil', 4, 4.2, 1.6, 0x8d959f, 0, -0.8, 0, { metal: 0.85, rough: 0.25 }, this.carriage);
    this.jaws = [
      this._box('holder', 1.0, 1.4, 3.2, 0x40464f, -3.25, 0.7, 0, { metal: 0.4 }, this.carriage),
      this._box('holder', 1.0, 1.4, 3.2, 0x40464f, 3.25, 0.7, 0, { metal: 0.4 }, this.carriage),
    ];
    this.specimen = this._cyl('specimen', 2.5, 2.5, 2, 0xb0b0b0, 0, 1, 0, { metal: 0.85, rough: 0.3 }, this.carriage, 48);
    this.specimen.visible = false;
    this.indentMark = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.3, metalness: 0.6 }));
    this.indentMark.rotation.x = -Math.PI / 2;
    this.indentMark.position.y = 1.012;
    this.indentMark.visible = false;
    this.specimen.add(this.indentMark);

    // Control panel + dwell timer display
    this._box('controlPanel', 12, 6, 5, 0x3a414b, 13.5, 11, 14.5, { rough: 0.5 });
    this.timerTex = this._canvasTex(256, 96, (g, w, h) => this._drawTimer(g, w, h, '--.-'));
    const tm = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.0), new THREE.MeshBasicMaterial({ map: this.timerTex.tex }));
    tm.position.set(12.6, 12, 17.02);
    this._add('controlPanel', tm);
    const g1 = this._cyl('controlPanel', 0.7, 0.7, 0.6, 0x23a55a, 16.6, 12.6, 17.2, { rough: 0.3 });
    g1.rotation.x = Math.PI / 2;
    const r1 = this._cyl('controlPanel', 0.7, 0.7, 0.6, 0xd23b2f, 16.6, 10.3, 17.2, { rough: 0.3 });
    r1.rotation.x = Math.PI / 2;
    this._cyl('controlPanel', 1.1, 0.8, 0.9, 0xd23b2f, 17.5, 14.4, 15.5, { rough: 0.3 });
    this.contactLamp = this._add('controlPanel', new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0x334, emissive: 0x000000 })));
    this.contactLamp.position.set(9.0, 12.6, 17.1);

    // Brinell microscope (on the bench, beside the machine)
    const MX = 36, MZ = 10;
    this._cyl('microscope', 3.6, 3.8, 0.8, DARK, MX, 0.4, MZ);
    this._cyl('microscope', 2.2, 2.6, 2.2, 0x50575f, MX, 1.9, MZ);
    const tube = this._cyl('microscope', 1.1, 1.2, 9, 0x2d3239, MX, 7.4, MZ, { rough: 0.4 });
    tube.rotation.z = 0.08;
    this._cyl('microscope', 0.85, 0.85, 3, 0x1b1e22, MX - 0.55, 13.3, MZ, { rough: 0.4 }).rotation.z = 0.08;
    this._cyl('microscope', 1.5, 1.5, 0.9, 0x9aa3ad, MX + 0.25, 4.2, MZ, { metal: 0.7 }).rotation.z = 0.08;
    this._box('microscope', 1.4, 1.4, 2.6, 0xe0e4e8, MX + 2.8, 2.3, MZ, { rough: 0.6 });

    // Visible gap ruler is handled by the HUD; set initial positions.
    this._applyAnimated(true);
  }

  _drawDial(g, w) {
    const c = w / 2;
    g.fillStyle = '#fbfbf7'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1b1e22'; g.fillStyle = '#1b1e22';
    for (let v = 0; v <= 3000; v += 100) {
      const a = (-135 + 270 * v / 3000) * Math.PI / 180;
      const major = v % 500 === 0;
      const r1 = major ? c * 0.72 : c * 0.8, r2 = c * 0.88;
      g.lineWidth = major ? 6 : 3;
      g.beginPath(); g.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); g.lineTo(c + Math.sin(a) * r2, c - Math.cos(a) * r2); g.stroke();
      if (major) {
        g.font = 'bold 34px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(v), c + Math.sin(a) * c * 0.56, c - Math.cos(a) * c * 0.56);
      }
    }
    g.font = 'bold 30px Inter, Arial'; g.fillStyle = '#2f5d8a'; g.fillText('kgf', c, c + c * 0.42);
    g.font = '20px Inter, Arial'; g.fillStyle = '#666'; g.fillText('LOAD', c, c + c * 0.6);
  }

  _drawTimer(g, w, h, text) {
    g.fillStyle = '#0c1a12'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4dff9a'; g.font = 'bold 60px "JetBrains Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  }

  // ---------- picking ----------
  _pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const k in this.parts) for (const m of this.parts[k]) if (m.visible && this._visibleInTree(m)) meshes.push(m);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.part : null;
  }

  _visibleInTree(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

  _handleMove(e) {
    const p = this._pick(e);
    this._setHover(p);
    this.renderer.domElement.style.cursor = p ? 'pointer' : 'grab';
    if (this.onHover) this.onHover(p, e);
  }

  _handleClick(e) {
    const p = this._pick(e);
    if (p && this.onPick) this.onPick(p, e);
  }

  _setHover(p) { this._hovered = p; this._refreshMaterials(); }

  _refreshMaterials() {
    for (const k in this.parts) {
      const hl = k === this.state.highlight, hv = k === this._hovered;
      const dim = this.state.isolate && this.state.highlight && !hl;
      for (const m of this.parts[k]) {
        const mat = m.material;
        if (mat.emissive) mat.emissive.setHex(hl ? 0x1d4ed8 : hv ? 0x0b3a8a : 0x000000);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = hl ? 0.45 : hv ? 0.3 : 1;
        mat.transparent = dim;
        mat.opacity = dim ? 0.12 : 1;
        mat.depthWrite = !dim;
      }
    }
    if (this.contactLamp) this.contactLamp.material.emissive.setHex(this._contact ? 0x22dd66 : 0x000000);
  }

  // ---------- public API ----------
  setHighlight(id) { this.state.highlight = id; this._refreshMaterials(); }
  setIsolate(on) { this.state.isolate = on; this._refreshMaterials(); }
  setContact(on) { this._contact = on; this.contactLamp.material.emissive.setHex(on ? 0x22dd66 : 0x000000); }

  focus(id) {
    const meshes = this.parts[id];
    if (!meshes || !meshes.length) return;
    const box = new THREE.Box3();
    meshes.forEach(m => box.expandByObject(m));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = Math.max(22, size * 1.9 + 10);
    this._fly = { t: 0, fromPos: this.camera.position.clone(), fromTgt: this.controls.target.clone(), toPos: center.clone().add(dir.multiplyScalar(dist)), toTgt: center };
  }

  resetView() {
    this._fly = { t: 0, fromPos: this.camera.position.clone(), fromTgt: this.controls.target.clone(), toPos: this.home.pos.clone(), toTgt: this.home.target.clone() };
  }

  viewTestArea() {
    this._fly = { t: 0, fromPos: this.camera.position.clone(), fromTgt: this.controls.target.clone(), toPos: new THREE.Vector3(58, 80, 100), toTgt: new THREE.Vector3(3, 60, 6) };
  }

  // ---------- animation ----------
  _applyAnimated(snap) {
    const s = this.state, a = this._a;
    const k = snap ? 1 : 0.18;
    a.anvil += (s.anvilTopMm - a.anvil) * (snap ? 1 : 0.35);
    a.lever += (s.lever - a.lever) * k;
    a.needle += (s.load / 3000 - a.needle) * (snap ? 1 : 0.25);
    const li = Math.max(0, SAM.brinell.data.loads.indexOf(s.selectedLoad));
    a.knob += ((s.selectedLoad ? li : 0) - a.knob) * k;
    a.float += ((s.load > 0 ? 1 : 0) - a.float) * 0.08;

    const top = a.anvil / 10;
    this.carriage.position.y = top;
    const screwBottom = 8, screwTop = top - 1.6;
    this.screw.scale.y = Math.max(0.1, screwTop - screwBottom);
    this.screw.position.y = (screwTop + screwBottom) / 2;
    this.wheel.rotation.y = -a.anvil * 0.06;
    this.lever.rotation.x = a.lever * 0.75;
    this.needle.rotation.z = -(-135 + 270 * a.needle) * Math.PI / 180;
    this.knob.rotation.x = -0.75 * Math.PI + a.knob * (Math.PI * 1.5 / 9);
    this.hanger.position.y = a.float * 0.6;

    const nW = s.selectedLoad ? Math.min(6, Math.max(1, Math.ceil(6 * s.selectedLoad / 3000))) : 0;
    this.weights.forEach((w, i) => { w.visible = i < nW; });

    this.ball.visible = !!s.indenterD;
    if (s.indenterD) {
      const r = s.indenterD / 20;
      this.ball.scale.setScalar(r);
      this.ball.position.y = 62.4 - r;
    }

    this.specimen.visible = !!s.specimen;
    this.jaws.forEach(j => { j.visible = !!s.specimen; });
    if (s.specimen) {
      const m = SAM.brinell.data.materials[s.specimen];
      if (this._specColor !== m.color) { this.specimen.material.color.set(m.color); this._specColor = m.color; }
      this.specimen.position.x = -s.pos.x / 10;
      this.specimen.position.z = s.pos.y / 10;
      if (s.indentD) {
        this.indentMark.visible = true;
        this.indentMark.scale.setScalar(s.indentD / 20);
        this.indentMark.position.x = s.pos.x / 10;
        this.indentMark.position.z = -s.pos.y / 10;
      } else this.indentMark.visible = false;
    }

    if (this._timerShown !== s.timerText) {
      this._timerShown = s.timerText;
      const g = this.timerTex.canvas.getContext('2d');
      this._drawTimer(g, this.timerTex.canvas.width, this.timerTex.canvas.height, s.timerText);
      this.timerTex.tex.needsUpdate = true;
    }
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this._clock.getDelta());
    if (this._fly) {
      const f = this._fly;
      f.t = Math.min(1, f.t + dt / 0.7);
      const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
      this.camera.position.lerpVectors(f.fromPos, f.toPos, e);
      this.controls.target.lerpVectors(f.fromTgt, f.toTgt, e);
      if (f.t >= 1) this._fly = null;
    }
    this._applyAnimated(false);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this._onMove);
    el.removeEventListener('pointerdown', this._onDown);
    el.removeEventListener('pointerup', this._onUp);
    el.removeEventListener('pointerleave', this._onLeave);
    this.controls.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    this.renderer.dispose();
    el.remove();
  }
};
