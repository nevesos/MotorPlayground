import { MagneticPotential } from './magnetic-potential.js';

// Body-fitted cylindrical finite volumes: the thin yoke has three complete radial cells.
const TAU = 2 * Math.PI, ANGLES = 72;
const RADII = [0, .25, .5, .7, .85, .94, .96, 1.04, 1.12, 1.2, 1.22, 1.28, 1.34, 1.4, 1.46, 1.495, 1.53, 1.57, 1.65, 1.8, 2, 2.3, 2.6];
const DEPTHS = [-2.1, -1.3, -1.05, -.95, -.65, -.3, 0, .3, .65, .95, 1.05, 1.3, 2.1];
const NR = RADII.length - 1, NZ = DEPTHS.length - 1, COUNT = NR * ANGLES * NZ;
const at = (r, a, z) => (z * ANGLES + (a + ANGLES) % ANGLES) * NR + r;
const radius = i => (RADII[i] + RADII[i + 1]) / 2;
const depth = i => (DEPTHS[i] + DEPTHS[i + 1]) / 2;
const RC = Float64Array.from({ length: NR }, (_, i) => radius(i));
const ZC = Float64Array.from({ length: NZ }, (_, i) => depth(i));
function interval(values, value) {
  let low = 0, high = values.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (values[mid] <= value) low = mid; else high = mid; }
  return low;
}

export class IronField {
  constructor(sample) {
    this.sampleSource = sample;
    this.grid = new Float32Array(COUNT * 3);
    this.source = new Float32Array(COUNT * 3);
    this.fill = new Float32Array(COUNT);
    this.mu = new Float32Array(COUNT);
    this.potential = new Float64Array(COUNT);
    this.neighbors = new Int32Array(COUNT * 6);
    this.areas = new Float32Array(COUNT * 6);
    this.distance = new Float32Array(COUNT * 6);
    this.faces = new Float32Array(COUNT * 6);
    this.rhs = new Float64Array(COUNT);
    this.points = new Float32Array(COUNT * 3);
    this.normals = new Float32Array(COUNT * 18);
    const active = new Uint8Array(COUNT);
    this.config = '';
    for (let z = 0; z < NZ; z++) for (let a = 0; a < ANGLES; a++) for (let r = 0; r < NR; r++) {
      const p = at(r, a, z), angle = (a + .5) * TAU / ANGLES;
      active[p] = z > 0 && z < NZ - 1 && r < NR - 1 ? 1 : 0;
      this.points.set([radius(r) * Math.cos(angle), radius(r) * Math.sin(angle), depth(z)], p * 3);
      for (let axis = 0; axis < 3; axis++) for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1, f = p * 6 + axis * 2 + side;
        this.neighbors[f] = axis === 0 ? at(Math.max(0, Math.min(NR - 1, r + sign)), a, z) : axis === 1 ? at(r, a + sign, z) : at(r, a, Math.max(0, Math.min(NZ - 1, z + sign)));
        if (axis === 0) {
          this.areas[f] = RADII[r + side] * TAU / ANGLES * (DEPTHS[z + 1] - DEPTHS[z]);
          this.distance[f] = Math.abs(radius(r) - radius(Math.max(0, Math.min(NR - 1, r + sign)))) || 1;
          this.normals.set([sign * Math.cos(angle), sign * Math.sin(angle), 0], f * 3);
        } else if (axis === 1) {
          const faceAngle = (a + side) * TAU / ANGLES;
          this.areas[f] = (RADII[r + 1] - RADII[r]) * (DEPTHS[z + 1] - DEPTHS[z]);
          this.distance[f] = radius(r) * TAU / ANGLES;
          this.normals.set([-sign * Math.sin(faceAngle), sign * Math.cos(faceAngle), 0], f * 3);
        } else {
          this.areas[f] = (RADII[r + 1] ** 2 - RADII[r] ** 2) / 2 * TAU / ANGLES;
          this.distance[f] = Math.abs(depth(z) - depth(Math.max(0, Math.min(NZ - 1, z + sign)))) || 1;
          this.normals[f * 3 + 2] = sign;
        }
      }
    }
    this.solver = new MagneticPotential(this.neighbors, active);
  }

  configure(options) {
    const config = JSON.stringify([options.slots, options.distributed, options.statorIron, options.rotorIron]);
    if (config === this.config) return;
    this.config = config; this.potential.fill(0);
    for (let z = 0; z < NZ; z++) for (let a = 0; a < ANGLES; a++) for (let r = 0; r < NR; r++) {
      const p = at(r, a, z);
      let fill = 0;
      if (Math.abs(depth(z)) < .95) {
        if (options.rotorIron && RADII[r + 1] <= .96) fill = 1;
        if (options.statorIron && RADII[r] >= 1.22 && RADII[r + 1] <= 1.57) {
          for (let i = 0; i < 5; i++) {
            const angle = (a + (i + .5) / 5) * TAU / ANGLES;
            const slot = options.slots && options.distributed && RADII[r] < 1.46 && Math.abs(Math.atan2(Math.sin(18 * angle), Math.cos(18 * angle))) < 18 * .055;
            if (!slot) fill += .2;
          }
        }
      }
      this.fill[p] = fill;
    }
  }

  solve(source, out, options, cartesianPoints) {
    this.configure(options);
    const { mu, potential: phi, faces, rhs, neighbors, normals, areas, distance, grid } = this;
    for (let p = 0; p < COUNT; p++) {
      this.sampleSource(source, this.points[p * 3], this.points[p * 3 + 1], this.points[p * 3 + 2], grid.subarray(p * 3, p * 3 + 3));
      mu[p] = 1 + 79 * this.fill[p];
    }
    this.source.set(grid);
    // Saturation is an optional dimensionless comparison, not a calibrated steel B-H curve.
    for (let pass = 0; pass < (options.saturation ? 2 : 1); pass++) {
      rhs.fill(0);
      for (let p = 0; p < COUNT; p++) for (let side = 0; side < 6; side++) {
        const f = p * 6 + side, q = neighbors[f], permeability = 2 * mu[p] * mu[q] / (mu[p] + mu[q]);
        faces[f] = permeability * areas[f] / distance[f];
        for (let k = 0; k < 3; k++) rhs[p] += permeability * areas[f] * normals[f * 3 + k] * (this.source[p * 3 + k] + this.source[q * 3 + k]) / 2;
      }
      this.solver.solve(faces, rhs, phi);
      grid.set(this.source);
      for (let z = 1; z < NZ - 1; z++) for (let a = 0; a < ANGLES; a++) for (let r = 0; r < NR - 1; r++) {
        const p = at(r, a, z), angle = (a + .5) * TAU / ANGLES;
        const components = [0, 0, 0];
        for (let axis = 0; axis < 3; axis++) for (let side = 0; side < 2; side++) {
          const f = p * 6 + axis * 2 + side, q = neighbors[f];
          const permeability = 2 * mu[p] * mu[q] / (mu[p] + mu[q]);
          let normal = 0;
          for (let k = 0; k < 3; k++) normal += normals[f * 3 + k] * (this.source[p * 3 + k] + this.source[q * 3 + k]) / 2;
          components[axis] += (side ? 1 : -1) * permeability * (normal - (phi[q] - phi[p]) / distance[f]) / 2;
        }
        grid[p * 3] = Math.cos(angle) * components[0] - Math.sin(angle) * components[1];
        grid[p * 3 + 1] = Math.sin(angle) * components[0] + Math.cos(angle) * components[1];
        grid[p * 3 + 2] = components[2];
      }
      if (options.saturation && pass === 0) for (let p = 0; p < COUNT; p++) {
        const b = Math.hypot(grid[p * 3], grid[p * 3 + 1], grid[p * 3 + 2]);
        const knee = options.distributed ? 240 : 20;
        mu[p] = 1 + 79 * this.fill[p] / Math.sqrt(1 + (b / knee) ** 2);
      }
    }
    out.set(source);
    for (let p = 0; p < out.length; p += 3) this.sample(grid, cartesianPoints[p], cartesianPoints[p + 1], cartesianPoints[p + 2], out.subarray(p, p + 3));
  }

  sample(grid, x, y, z, out) {
    const r = Math.hypot(x, y);
    if (r > RC[NR - 1] || z < ZC[0] || z > ZC[NZ - 1]) return out;
    const ir = interval(RC, r), iz = interval(ZC, z);
    const angle = ((Math.atan2(y, x) / TAU * ANGLES - .5) % ANGLES + ANGLES) % ANGLES;
    const ia = Math.floor(angle), u = Math.max(0, (r - RC[ir]) / (RC[ir + 1] - RC[ir])), v = angle - ia, w = (z - ZC[iz]) / (ZC[iz + 1] - ZC[iz]);
    const p = (iz * ANGLES * NR + ia * NR + ir) * 3;
    const pa = (iz * ANGLES * NR + ((ia + 1) % ANGLES) * NR + ir) * 3, layer = ANGLES * NR * 3;
    for (let k = 0; k < 3; k++) {
      const lower = (grid[p + k] * (1 - u) + grid[p + k + 3] * u) * (1 - v) + (grid[pa + k] * (1 - u) + grid[pa + k + 3] * u) * v;
      const upper = (grid[p + layer + k] * (1 - u) + grid[p + layer + k + 3] * u) * (1 - v) + (grid[pa + layer + k] * (1 - u) + grid[pa + layer + k + 3] * u) * v;
      out[k] = lower * (1 - w) + upper * w;
    }
    return out;
  }
}
