// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STELLAR_NETWORK = "TESTNET";
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

  // Check if already connected on mount
  useEffect(() => {
    const freighter = (window as unknown as Record<string, unknown>).freighter as FreighterApi | undefined;
    if (!freighter) return;
    freighter.isConnected().then((connected: boolean) => {
      if (connected) {
        freighter.getPublicKey().then((address: string) => {
          freighter.getNetwork().then((network: string) => {
            setWallet({ address, network, connected: true });
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

  const networkMismatch =
    wallet.connected &&
    wallet.network &&
    wallet.network.toUpperCase() !== STELLAR_NETWORK;

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

      {networkMismatch && (
        <span role="alert" style={{ color: "orange" }}>
          {t("wallet.networkMismatch", { network: wallet.network, expected: STELLAR_NETWORK })}
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
