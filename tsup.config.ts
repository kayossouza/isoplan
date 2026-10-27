import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', core: 'src/core.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: true,
    target: 'es2022',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    // esbuild keeps "use client" in the ESM entry but drops it from the CJS one.
    // The React entry needs it in both; the core entry must stay server-safe.
    async onSuccess() {
        for (const file of ['dist/index.js', 'dist/index.cjs']) {
            const code = await readFile(file, 'utf8');
            if (!code.startsWith('"use client"')) await writeFile(file, `"use client";\n${code}`);
        }
        await copyFile('src/styles.css', 'dist/styles.css');
    },
});
