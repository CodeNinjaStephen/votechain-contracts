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

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useTranslation } from "react-i18next";

/**
 * Page components — all consume WalletContext / ProposalContext from
 * providers in main.tsx (issue #10 — no prop-drilling).
 */
const ProposalList = React.lazy(() => import('./pages/ProposalList'));
const ProposalDetail = React.lazy(() => import('./pages/ProposalDetail'));
const VotingPanel = React.lazy(() => import('./pages/VotingPanel'));
const VoteHistory = React.lazy(() => import('./pages/VoteHistory'));

export default function App() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary section="App">
      {/* TransactionToast is rendered outside routing so it persists across navigation */}
      <TransactionToast
        tx={tx}
        onRetry={tx.hash ? () => retry(tx.hash!) : undefined}
        onDismiss={reset}
      />

      <ErrorBoundary section="ProposalList">
        <React.Suspense fallback={<p>{t("app.loading")}</p>}>
          <ProposalList />
        </React.Suspense>
      </ErrorBoundary>

      <ErrorBoundary section="ProposalDetail">
        <React.Suspense fallback={<p>{t("app.loading")}</p>}>
          <ProposalDetail />
        </React.Suspense>
      </ErrorBoundary>

      <ErrorBoundary section="VotingPanel">
        <React.Suspense fallback={<p>{t("app.loading")}</p>}>
          <VotingPanel />
        </React.Suspense>
      </ErrorBoundary>

      <ErrorBoundary section="VoteHistory">
        <React.Suspense fallback={<p>Loading…</p>}>
          <VoteHistory />
        </React.Suspense>
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
