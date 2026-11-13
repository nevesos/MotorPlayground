const TAU = Math.PI * 2;
export const FIELD_LINES = 24, FIELD_STEPS = 95;

function magneticColor(strength, colors, p) {
  const h = .64 - .62 * Math.min(1, Math.log1p(strength) / Math.log(5)), s = .8, l = .56;
  for (let i = 0; i < 3; i++) {
    const k = (([0, 8, 4][i] + h * 12) % 12);
    colors[p + i] = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  }
}

export function traceFieldLines(model, electric, enabled) {
  const positions = new Float32Array(FIELD_LINES * FIELD_STEPS * 12), colors = new Float32Array(positions.length);
  const arrows = new Float32Array(FIELD_LINES * 7), b = new Float64Array(3), mid = new Float64Array(3);
  const sample = (electric ? model.sampleElectric : model.sample).bind(model), minimum = electric ? .1 : .015;
  let count = 0;
  for (let i = 0; i < FIELD_LINES && enabled; i++) {
    const angle = i % 8 * TAU / 8 + model.state.phase;
    const radius = electric ? .55 + Math.floor(i / 8) * .5 : i >= 16 ? 1.515 : .45 + (i % 2) * .35;
    const seed = [radius * Math.cos(angle), radius * Math.sin(angle), electric || i >= 16 ? 0 : (Math.floor(i / 8) - 1) * .72];
    sample(seed[0], seed[1], seed[2], b);
    const strength = Math.hypot(b[0], b[1], b[2]);
    if (strength > minimum) arrows.set([...seed, b[0] / strength, b[1] / strength, b[2] / strength, strength], i * 7);
    for (const sign of [-1, 1]) {
      let [x, y, z] = seed;
      for (let step = 0; step < FIELD_STEPS; step++) {
        sample(x, y, z, b);
        const length = Math.hypot(b[0], b[1], b[2]);
        if (length < minimum) break;
        const h = sign * .065 / length;
        sample(x + b[0] * h / 2, y + b[1] * h / 2, z + b[2] * h / 2, mid);
        const m = Math.hypot(mid[0], mid[1], mid[2]);
        if (m < minimum) break;
        const nx = x + sign * .065 * mid[0] / m, ny = y + sign * .065 * mid[1] / m, nz = z + sign * .065 * mid[2] / m;
        if (Math.abs(nx) > 2.5 || Math.abs(ny) > 2.5 || Math.abs(nz) > 2) break;
        const p = count * 3;
        positions[p] = x; positions[p + 1] = y; positions[p + 2] = z;
        positions[p + 3] = nx; positions[p + 4] = ny; positions[p + 5] = nz;
        if (electric) { colors[p] = .687; colors[p + 1] = .352; colors[p + 2] = 1; }
        else magneticColor(length, colors, p);
        colors[p + 3] = colors[p]; colors[p + 4] = colors[p + 1]; colors[p + 5] = colors[p + 2];
        count += 2; x = nx; y = ny; z = nz;
        if (step > 20 && Math.hypot(x - seed[0], y - seed[1], z - seed[2]) < .07) break;
      }
    }
  }
  return { positions, colors, arrows, count };
}
