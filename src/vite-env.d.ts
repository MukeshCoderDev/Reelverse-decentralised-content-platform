/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_CHANNELS: string; // Assuming this will be a comma-separated string or similar
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
