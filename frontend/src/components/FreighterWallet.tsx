import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const STELLAR_NETWORK: "TESTNET" | "MAINNET" =
  (import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET").toUpperCase() === "MAINNET"
    ? "MAINNET"
    : "TESTNET";
const FREIGHTER_DOWNLOAD = "https://www.freighter.app/";

type FreighterApi = {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  getNetwork: () => Promise<string>;
  requestAccess: () => Promise<void>;
};

type WalletState = {
  address: string | null;
  network: string | null;
  connected: boolean;
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function FreighterWallet() {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    network: null,
    connected: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  // Check if already connected on mount
  useEffect(() => {
    const freighter = (window as unknown as Record<string, unknown>).freighter as FreighterApi | undefined;
    if (!freighter) return;
    freighter.isConnected().then((connected: boolean) => {
      if (connected) {
        freighter.getPublicKey().then((address: string) => {
          freighter.getNetwork().then((network: string) => {
            setWallet({ address, network, connected: true });
            setMismatchDismissed(false);
          });
        });
      }
    });
  }, []);

  async function connect() {
    const freighter = (window as unknown as Record<string, unknown>).freighter as FreighterApi | undefined;
    if (!freighter) {
      setError(t("wallet.notFound"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await freighter.requestAccess();
      const address: string = await freighter.getPublicKey();
      const network: string = await freighter.getNetwork();
      setWallet({ address, network, connected: true });
      // Re-show the mismatch warning on every (re)connect
      setMismatchDismissed(false);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? t("wallet.failed"));
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setWallet({ address: null, network: null, connected: false });
    setError(null);
  }

  const walletNetwork = wallet.network?.toUpperCase() ?? null;
  const networkMismatch =
    wallet.connected && walletNetwork !== null && walletNetwork !== STELLAR_NETWORK;
  const showMismatch = networkMismatch && !mismatchDismissed;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {!wallet.connected ? (
        <button onClick={connect} disabled={loading} aria-label={t("wallet.connectLabel")}>
          {loading ? t("wallet.connecting") : t("wallet.connect")}
        </button>
      ) : (
        <>
          <span title={wallet.address ?? ""} aria-label="Connected wallet address">
            {truncate(wallet.address!)}
          </span>
          <button onClick={disconnect} aria-label="Disconnect wallet">
            {t("wallet.disconnect")}
          </button>
        </>
      )}

      {showMismatch && (
        <span
          role="alert"
          data-testid="network-mismatch"
          style={{
            color: STELLAR_NETWORK === "MAINNET" ? "red" : "orange",
            fontWeight: STELLAR_NETWORK === "MAINNET" ? "bold" : undefined,
          }}
        >
          {STELLAR_NETWORK === "MAINNET"
            ? t("wallet.networkMismatchMainnet", { network: wallet.network })
            : walletNetwork === "PUBLIC" || walletNetwork === "MAINNET"
              ? t("wallet.networkMismatchTestnet", { network: wallet.network })
              : t("wallet.networkMismatch", { network: wallet.network, expected: STELLAR_NETWORK })}{" "}
          <button onClick={() => setMismatchDismissed(true)} aria-label={t("wallet.dismissWarning")}>
            ×
          </button>
        </span>
      )}

      {error && (
        <span role="alert" style={{ color: "red" }}>
          {error}{" "}
          {error.includes("not found") && (
            <a href={FREIGHTER_DOWNLOAD} target="_blank" rel="noreferrer">
              {t("wallet.install")}
            </a>
          )}
        </span>
      )}
    </div>
  );
}
