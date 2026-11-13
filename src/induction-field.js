// Dimensionless 3D example machine, not a calibrated motor or a FEM solution.
const TAU = Math.PI * 2;
const NX = 19, NZ = 15, XY = 2.6, Z = 2.1;
const COUNT = NX * NX * NZ;
const index = (x, y, z) => ((z * NX + y) * NX + x) * 3;

export const fieldDefaults = { iron: true, reaction: true, inductance: true, ends: true, saturation: true, slots: true, skew: true };

function segment(list, a, b, weight = 1) {
  list.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (b[0] - a[0]) * weight, (b[1] - a[1]) * weight, (b[2] - a[2]) * weight]);
}

function sources(options) {
  const result = Array.from({ length: 5 }, () => []);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3 + Math.PI / 2, radius = 1.3 + k * .035, depth = 1.09 + k * .12;
    const point = (angle, z) => [radius * Math.cos(angle), radius * Math.sin(angle), z];
    for (let side = 0; side < 2; side++) {
      const angle = a + side * Math.PI, sign = side === 0 ? 1 : -1;
      for (let j = 0; j < 16; j++) segment(result[k], point(angle, -depth + 2 * depth * j / 16), point(angle, -depth + 2 * depth * (j + 1) / 16), sign);
      if (options.ends) for (let j = 0; j < 24; j++) segment(result[k], point(angle + Math.PI * j / 24, sign * depth), point(angle + Math.PI * (j + 1) / 24, sign * depth));
    }
  }
  for (let mode = 0; mode < 2; mode++) {
    const currents = Array.from({ length: 22 }, (_, i) => mode === 0 ? Math.cos(i * TAU / 22) : Math.sin(i * TAU / 22));
    let sum = 0;
    const rings = currents.map(i => (sum += i));
    const mean = rings.reduce((a, b) => a + b, 0) / 22;
    const point = (a, z) => [1.005 * Math.cos(a + (options.skew ? .14 * z : 0)), 1.005 * Math.sin(a + (options.skew ? .14 * z : 0)), z];
    for (let i = 0; i < 22; i++) {
      const a = i * TAU / 22;
      for (let j = 0; j < 16; j++) segment(result[mode + 3], point(a, -1.02 + 2.04 * j / 16), point(a, -1.02 + 2.04 * (j + 1) / 16), currents[i]);
      // Periodic ring currents satisfy K_i - K_(i-1) = I_i at every node.
      if (options.ends) for (const side of [-1, 1]) for (let j = 0; j < 3; j++) segment(result[mode + 3], point(a + TAU / 22 * j / 3, side * 1.02), point(a + TAU / 22 * (j + 1) / 3, side * 1.02), side * (rings[i] - mean));
    }
  }
  return result;
}

function wireField(segments, x, y, z, out) {
  out.fill(0);
  for (const s of segments) {
    const rx = x - s[0], ry = y - s[1], rz = z - s[2];
    const r2 = rx * rx + ry * ry + rz * rz + .085 ** 2;
    const f = .14 / (r2 * Math.sqrt(r2));
    out[0] += (s[4] * rz - s[5] * ry) * f;
    out[1] += (s[5] * rx - s[3] * rz) * f;
    out[2] += (s[3] * ry - s[4] * rx) * f;
  }
}

function interpolate(grid, x, y, z, out) {
  const gx = (x + XY) / (2 * XY) * (NX - 1), gy = (y + XY) / (2 * XY) * (NX - 1), gz = (z + Z) / (2 * Z) * (NZ - 1);
  out.fill(0);
  if (gx < 0 || gx >= NX - 1 || gy < 0 || gy >= NX - 1 || gz < 0 || gz >= NZ - 1) return out;
  const ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz), u = gx - ix, v = gy - iy, w = gz - iz;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const weight = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w), p = index(ix + dx, iy + dy, iz + dz);
    for (let k = 0; k < 3; k++) out[k] += grid[p + k] * weight;
  }
  return out;
}

export class InductionField {
  constructor() {
    this.options = { ...fieldDefaults };
    this.grid = new Float32Array(COUNT * 3);
    this.basis = null;
    this.state = { phase: 0, rotorAngle: 0, frequency: 50, slip: .05, gain: 1, direction: 1 };
    this.rotorAmplitude = this.lag = 0;
    this.scratch = new Float64Array(3);
    this.nodes = [];
    // Local spherical-inclusion polarizability; no self-consistent iron boundary solve.
    for (const rotor of [false, true]) for (const z of [-.62, 0, .62]) {
      const n = rotor ? 8 : 16, r = rotor ? .58 : 1.4;
      const volume = rotor ? Math.PI * .96 ** 2 * 1.85 / 24 : Math.PI * (1.57 ** 2 - 1.22 ** 2) * 1.9 / 48;
      for (let i = 0; i < n; i++) {
        const angle = TAU * (i + .25) / n;
        this.nodes.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), z, rotor, angle, alpha: 3 * volume / (4 * Math.PI) * (1200 - 1) / (1200 + 2), moment: new Float64Array(3) });
      }
    }
    this.points = new Float32Array(COUNT * 3);
    for (let z = 0; z < NZ; z++) for (let y = 0; y < NX; y++) for (let x = 0; x < NX; x++) this.points.set([-XY + 2 * XY * x / (NX - 1), -XY + 2 * XY * y / (NX - 1), -Z + 2 * Z * z / (NZ - 1)], index(x, y, z));
  }

  configure(options) {
    if (options.ends !== this.options.ends || options.skew !== this.options.skew) this.basis = null;
    Object.assign(this.options, options);
  }

  prepare() {
    if (this.basis) return;
    this.basis = sources(this.options).map(segments => {
      const grid = new Float32Array(COUNT * 3);
      for (let p = 0; p < grid.length; p += 3) {
        wireField(segments, this.points[p], this.points[p + 1], this.points[p + 2], this.scratch);
        grid.set(this.scratch, p);
      }
      return grid;
    });
  }

  rotorCurrent(angle) {
    return this.rotorAmplitude * Math.cos(angle - this.state.phase + this.lag);
  }

  applied(x, y, z, out) {
    out.fill(0);
    const { phase, gain, rotorAngle } = this.state;
    const b = this.scratch;
    for (let k = 0; k < 3; k++) {
      interpolate(this.basis[k], x, y, z, b);
      const current = gain * Math.cos(phase - k * TAU / 3);
      for (let j = 0; j < 3; j++) out[j] += b[j] * current;
    }
    if (this.options.reaction) {
      const c = Math.cos(rotorAngle), s = Math.sin(rotorAngle), localPhase = phase - rotorAngle - this.lag;
      for (let k = 0; k < 2; k++) {
        interpolate(this.basis[k + 3], c * x + s * y, -s * x + c * y, z, b);
        const current = this.rotorAmplitude * (k === 0 ? Math.cos(localPhase) : Math.sin(localPhase));
        out[0] += (c * b[0] - s * b[1]) * current;
        out[1] += (s * b[0] + c * b[1]) * current;
        out[2] += b[2] * current;
      }
    }
    return out;
  }

  update(state) {
    this.prepare();
    Object.assign(this.state, state);
    const omega = TAU * state.frequency * state.slip * state.direction;
    const tau = this.options.inductance ? .045 : 0;
    this.lag = Math.atan(omega * tau);
    // Steady-state R-L response in rotor coordinates; R, coupling and L are example parameters.
    this.rotorAmplitude = state.gain * .006 * omega / Math.hypot(1, omega * tau);
    const value = new Float64Array(3);
    if (this.options.iron) for (const node of this.nodes) {
      this.applied(node.x, node.y, node.z, value);
      const length = Math.hypot(...value);
      const saturation = this.options.saturation && length > 1e-9 ? 2.2 * Math.tanh(length / 2.2) / length : 1;
      const tooth = this.options.slots ? 1 - .2 * (1 + Math.cos((node.rotor ? 22 : 12) * (node.angle - (node.rotor ? state.rotorAngle : 0)))) / 2 : 1;
      for (let k = 0; k < 3; k++) node.moment[k] = value[k] * node.alpha * saturation * tooth;
    }
    for (let p = 0; p < this.grid.length; p += 3) {
      const x = this.points[p], y = this.points[p + 1], z = this.points[p + 2];
      this.applied(x, y, z, value);
      if (this.options.iron) for (const n of this.nodes) {
        const rx = x - n.x, ry = y - n.y, rz = z - n.z;
        // Finite-size regularization avoids point-dipole and filament singularities.
        const r2 = rx * rx + ry * ry + rz * rz + .16 ** 2, f = 1 / (r2 * Math.sqrt(r2));
        const dot = (rx * n.moment[0] + ry * n.moment[1] + rz * n.moment[2]) * 3 / r2;
        value[0] += (rx * dot - n.moment[0]) * f;
        value[1] += (ry * dot - n.moment[1]) * f;
        value[2] += (rz * dot - n.moment[2]) * f;
      }
      this.grid.set(value, p);
    }
  }

  sample(x, y, z, out = new Float64Array(3)) {
    return interpolate(this.grid, x, y, z, out);
  }
}
