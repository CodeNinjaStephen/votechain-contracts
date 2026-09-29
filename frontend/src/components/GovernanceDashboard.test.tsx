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

/**
 * Tests for GovernanceDashboard component (issue #11).
 * Covers: loading state, renders chart sections after data loads,
 * renders pie chart, line chart, quorum stat, top-voters table.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GovernanceDashboard } from '../pages/GovernanceDashboard';

// ── Tests ─────────────────────────────────────────────────────

describe('GovernanceDashboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a loading message on initial render', () => {
    render(<GovernanceDashboard />);
    expect(screen.getByText(/loading governance statistics/i)).toBeInTheDocument();
  });

  it('renders "Proposals by State" section after data loads', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(screen.getByText(/proposals by state/i)).toBeInTheDocument()
    );
  });

  it('renders "Participation Rate Over Time" section after data loads', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(screen.getByText(/participation rate over time/i)).toBeInTheDocument()
    );
  });

  it('renders "Avg Quorum Achievement" section with a percentage', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(screen.getByText(/avg quorum achievement/i)).toBeInTheDocument()
    );
    // Default mock data returns 73%
    expect(screen.getByText('73%')).toBeInTheDocument();
  });

  it('renders "Top 10 Voters" table with voter rows', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(screen.getByText(/top 10 voters/i)).toBeInTheDocument()
    );
    // Mock data has 10 voters; check at least the first
    expect(screen.getByText('GABC...1234')).toBeInTheDocument();
  });

  it('renders the pie chart SVG with an accessible label', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: /proposals by state pie chart/i })
      ).toBeInTheDocument()
    );
  });

  it('renders the line chart SVG with an accessible label', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: /voter participation rate over time/i })
      ).toBeInTheDocument()
    );
  });

  it('shows "Last updated" timestamp after data loads', async () => {
    render(<GovernanceDashboard />);
    await waitFor(() =>
      expect(screen.getByText(/last updated/i)).toBeInTheDocument()
    );
  });

  it('shows total proposal count', async () => {
    render(<GovernanceDashboard />);
    // Mock data: Active(3)+Passed(12)+Rejected(5)+Executed(10)+Cancelled(2) = 32
    await waitFor(() =>
      expect(screen.getByText(/total:\s*32/i)).toBeInTheDocument()
    );
  });
});
