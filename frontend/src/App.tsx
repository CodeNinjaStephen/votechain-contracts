import React, { useEffect, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useTranslation } from "react-i18next";
import { useTransactionStatus } from "./hooks/useTransactionStatus";
import { TransactionToast } from "./components/TransactionToast";

/**
 * Page components — consumed lazily to keep the initial bundle small.
 */
const ProposalList = React.lazy(() => import("./pages/ProposalList"));
const ProposalDetail = React.lazy(() => import("./pages/ProposalDetail"));
const VotingPanel = React.lazy(() => import("./pages/VotingPanel"));
const VoteHistory = React.lazy(() => import("./pages/VoteHistory"));

// ---------------------------------------------------------------------------
// Dark mode hook (#15)
// ---------------------------------------------------------------------------
// The inline script in index.html applies the correct class before first
// paint to avoid a flash of incorrect theme (FOIT). This hook keeps the
// React toggle state in sync with that initial value and persists any
// subsequent toggle back to localStorage so both the React app and the
// vanilla proposals.js script read the same value.

function useDarkMode() {
  // Initialise from the class the inline script already applied — this avoids
  // a second layout pass on mount.
  const [dark, setDark] = useState<boolean>(() =>
    document.documentElement.classList.contains("dark")
  );

  // Keep <html class="dark"> and localStorage in sync whenever the toggle
  // changes. Because the inline script runs before React hydrates, this
  // effect only runs for *subsequent* user-driven changes.
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  // Listen for theme changes made by the vanilla proposals.js toggle so the
  // React state stays in sync when both scripts are active on the same page.
  useEffect(() => {
    function onStorageChange(e: StorageEvent) {
      if (e.key === "theme") {
        setDark(e.newValue === "dark");
      }
    }
    window.addEventListener("storage", e => onStorageChange(e));
    return () => window.removeEventListener("storage", e => onStorageChange(e));
  }, []);

  return { dark, toggle: () => setDark((d) => !d) };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const { t } = useTranslation();
  const { dark, toggle } = useDarkMode();
  const { tx, retry, reset } = useTransactionStatus();

  return (
    <ErrorBoundary section="App">
      {/* TransactionToast renders outside routing so it persists across navigation */}
      <TransactionToast
        tx={tx}
        onRetry={tx.hash ? () => retry(tx.hash!) : undefined}
        onDismiss={reset}
      />

      {/* Theme toggle — synced with the inline script & proposals.js (#15) */}
      <button
        type="button"
        onClick={toggle}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={dark}
        className="theme-toggle"
      >
        {dark ? "☀️" : "🌙"}
      </button>

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
        <React.Suspense fallback={<p>{t("app.loading")}</p>}>
          <VoteHistory />
        </React.Suspense>
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
