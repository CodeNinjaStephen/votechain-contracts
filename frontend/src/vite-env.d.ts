/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Target Stellar network: "TESTNET" (default) or "MAINNET". */
  readonly VITE_STELLAR_NETWORK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
