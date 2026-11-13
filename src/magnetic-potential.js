// Preconditioned conjugate gradients for the symmetric finite-volume material system.
// IC(0) retains the seven-point stencil, including the periodic angular connection.
export class MagneticPotential {
  constructor(neighbors, active) {
    this.neighbors = neighbors; this.active = active;
    const n = active.length;
    for (const key of ['diagonal', 'factor', 'residual', 'direction', 'product', 'preconditioned', 'forward']) this[key] = new Float64Array(n);
    this.lower = new Float64Array(n * 6);
  }

  solve(faces, rhs, phi) {
    const { neighbors, active, diagonal, factor, lower, residual: r, direction: d, product: ad, preconditioned: z, forward } = this;
    lower.fill(0);
    for (let p = 0; p < active.length; p++) {
      if (!active[p]) { phi[p] = 0; continue; }
      let diagonalValue = 0, correction = 0;
      for (let side = 0; side < 6; side++) {
        const f = p * 6 + side, q = neighbors[f], c = faces[f];
        diagonalValue += c;
        if (q < p && active[q]) { lower[f] = -c / factor[q]; correction += lower[f] ** 2; }
      }
      diagonal[p] = diagonalValue; factor[p] = Math.sqrt(Math.max(1e-12, diagonalValue - correction));
    }
    const multiply = (input, output) => {
      for (let p = 0; p < active.length; p++) {
        if (!active[p]) { output[p] = 0; continue; }
        let value = diagonal[p] * input[p];
        for (let side = 0; side < 6; side++) {
          const f = p * 6 + side, q = neighbors[f];
          if (active[q]) value -= faces[f] * input[q];
        }
        output[p] = value;
      }
    };
    const precondition = () => {
      for (let p = 0; p < active.length; p++) {
        if (!active[p]) continue;
        let value = r[p];
        for (let side = 0; side < 6; side++) {
          const f = p * 6 + side;
          if (lower[f]) value -= lower[f] * forward[neighbors[f]];
        }
        forward[p] = value / factor[p];
      }
      for (let p = active.length - 1; p >= 0; p--) {
        if (!active[p]) { z[p] = 0; continue; }
        let value = forward[p];
        for (let side = 0; side < 6; side++) {
          const q = neighbors[p * 6 + side];
          if (q > p && active[q]) value -= lower[q * 6 + (side ^ 1)] * z[q];
        }
        z[p] = value / factor[p];
      }
    };
    multiply(phi, ad);
    let norm = 0, error = 0;
    for (let p = 0; p < active.length; p++) {
      r[p] = active[p] ? -rhs[p] - ad[p] : 0;
      if (active[p]) norm += rhs[p] ** 2;
      error += r[p] ** 2;
    }
    const tolerance = Math.max(1e-20, norm * 1e-8);
    if (error <= tolerance) { this.relativeResidual = Math.sqrt(error / (norm || 1)); this.iterations = 0; return; }
    precondition(); d.set(z);
    let rz = 0;
    for (let p = 0; p < active.length; p++) rz += r[p] * z[p];
    for (let iteration = 0; iteration < 128; iteration++) {
      multiply(d, ad);
      let denominator = 0;
      for (let p = 0; p < active.length; p++) denominator += d[p] * ad[p];
      if (!(denominator > 0)) break;
      const alpha = rz / denominator;
      error = 0;
      for (let p = 0; p < active.length; p++) {
        phi[p] += alpha * d[p]; r[p] -= alpha * ad[p]; error += r[p] ** 2;
      }
      this.iterations = iteration + 1;
      if (error <= tolerance) break;
      precondition();
      let next = 0;
      for (let p = 0; p < active.length; p++) next += r[p] * z[p];
      const beta = next / rz; rz = next;
      for (let p = 0; p < active.length; p++) d[p] = z[p] + beta * d[p];
    }
    this.relativeResidual = Math.sqrt(error / (norm || 1));
  }
}
