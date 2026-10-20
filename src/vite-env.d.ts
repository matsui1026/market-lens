/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'demo' for the public GitHub Pages build, 'local' otherwise. */
  readonly VITE_APP_MODE: 'demo' | 'local'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
