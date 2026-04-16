import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace package to its TypeScript source during tests so we
      // don't need to build @revi/octokit before running @revi/api tests.
      '@revi/octokit': path.resolve(__dirname, '../../packages/octokit/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
})
