import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { InductionField } from './src/induction-field.js';
import { defaultConfigurations, encodeDefault } from './src/field-defaults.js';

const directory = new URL('./src/field-defaults/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [index, options] of defaultConfigurations.entries()) {
  const model = new InductionField();
  model.configure({ ...options, electric: true });
  model.update({ phase: 0, rotorAngle: 0, frequency: 50, slip: .05, gain: 1, direction: 1 });
  const bytes = gzipSync(new Uint8Array(encodeDefault(model)), { level: 9 });
  await writeFile(new URL(`${index}.bin.gz`, directory), bytes);
  console.log(`Field default ${index + 1}/3: ${(bytes.byteLength / 1048576).toFixed(2)} MiB`);
}
