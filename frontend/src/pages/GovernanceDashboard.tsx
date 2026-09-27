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

import React, { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type ProposalState = "Active" | "Passed" | "Rejected" | "Executed" | "Cancelled";

type VoterStat = { address: string; total_weight: number };

type Stats = {
  byState: Record<ProposalState, number>;
  participationOverTime: { date: string; rate: number }[];
  topVoters: VoterStat[];
  avgQuorumAchievement: number;
};

// ── Mock data fetcher (replace with real API calls) ────────────────────────

async function fetchStats(): Promise<Stats> {
  // In production, replace with: fetch('/api/governance/stats')
  return {
    byState: { Active: 3, Passed: 12, Rejected: 5, Executed: 10, Cancelled: 2 },
    participationOverTime: [
      { date: "2026-01", rate: 42 },
      { date: "2026-02", rate: 55 },
      { date: "2026-03", rate: 61 },
      { date: "2026-04", rate: 48 },
    ],
    topVoters: [
      { address: "GABC...1234", total_weight: 9_800_000 },
      { address: "GDEF...5678", total_weight: 7_200_000 },
      { address: "GHIJ...9012", total_weight: 5_500_000 },
      { address: "GKLM...3456", total_weight: 4_100_000 },
      { address: "GNOP...7890", total_weight: 3_800_000 },
      { address: "GQRS...1234", total_weight: 3_200_000 },
      { address: "GTUV...5678", total_weight: 2_900_000 },
      { address: "GWXY...9012", total_weight: 2_400_000 },
      { address: "GZAB...3456", total_weight: 1_900_000 },
      { address: "GCDE...7890", total_weight: 1_500_000 },
    ],
    avgQuorumAchievement: 73,
  };
}

// ── Minimal SVG pie chart ──────────────────────────────────────────────────

const PIE_COLORS: Record<ProposalState, string> = {
  Active: "#42a5f5",
  Passed: "#66bb6a",
  Rejected: "#ef5350",
  Executed: "#26c6da",
  Cancelled: "#bdbdbd",
};

function PieChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <p>No data</p>;

  let cumAngle = 0;
  const slices = Object.entries(data).map(([label, value]) => {
    const angle = (value / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    return { label, value, angle, start };
  });

  function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const cx = 80, cy = 80, r = 70;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={160} height={160} aria-label="Proposals by state pie chart" role="img">
        {slices.map(({ label, angle, start }) => {
          if (angle === 0) return null;
          const s = polarToXY(cx, cy, r, start);
          const e = polarToXY(cx, cy, r, start + angle);
          const large = angle > 180 ? 1 : 0;
          const d = `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large},1 ${e.x},${e.y} Z`;
          return (
            <path
              key={label}
              d={d}
              fill={PIE_COLORS[label as ProposalState] ?? "#888"}
              stroke="#fff"
              strokeWidth={1}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
        {slices.map(({ label, value }) => (
          <li key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 12, height: 12, borderRadius: 2,
                background: PIE_COLORS[label as ProposalState] ?? "#888",
                display: "inline-block",
              }}
            />
            {label}: <strong>{value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Minimal SVG line chart ─────────────────────────────────────────────────

function LineChart({ data }: { data: { date: string; rate: number }[] }) {
  if (data.length === 0) return <p>No data</p>;
  const W = 320, H = 120, PAD = 24;
  const maxRate = Math.max(...data.map((d) => d.rate), 100);
  const xStep = (W - PAD * 2) / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: PAD + i * xStep,
    y: H - PAD - ((d.rate / maxRate) * (H - PAD * 2)),
    label: d.date,
    rate: d.rate,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={W} height={H} aria-label="Voter participation rate over time" role="img">
      <polyline points={polyline} fill="none" stroke="#42a5f5" strokeWidth={2} />
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r={4} fill="#42a5f5" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize={10} fill="#aaa">
            {p.label}
          </text>
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fill="#fff">
            {p.rate}%
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Dashboard page ─────────────────────────────────────────────────────────

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export function GovernanceDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchStats();
      setStats(data);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (loading && !stats) return <p aria-live="polite">Loading governance statistics…</p>;
  if (!stats) return <p>Failed to load statistics.</p>;

  const totalProposals = Object.values(stats.byState).reduce((a, b) => a + b, 0);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", color: "#e0e0e0", background: "#121212", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 4 }}>Governance Dashboard</h1>
      {lastUpdated && (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>
          Last updated: {lastUpdated.toLocaleTimeString()} · refreshes every 5 min
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>

        {/* Proposals by state */}
        <section aria-labelledby="pie-heading" style={cardStyle}>
          <h2 id="pie-heading" style={h2Style}>Proposals by State</h2>
          <p style={{ fontSize: 13, color: "#aaa" }}>Total: {totalProposals}</p>
          <PieChart data={stats.byState} />
        </section>

        {/* Participation over time */}
        <section aria-labelledby="line-heading" style={cardStyle}>
          <h2 id="line-heading" style={h2Style}>Participation Rate Over Time</h2>
          <LineChart data={stats.participationOverTime} />
        </section>

        {/* Avg quorum achievement */}
        <section aria-labelledby="quorum-heading" style={cardStyle}>
          <h2 id="quorum-heading" style={h2Style}>Avg Quorum Achievement</h2>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#66bb6a" }}>
            {stats.avgQuorumAchievement}%
          </div>
          <p style={{ fontSize: 13, color: "#aaa" }}>
            Average across all finalized proposals
          </p>
        </section>

        {/* Top 10 voters */}
        <section aria-labelledby="voters-heading" style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <h2 id="voters-heading" style={h2Style}>Top 10 Voters by Vote Weight</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Address</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total Weight</th>
              </tr>
            </thead>
            <tbody>
              {stats.topVoters.map((v, i) => (
                <tr key={v.address} style={{ borderBottom: "1px solid #222" }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={tdStyle}>{v.address}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {v.total_weight.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1e1e1e",
  borderRadius: 8,
  padding: 20,
  border: "1px solid #333",
};
const h2Style: React.CSSProperties = { fontSize: 16, marginBottom: 12, color: "#fff" };
const thStyle: React.CSSProperties = { padding: "6px 8px", textAlign: "left", color: "#aaa" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", color: "#e0e0e0" };
