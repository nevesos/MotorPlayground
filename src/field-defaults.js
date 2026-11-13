import { fieldDefaults, materialKey } from './induction-field.js';

export const defaultConfigurations = [[true, true], [true, false], [false, true]].map(([statorIron, rotorIron]) => ({
  ...fieldDefaults, distributed: true, statorIron, rotorIron,
}));

// Float32 payload: source bases, then two stator and sixteen rotor B/material/E responses.
export function encodeDefault(model) {
  const responses = [...model.materialCache.stator, ...model.materialCache.rotor.flat()];
  const arrays = [...model.basis, ...responses.flatMap(response => [response.grid, response.material, response.electric])];
  const buffer = new ArrayBuffer(16 + arrays.reduce((sum, array) => sum + array.byteLength, 0));
  new Uint32Array(buffer, 0, 4).set([0x4d464431, 1, model.grid.length, model.iron.grid.length]);
  let offset = 16;
  for (const array of arrays) { new Float32Array(buffer, offset, array.length).set(array); offset += array.byteLength; }
  return buffer;
}

export function decodeDefault(buffer, model) {
  const header = new Uint32Array(buffer, 0, 4), gridLength = model.points.length, materialLength = model.iron.grid.length;
  if (header[0] !== 0x4d464431 || header[1] !== 1 || header[2] !== gridLength || header[3] !== materialLength ||
      buffer.byteLength !== 16 + 4 * (5 * gridLength + 18 * (2 * gridLength + materialLength))) throw new Error('Incompatible field defaults');
  let offset = 16;
  const read = length => { const array = new Float32Array(buffer, offset, length); offset += array.byteLength; return array; };
  const basis = Array.from({ length: 5 }, () => read(gridLength));
  const responses = Array.from({ length: 18 }, () => ({ grid: read(gridLength), material: read(materialLength), electric: read(gridLength) }));
  return { basis, materialCache: { stator: responses.slice(0, 2), rotor: Array.from({ length: 8 }, (_, i) => responses.slice(2 + i * 2, 4 + i * 2)) } };
}

export const defaultKey = index => materialKey(defaultConfigurations[index]);
