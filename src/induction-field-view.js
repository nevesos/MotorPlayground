import * as THREE from 'three';
import { InductionField } from './induction-field.js';

const TAU = Math.PI * 2, LINES = 24, STEPS = 95;

export function createInductionFieldView(parent) {
  const model = new InductionField();
  const group = new THREE.Group(); parent.add(group); group.visible = false;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(LINES * STEPS * 4 * 3), colors = new Float32Array(positions.length);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .85 }));
  lines.frustumCulled = false; group.add(lines);
  const arrows = [], currents = [], forces = [];
  for (let i = 0; i < LINES; i++) {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), .16, 0xd8f88a, .07, .04);
    group.add(arrow); arrows.push(arrow);
  }
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
  const color = new THREE.Color(), vector = new THREE.Vector3(), b = new Float64Array(3), mid = new Float64Array(3);
  let last = -Infinity, previous = '';

  function fieldColor(strength) {
    // Fixed relative scale: changing load or connection does not renormalize the colors.
    return color.setHSL(.64 - .62 * Math.min(1, Math.log1p(strength) / Math.log(5)), .8, .56);
  }

  return {
    model,
    update(state, options, settings, now) {
      group.visible = settings.enabled && state.explode === 0;
      if (!settings.enabled) return;
      const key = JSON.stringify([state, options, settings]);
      if (key === previous || (now - last < 100 && previous !== '')) return;
      last = now; previous = key;
      model.configure(options); model.update(state);
      let count = 0;
      for (let i = 0; i < LINES; i++) {
        const angle = i % 8 * TAU / 8 + state.phase, radius = .45 + (i % 2) * .35;
        const seed = [radius * Math.cos(angle), radius * Math.sin(angle), (Math.floor(i / 8) - 1) * .72];
        model.sample(...seed, b);
        const strength = Math.hypot(...b);
        arrows[i].visible = strength > .015;
        arrows[i].position.set(...seed);
        arrows[i].setDirection(vector.set(...b).normalize());
        arrows[i].setColor(fieldColor(strength));
        for (const sign of [-1, 1]) {
          let [x, y, z] = seed;
          for (let step = 0; step < STEPS; step++) {
            model.sample(x, y, z, b);
            const length = Math.hypot(...b);
            if (length < .015) break;
            const h = sign * .065 / length;
            model.sample(x + b[0] * h / 2, y + b[1] * h / 2, z + b[2] * h / 2, mid);
            const m = Math.hypot(...mid);
            if (m < .015) break;
            const nx = x + sign * .065 * mid[0] / m, ny = y + sign * .065 * mid[1] / m, nz = z + sign * .065 * mid[2] / m;
            if (Math.abs(nx) > 2.5 || Math.abs(ny) > 2.5 || Math.abs(nz) > 2) break;
            positions.set([x, y, z, nx, ny, nz], count * 3);
            fieldColor(length);
            for (let end = 0; end < 2; end++) colors.set([color.r, color.g, color.b], (count + end) * 3);
            count += 2; x = nx; y = ny; z = nz;
            if (step > 20 && Math.hypot(x - seed[0], y - seed[1], z - seed[2]) < .07) break;
          }
        }
      }
      geometry.setDrawRange(0, count); geometry.attributes.position.needsUpdate = geometry.attributes.color.needsUpdate = true;
      lines.visible = settings.lines && settings.magnetic;
      for (const arrow of arrows) arrow.visible = arrow.visible && settings.lines && settings.magnetic;
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
