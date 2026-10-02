/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_SYMBOL?: string;
  readonly VITE_BUFFER_SIZE?: string;
  readonly VITE_FLUSH_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
