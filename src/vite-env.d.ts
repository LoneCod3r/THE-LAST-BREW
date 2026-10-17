/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The game's full public address (with any base path), when it differs from the origin it is served from. */
  readonly VITE_PUBLIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
