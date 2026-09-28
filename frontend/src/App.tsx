import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NavHeader } from "./components/NavHeader";
import { useTranslation } from "react-i18next";

/**
 * Page components — all consume WalletContext / ProposalContext from
 * providers in main.tsx (issue #10 — no prop-drilling).
 */
const ProposalList     = React.lazy(() => import('./pages/ProposalList'));
const ProposalDetail   = React.lazy(() => import('./pages/ProposalDetail'));
const VotingPanel      = React.lazy(() => import('./pages/VotingPanel'));
const VoteHistory      = React.lazy(() => import('./pages/VoteHistory'));
const GovernanceDashboard = React.lazy(() =>
  import('./pages/GovernanceDashboard').then((m) => ({ default: m.GovernanceDashboard ?? m.default }))
);

/** Updates the document title on route change (issue #16 — browser history / a11y). */
function PageTitle({ title }: { title: string }) {
  React.useEffect(() => {
    document.title = `${title} | VoteChain`;
  }, [title]);
  return null;
}

function AppRoutes() {
  const { t } = useTranslation();
  const fallback = <p>{t("app.loading")}</p>;

  return (
    <>
      <NavHeader />
      <main>
        <React.Suspense fallback={fallback}>
          <Routes>
            <Route
              path="/"
              element={
                <ErrorBoundary section="ProposalList">
                  <PageTitle title="Proposals" />
                  <ProposalList />
                </ErrorBoundary>
              }
            />
            <Route
              path="/proposals/:id"
              element={
                <ErrorBoundary section="ProposalDetail">
                  <PageTitle title="Proposal Detail" />
                  <ProposalDetail />
                </ErrorBoundary>
              }
            />
            <Route
              path="/vote/:id"
              element={
                <ErrorBoundary section="VotingPanel">
                  <PageTitle title="Cast Vote" />
                  <VotingPanel />
                </ErrorBoundary>
              }
            />
            <Route
              path="/history"
              element={
                <ErrorBoundary section="VoteHistory">
                  <PageTitle title="Vote History" />
                  <VoteHistory />
                </ErrorBoundary>
              }
            />
            {/* Issue #16 — GovernanceDashboard route */}
            <Route
              path="/dashboard"
              element={
                <ErrorBoundary section="GovernanceDashboard">
                  <PageTitle title="Dashboard" />
                  <GovernanceDashboard />
                </ErrorBoundary>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </main>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary section="App">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
