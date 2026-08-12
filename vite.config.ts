import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

function commitSha(): string {
  try {
    const sha = execSync('git rev-parse --short=7 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    if (sha) return sha
  } catch {
    // not a git checkout (e.g. a source archive)
  }
  const github = process.env.GITHUB_SHA
  if (github) return github.slice(0, 7)
  return 'dev'
}

export default defineConfig({
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
  },
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(commitSha()),
  },
  test: {
    exclude: ['tests/**', '**/node_modules/**', '**/dist/**'],
  },
})
