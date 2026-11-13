import * as THREE from 'three';
import { InductionField } from './induction-field.js';
import { FIELD_LINES as LINES, FIELD_STEPS as STEPS } from './field-lines.js';

const TAU = Math.PI * 2;

export function createInductionFieldView(parent) {
  const model = new InductionField();
  const group = new THREE.Group(); parent.add(group); group.visible = false;
  function lineOverlay() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(LINES * STEPS * 4 * 3), colors = new Float32Array(positions.length);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .85 }));
    lines.frustumCulled = false; group.add(lines);
    const arrows = [];
    for (let i = 0; i < LINES; i++) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), .16, 0xd8f88a, .07, .04);
      group.add(arrow); arrows.push(arrow);
    }
    return { geometry, positions, colors, lines, arrows };
  }
  const magneticLines = lineOverlay(), electricLines = lineOverlay();
  const currents = [], forces = [];
  for (let i = 0; i < 22; i++) {
    for (const [list, color] of [[currents, 0x6edbff], [forces, 0xffd16e]]) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), .4, color, .1, .06);
      group.add(arrow); list.push(arrow);
    }
  }
  const planeGeometry = new THREE.PlaneGeometry(4.8, 4, 36, 30);
  planeGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(planeGeometry.attributes.position.count * 3), 3));
  const plane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .5, depthWrite: false }));
  group.add(plane);
  const color = new THREE.Color(), vector = new THREE.Vector3(), b = new Float64Array(3);
  let last = -Infinity, previous = '', requested = '', config = '', version = 0;
  let worker, busy = false, ready = false, spare = null, spareElectric = null, failure = '';

  function startWorker() {
    try {
      worker = new Worker(new URL('./induction-field-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        busy = false;
        // A changed winding or option must not briefly show the old configuration.
        if (data.config !== config) { spare = data.grid.buffer; spareElectric = data.electric.buffer; return; }
        spare = model.grid.buffer;
        spareElectric = model.electric.buffer;
        model.grid = data.grid;
        model.electric = data.electric;
        model.material = data.material;
        model.traces = data.traces;
        model.state = data.state;
        model.lag = data.lag;
        model.rotorAmplitude = data.rotorAmplitude;
        ready = true; version++;
      };
      worker.onerror = event => {
        event.preventDefault();
        failure = 'Feldberechnung nicht verfügbar. Lehrmodus bleibt nutzbar.';
        ready = busy = false;
        worker.terminate();
      };
    } catch {
      failure = 'Feldberechnung nicht verfügbar. Lehrmodus bleibt nutzbar.';
    }
  }

  function fieldColor(strength) {
    // Fixed relative scale: changing load or connection does not renormalize the colors.
    return color.setHSL(.64 - .62 * Math.min(1, Math.log1p(strength) / Math.log(5)), .8, .56);
  }

  startWorker();

  return {
    model,
    get ready() { return ready; },
    get error() { return failure; },
    update(state, options, settings, now) {
      group.visible = false;
      if (!settings.enabled || state.explode !== 0 || failure) return;
      options = { ...options, magneticLines: settings.lines && settings.magnetic };
      const nextConfig = JSON.stringify(options);
      if (nextConfig !== config) { config = nextConfig; ready = false; requested = ''; }
      if (!worker) startWorker();
      if (failure) return;
      const request = JSON.stringify([state, options]);
      // Only one job in flight: subsequent frames submit the latest state, never a backlog.
      if (!busy && request !== requested && now - last >= 1000 / 30 - .5) {
        busy = true; last = now; requested = request;
        worker.postMessage({ state, options, config, buffer: spare, electricBuffer: spareElectric }, [spare, spareElectric].filter(Boolean));
        spare = spareElectric = null;
      }
      if (!ready) return;
      group.visible = true;
      const key = JSON.stringify([version, settings]);
      if (key === previous) return;
      previous = key;
      state = model.state;
      for (const isElectric of [false, true]) {
        const { geometry, positions, colors, lines, arrows } = isElectric ? electricLines : magneticLines;
        const enabled = isElectric ? settings.electric : settings.lines && settings.magnetic;
        const trace = model.traces[isElectric ? 1 : 0];
        positions.set(trace.positions); colors.set(trace.colors);
        for (let i = 0; i < LINES; i++) {
          const p = i * 7, strength = trace.arrows[p + 6];
          arrows[i].visible = enabled && strength > 0;
          if (!arrows[i].visible) continue;
          arrows[i].position.fromArray(trace.arrows, p);
          arrows[i].setDirection(vector.fromArray(trace.arrows, p + 3));
          arrows[i].setColor(isElectric ? color.setHex(0xd8a0ff) : fieldColor(strength));
        }
        geometry.setDrawRange(0, trace.count); geometry.attributes.position.needsUpdate = geometry.attributes.color.needsUpdate = true;
        lines.visible = enabled;
      }
      for (let i = 0; i < 22; i++) {
        const angle = i * TAU / 22 + state.rotorAngle;
        const x = 1.005 * Math.cos(angle), y = 1.005 * Math.sin(angle), current = model.rotorCurrent(angle);
        const a = currents[i]; a.visible = settings.currents && Math.abs(current) > .005;
        a.position.set(x, y, -.45 * Math.sign(current)); a.setDirection(vector.set(0, 0, Math.sign(current) || 1));
        a.setLength(Math.max(.02, Math.abs(current)), .1, .06);
        model.sample(x, y, 0, b);
        vector.set(-current * b[1], current * b[0], 0);
        const length = vector.length(), f = forces[i]; f.visible = settings.forces && length > .005;
        f.position.set(x, y, 1.14); f.setDirection(length > 1e-9 ? vector.divideScalar(length) : vector.set(1, 0, 0));
        f.setLength(Math.max(.02, Math.min(1.2, length)), .1, .06);
      }
      plane.visible = settings.slice !== 'off' && settings.magnetic;
      const vertices = planeGeometry.attributes.position, pc = planeGeometry.attributes.color;
      plane.rotation.x = settings.slice === 'xz' ? Math.PI / 2 : 0;
      for (let i = 0; i < vertices.count && plane.visible; i++) {
        model.sample(vertices.getX(i), settings.slice === 'xz' ? 0 : vertices.getY(i), settings.slice === 'xz' ? vertices.getY(i) : 0, b);
        fieldColor(Math.hypot(...b)); pc.setXYZ(i, color.r, color.g, color.b);
      }
      pc.needsUpdate = true;
    },
  };
}
