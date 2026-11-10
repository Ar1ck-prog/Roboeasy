import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// Copy the Vite build into the existing same-origin RoboEasy route. Preserve unrelated files.
const source = resolve('fll-simulator/dist');
const target = resolve('public/fll-sim');
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
console.log('FLL simulator copied to public/fll-sim');
