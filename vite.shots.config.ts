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
    rollupOptions: {
      input: {
        /* The store screenshots (§T). */
        shots: resolve(process.cwd(), 'shots.html'),
        /*
         * Every design at A4, for the printed-type sweep. A second entry
         * rather than a route inside the app: nothing a customer can reach
         * shows sixteen designs at once, and adding one so a test could look
         * would be app code that exists for the test.
         */
        sizes: resolve(process.cwd(), 'sizes.html'),
      },
    },
  },
})
