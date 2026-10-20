import type { Plugin } from 'vite'
import { createLocalApiHandler, type LocalApiOptions } from './handler.ts'

/**
 * Adds the local J-Quants proxy (`/api/*`) to both `vite` (dev) and
 * `vite preview` (npm start). Never used by the public demo build.
 */
export function localJquantsApi(options: LocalApiOptions): Plugin {
  return {
    name: 'market-lens-local-jquants-api',
    configureServer(server) {
      server.middlewares.use(createLocalApiHandler(options))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createLocalApiHandler(options))
    },
  }
}
