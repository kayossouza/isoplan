import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', core: 'src/core.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: true,
    sourcemap: false,
    target: 'es2022',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
});
