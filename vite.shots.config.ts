/**
 * The screenshot build (§T).
 *
 * Its own config, and its own output directory, for one reason: the app build
 * must not change because store screenshots exist. `dist/` keeps exactly the
 * entry points, chunks and bytes it had; the fixtures and this entry live only
 * in `dist-shots`, which is never published and never installed.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-shots',
    emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), 'shots.html') },
  },
})
