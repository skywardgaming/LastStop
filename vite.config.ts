/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// The site is served from https://<owner>.github.io/LastStop/ on GitHub Pages,
// so built asset URLs must be prefixed with the repository name.
export default defineConfig({
  base: '/LastStop/',
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
