import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// DEMO_BASE sets the public path, e.g. DEMO_BASE=/isoplan/ for a sub-path deploy.
export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: process.env.DEMO_BASE ?? '/',
    plugins: [react()],
    resolve: {
        alias: {
            isoplan: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
