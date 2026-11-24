// Writes the 6 built-in sample sign stacks as SVG + expected-rules JSON to client/public/samples.
// Usage: npm run samples
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLES, sampleSvg } from '../client/src/samples/samples';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public', 'samples');
mkdirSync(out, { recursive: true });
for (const sample of SAMPLES) {
  writeFileSync(resolve(out, `${sample.id}.svg`), sampleSvg(sample));
  writeFileSync(resolve(out, `${sample.id}.json`), JSON.stringify(sample.expected, null, 2));
  console.log(`wrote ${sample.id}.svg + .json`);
}
