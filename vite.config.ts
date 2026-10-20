import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { localJquantsApi } from './server/plugin.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Content-Security-Policy for built pages. The app only talks to its own origin
 * (the local proxy), so connect-src stays 'self'. Dev mode is excluded because
 * Vite's HMR needs inline scripts.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // ECharts tooltips use inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'market-lens-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

/** VITE_* variables end up in the browser bundle, so they must never hold secrets. */
function assertNoClientSecrets(mode: string): void {
  const exposed = loadEnv(mode, root, 'VITE_')
  const suspicious = Object.keys(exposed).filter((name) => /KEY|TOKEN|SECRET|PASSWORD/i.test(name))
  if (suspicious.length > 0) {
    throw new Error(
      `Refusing to build: ${suspicious.join(', ')} would be exposed to the browser. ` +
        'Use JQUANTS_API_KEY (without the VITE_ prefix) in .env.local.',
    )
  }
}

export default defineConfig(({ mode }) => {
  assertNoClientSecrets(mode)
  const isDemo = mode === 'demo'

  return {
    // Relative base + hash routing works on GitHub Pages and locally.
    base: './',
    plugins: [
      react(),
      contentSecurityPolicy(),
      // MARKET_LENS_CACHE_DIR lets automated tests keep their fake data out of .cache/.
      ...(isDemo
        ? []
        : [localJquantsApi({ root, cacheDir: process.env.MARKET_LENS_CACHE_DIR || undefined })]),
    ],
    build: {
      outDir: isDemo ? 'dist-demo' : 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1' },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
      environment: 'node',
      restoreMocks: true,
    },
  }
})
