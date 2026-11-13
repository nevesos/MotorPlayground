const TAU = Math.PI * 2;
export const windingTurns = 4;
export const windingSpread = [-TAU / 18, 0, TAU / 18];
export const effectiveTurns = windingTurns * windingSpread.reduce((sum, a) => sum + Math.cos(a), 0);
export const statorSlots = 18;

export function statorSlotAngle(slot) { return Math.PI / 2 + slot * TAU / statorSlots; }

// One series-connected phase: three full-pitch coils, four turns each, in 18 slots.
// End segments include inter-coil connections; the two remaining ends go to the terminals.
export function statorWinding(phase) {
  const segments = [], sides = [];
  const depth = .95;
  const point = (a, r, z) => [r * Math.cos(a), r * Math.sin(a), z];
  let previous;
  const add = (p, end) => {
    if (previous) segments.push({ a: previous, b: p, end });
    previous = p;
  };
  const turns = windingSpread.flatMap(offset => Array.from({ length: windingTurns }, (_, turn) => ({
    angle: phase * TAU / 3 + Math.PI / 2 + offset, radius: 1.285 + turn * .04, turn,
  })));
  for (let i = 0; i < turns.length; i++) {
      const { angle: a, radius: r, turn } = turns[i];
      const next = turns[i + 1] ?? { angle: a - .04, radius: r };
      const height = .26 + phase * .075 + turn * .025;
      // Roof-shaped end windings return over the same half circumference, not a full hoop.
      // The rear head advances directly into the next series turn / coil.
      const head = (from, to, radius, side) => {
        for (let j = 1; j <= 48; j++) {
          const t = j / 48, lift = Math.sin(Math.PI * t);
          add(point(from + (to - from) * t, r + (radius - r) * t + .035 * lift, side * (depth + height * lift)), true);
        }
      };
      if (i === 0) add(point(a, r, -depth), true);
      for (let j = 1; j <= 16; j++) add(point(a, r, -depth + 2 * depth * j / 16), false);
      head(a, a + Math.PI, r, 1);
      for (let j = 1; j <= 16; j++) add(point(a + Math.PI, r, depth - 2 * depth * j / 16), false);
      head(a + Math.PI, next.angle, next.radius, -1);
  }
  for (const offset of windingSpread) for (let side = 0; side < 2; side++) sides.push({ angle: phase * TAU / 3 + Math.PI / 2 + offset + side * Math.PI, radius: 1.345, side });
  return { segments, sides };
}
