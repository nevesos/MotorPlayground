import { InductionField, materialKey } from './induction-field.js';
import { traceFieldLines } from './field-lines.js';
import { decodeDefault, defaultKey } from './field-defaults.js';

const model = new InductionField();
const urls = [
  new URL('./field-defaults/0.bin.gz', import.meta.url),
  new URL('./field-defaults/1.bin.gz', import.meta.url),
  new URL('./field-defaults/2.bin.gz', import.meta.url),
];
// Start loading before the physical view is enabled. Failure retains the numerical path.
const defaults = new Map(urls.map((url, index) => [defaultKey(index), (async () => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Field defaults unavailable');
    let buffer = await response.arrayBuffer();
    // Some servers send Content-Encoding: gzip, so fetch has already decompressed it.
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return decodeDefault(buffer, model);
  } catch { return null; }
})()]));

self.onmessage = async ({ data: { state, options, config, buffer, electricBuffer } }) => {
  if (buffer) model.grid = new Float32Array(buffer);
  if (electricBuffer) model.electric = new Float32Array(electricBuffer);
  model.configure(options);
  if (!model.materialCache && options.iron && !options.saturation) {
    const preset = await defaults.get(materialKey(model.options));
    if (preset) { model.basis = preset.basis; model.materialCache = preset.materialCache; }
  }
  model.update(state);
  const traces = [traceFieldLines(model, false, options.magneticLines), traceFieldLines(model, true, options.electric)];
  self.postMessage({
    state, config, traces, grid: model.grid, material: model.material, electric: model.electric, lag: model.lag, rotorAmplitude: model.rotorAmplitude,
  }, [model.grid.buffer, model.electric.buffer, ...(model.material ? [model.material.buffer] : []), ...traces.flatMap(t => [t.positions.buffer, t.colors.buffer, t.arrows.buffer])]);
};
