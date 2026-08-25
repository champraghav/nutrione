import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only ever the TypeScript sources. Without this the runner also picks up
    // the compiled copies under dist/ after a build and reports them as
    // failures, because CommonJS output cannot import vitest.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
