// Inductive component only: Laplacian(E) = curl(dB/dt), div(E) approximately zero.
// Homogeneous outer boundary approximates a decaying field in the finite display volume.
export function electricField(current, shifted, dt, out, rhs, nx, nz, steps) {
  out.fill(0); rhs.fill(0);
  const offsets = [1, nx, nx * nx], weights = steps.map(h => 1 / h ** 2);
  const diagonal = 2 * weights.reduce((a, b) => a + b, 0);
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < nx - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const p = (z * nx + y) * nx + x;
    for (let component = 0; component < 3; component++) {
      const a = (component + 1) % 3, b = (component + 2) % 3;
      const ap = (p + offsets[a]) * 3 + b, am = (p - offsets[a]) * 3 + b;
      const bp = (p + offsets[b]) * 3 + a, bm = (p - offsets[b]) * 3 + a;
      rhs[p * 3 + component] = ((shifted[ap] - current[ap] - shifted[am] + current[am]) / (2 * steps[a]) - (shifted[bp] - current[bp] - shifted[bm] + current[bm]) / (2 * steps[b])) / dt;
    }
  }
  for (let iteration = 0; iteration < 48; iteration++) {
    for (let z = 1; z < nz - 1; z++) for (let y = 1; y < nx - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const p = ((z * nx + y) * nx + x) * 3;
      for (let component = 0; component < 3; component++) {
        let sum = 0;
        for (let axis = 0; axis < 3; axis++) sum += weights[axis] * (out[p - offsets[axis] * 3 + component] + out[p + offsets[axis] * 3 + component]);
        out[p + component] += 1.5 * ((sum - rhs[p + component]) / diagonal - out[p + component]);
      }
    }
  }
}
