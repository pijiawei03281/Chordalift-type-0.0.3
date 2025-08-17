// scripts/make-sums.mjs
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2] || 'build_out';
const pick = name => /\.(exe|pdf|txt)$/i.test(name);

const entries = (await readdir(dir)).filter(pick);
let lines = [];
for (const name of entries) {
  const p = join(dir, name);
  const buf = await readFile(p);
  const hash = createHash('sha256').update(buf).digest('hex').toUpperCase();
  lines.push(`${hash}  ${name}`);
}
await writeFile(join(dir, 'SHA256SUMS.txt'), lines.join('\n'), 'ascii');
console.log(`Wrote ${dir}/SHA256SUMS.txt with ${lines.length} entries.`);
