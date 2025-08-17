// scripts/prep-out.mjs
import { rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
if (existsSync('build_out')) await rm('build_out', { recursive: true, force: true });
await mkdir('build_out', { recursive: true });
console.log('Prepared build_out/');
