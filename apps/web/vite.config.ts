/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Windows: a terminal opened as "c:\..." (lowercase drive) makes Vite 8's bundler see the
// same file under two spellings and bundle React twice, which crashes the page
// ("Cannot read properties of null (reading 'useContext')"). Resolving the real,
// correctly-cased path for the project root and the alias avoids it.
const root = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)));
const src = realpathSync.native(fileURLToPath(new URL('./src', import.meta.url)));
// Edge Function code (Deno) whose pure helpers are unit-tested here, e.g. the AI copy guard.
const functionsDir = realpathSync.native(
  fileURLToPath(new URL('../../supabase/functions', import.meta.url)),
);

// Vite config for the AdMitra website. Port 5173 matches supabase/config.toml (site_url).
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': src, '@supabase-functions': functionsDir },
    // Belt and braces: always use a single copy of React and the router.
    dedupe: [
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
      'remotion',
      '@remotion/player',
      '@remotion/paths',
    ],
  },
  // One pre-bundled copy of Remotion for the Player and the shared templates. Two copies
  // break the frame context ("useCurrentFrame can only be called inside <Player>").
  optimizeDeps: { include: ['remotion', '@remotion/player', '@remotion/paths'] },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
