/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGE_GATE_ENABLED: string;
  readonly VITE_AGE_GATE_MIN_AGE: string;
  readonly VITE_AGE_GATE_REMEMBER_DAYS: string;
  readonly VITE_PRIVY_APP_ID: string;
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}