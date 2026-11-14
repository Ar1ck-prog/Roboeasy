import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
// Copy the Vite build into the existing same-origin RoboEasy route. Preserve unrelated files
// (ROBOEASY.md), but clear the hashed bundles so old builds do not pile up.
const source = resolve('fll-simulator/dist');
const target = resolve('public/fll-sim');
await mkdir(target, { recursive: true });
await rm(resolve(target, 'assets'), { recursive: true, force: true });
await cp(source, target, { recursive: true, force: true });
console.log('FLL simulator copied to public/fll-sim');
