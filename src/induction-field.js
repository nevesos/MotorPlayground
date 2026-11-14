import { statorWinding, effectiveTurns } from './stator-winding.js';
import { IronField } from './induction-iron.js';
import { electricField } from './induction-electric.js';

// Dimensionless 3D example machine, not a calibrated motor or a FEM solution.
const TAU = Math.PI * 2;
const NX = 19, NZ = 15, XY = 2.6, Z = 2.1;
const COUNT = NX * NX * NZ;
const index = (x, y, z) => ((z * NX + y) * NX + x) * 3;

export const fieldDefaults = { iron: true, statorIron: true, rotorIron: true, reaction: true, inductance: true, ends: true, saturation: false, slots: true, skew: true };

export function rotorResponse({ frequency, slip, direction, gain }, inductance = true) {
  const omega = TAU * frequency * slip * direction;
  const tau = inductance ? .045 : 0;
  return { lag: Math.atan(omega * tau), amplitude: gain * .006 * omega / Math.hypot(1, omega * tau) };
}

export const materialKey = options => JSON.stringify(['ends', 'skew', 'distributed', 'slots', 'statorIron', 'rotorIron', 'saturation', 'reaction'].map(key => options[key]));

function segment(list, a, b, weight = 1) {
  list.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (b[0] - a[0]) * weight, (b[1] - a[1]) * weight, (b[2] - a[2]) * weight]);
}

function sources(options) {
  const result = Array.from({ length: 5 }, () => []);
  for (let k = 0; k < 3; k++) {
    if (options.distributed) {
      for (const s of statorWinding(k).segments) if (!s.end || options.ends) segment(result[k], s.a, s.b);
      continue;
    }
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
  const p = index(ix, iy, iz), row = NX * 3, layer = NX * NX * 3;
  for (let k = 0; k < 3; k++) {
    const lower = (grid[p + k] * (1 - u) + grid[p + k + 3] * u) * (1 - v) + (grid[p + row + k] * (1 - u) + grid[p + row + k + 3] * u) * v;
    const upper = (grid[p + layer + k] * (1 - u) + grid[p + layer + k + 3] * u) * (1 - v) + (grid[p + layer + row + k] * (1 - u) + grid[p + layer + row + k + 3] * u) * v;
    out[k] = lower * (1 - w) + upper * w;
  }
  return out;
}

export class InductionField {
  constructor() {
    this.options = { ...fieldDefaults, distributed: true };
    this.grid = new Float32Array(COUNT * 3);
    this.basis = null;
    this.state = { phase: 0, rotorAngle: 0, frequency: 50, slip: .05, gain: 1, direction: 1 };
    this.rotorAmplitude = this.lag = 0;
    this.scratch = new Float64Array(3);
    this.points = new Float32Array(COUNT * 3);
    for (let z = 0; z < NZ; z++) for (let y = 0; y < NX; y++) for (let x = 0; x < NX; x++) this.points.set([-XY + 2 * XY * x / (NX - 1), -XY + 2 * XY * y / (NX - 1), -Z + 2 * Z * z / (NZ - 1)], index(x, y, z));
    this.iron = new IronField(interpolate);
    this.material = null;
    this.materialCache = null;
    this.configurations = new Map();
    this.source = new Float32Array(COUNT * 3);
    this.shifted = new Float32Array(COUNT * 3);
    this.electric = new Float32Array(COUNT * 3);
    this.electricRhs = new Float32Array(COUNT * 3);
  }

  configure(options) {
    const previousKey = materialKey(this.options);
    if (this.materialCache) {
      this.configurations.delete(previousKey);
      this.configurations.set(previousKey, { basis: this.basis, materialCache: this.materialCache });
      // Bound memory when exploring many nonstandard winding/material combinations.
      if (this.configurations.size > 6) this.configurations.delete(this.configurations.keys().next().value);
    }
    if (['ends', 'skew', 'distributed'].some(key => key in options && options[key] !== this.options[key])) this.basis = null;
    if (['ends', 'skew', 'distributed', 'slots', 'statorIron', 'rotorIron', 'saturation', 'reaction'].some(key => key in options && options[key] !== this.options[key])) this.materialCache = null;
    Object.assign(this.options, options);
    const cached = this.configurations.get(materialKey(this.options));
    if (cached) { this.basis = cached.basis; this.materialCache = cached.materialCache; }
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

  setState(state) {
    Object.assign(this.state, state);
    // Steady-state R-L response in rotor coordinates; R, coupling and L are example parameters.
    const response = rotorResponse(state, this.options.inductance);
    this.lag = response.lag;
    this.rotorAmplitude = response.amplitude * (this.options.distributed ? effectiveTurns : 1);
  }

  prepareMaterial() {
    if (this.materialCache) return;
    const response = (phase, rotorAngle, rotor) => {
      Object.assign(this.state, { phase, rotorAngle, gain: rotor ? 0 : 1 });
      this.rotorAmplitude = rotor ? 1 : 0; this.lag = 0;
      const value = new Float64Array(3), grid = new Float32Array(COUNT * 3);
      for (let p = 0; p < grid.length; p += 3) {
        this.applied(this.points[p], this.points[p + 1], this.points[p + 2], value);
        this.source.set(value, p);
      }
      this.iron.solve(this.source, grid, this.options, this.points);
      return { grid, material: this.iron.grid.slice() };
    };
    // Linear material response: two stator phases, plus periodic rotor-position samples.
    // Interpolating one bar pitch preserves the resolved stationary stator geometry.
    const stator = [response(0, 0, false), response(Math.PI / 2, 0, false)];
    const rotor = this.options.reaction ? Array.from({ length: 8 }, (_, i) => [response(0, i * TAU / (22 * 8), true), response(Math.PI / 2, i * TAU / (22 * 8), true)]) : null;
    this.materialCache = { stator, rotor };
  }

  magnetic(state, out) {
    this.prepare();
    const material = this.options.iron && (this.options.statorIron || this.options.rotorIron);
    if (material && !this.options.saturation) {
      this.prepareMaterial(); this.setState(state);
      const { stator, rotor } = this.materialCache;
      const terms = [[stator[0], state.gain * Math.cos(state.phase)], [stator[1], state.gain * Math.sin(state.phase)]];
      if (this.options.reaction) {
        const position = ((state.rotorAngle / (TAU / 22) % 1 + 1) % 1) * rotor.length;
        const lower = Math.floor(position), fraction = position - lower, phase = state.phase - this.lag;
        for (let side = 0; side < 2; side++) for (let mode = 0; mode < 2; mode++) terms.push([
          rotor[(lower + side) % rotor.length][mode],
          this.rotorAmplitude * (mode ? Math.sin(phase) : Math.cos(phase)) * (side ? fraction : 1 - fraction),
        ]);
      }
      out.fill(0); this.iron.grid.fill(0);
      for (const [basis, weight] of terms) {
        for (let p = 0; p < out.length; p++) out[p] += basis.grid[p] * weight;
        for (let p = 0; p < this.iron.grid.length; p++) this.iron.grid[p] += basis.material[p] * weight;
      }
      this.materialTerms = terms;
      return;
    }
    this.setState(state);
    const value = new Float64Array(3);
    for (let p = 0; p < this.source.length; p += 3) {
      const x = this.points[p], y = this.points[p + 1], z = this.points[p + 2];
      this.applied(x, y, z, value);
      this.source.set(value, p);
    }
    if (material) this.iron.solve(this.source, out, this.options, this.points);
    else out.set(this.source);
  }

  update(state) {
    this.magnetic(state, this.grid);
    const currentTerms = this.materialTerms;
    this.material = this.options.iron && (this.options.statorIron || this.options.rotorIron) ? this.iron.grid.slice() : null;
    this.electric.fill(0);
    if (!this.options.electric || !state.frequency) return;
    const phaseStep = .005, dt = phaseStep / (TAU * state.frequency * state.direction);
    this.magnetic({ ...state, phase: state.phase + phaseStep, rotorAngle: state.rotorAngle + phaseStep * (1 - state.slip) }, this.shifted);
    Object.assign(this.state, state);
    if (this.material && !this.options.saturation) {
      const bases = [...this.materialCache.stator, ...(this.materialCache.rotor?.flat() || [])];
      const zero = new Float32Array(COUNT * 3);
      for (const basis of bases) if (!basis.electric) {
        basis.electric = new Float32Array(COUNT * 3);
        electricField(zero, basis.grid, 1, basis.electric, this.electricRhs, NX, NZ, [2 * XY / (NX - 1), 2 * XY / (NX - 1), 2 * Z / (NZ - 1)]);
      }
      const weights = new Map();
      for (const [basis, weight] of currentTerms) weights.set(basis, (weights.get(basis) || 0) - weight);
      for (const [basis, weight] of this.materialTerms) weights.set(basis, (weights.get(basis) || 0) + weight);
      for (const [basis, weight] of weights) for (let p = 0; p < this.electric.length; p++) this.electric[p] += basis.electric[p] * (weight / dt);
      return;
    }
    electricField(this.grid, this.shifted, dt, this.electric, this.electricRhs, NX, NZ, [2 * XY / (NX - 1), 2 * XY / (NX - 1), 2 * Z / (NZ - 1)]);
  }

  sample(x, y, z, out = new Float64Array(3)) {
    interpolate(this.grid, x, y, z, out);
    return this.material ? this.iron.sample(this.material, x, y, z, out) : out;
  }

  sampleElectric(x, y, z, out = new Float64Array(3)) {
    return interpolate(this.electric, x, y, z, out);
  }
}
