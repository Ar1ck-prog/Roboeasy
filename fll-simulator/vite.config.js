import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Pyodide ships its runtime files (wasm, stdlib zip) next to its JS entry.
// We serve them at /pyodide/ during dev and copy them into dist/ on build.
const PYODIDE_DIR = path.resolve('node_modules/pyodide');
const PYODIDE_FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

// SharedArrayBuffer (used to pause/stop a running Python program) needs cross-origin isolation.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

function pyodideAssets() {
  return {
    name: 'pyodide-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url && req.url.match(/^\/pyodide\/([\w.\-]+)/);
        if (!m || !PYODIDE_FILES.includes(m[1])) return next();
        const file = path.join(PYODIDE_DIR, m[1]);
        const type = m[1].endsWith('.wasm') ? 'application/wasm'
          : m[1].endsWith('.mjs') ? 'text/javascript'
          : m[1].endsWith('.json') ? 'application/json' : 'application/zip';
        res.setHeader('Content-Type', type);
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const f of PYODIDE_FILES) {
        this.emitFile({ type: 'asset', fileName: `pyodide/${f}`, source: fs.readFileSync(path.join(PYODIDE_DIR, f)) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [pyodideAssets()],
  server: { headers: isolationHeaders, port: 5173 },
  preview: { headers: isolationHeaders, port: 4173 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['pyodide'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
