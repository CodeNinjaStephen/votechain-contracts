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

import { useMemo, useState } from 'react';
import type { Proposal, ProposalState, VoteRecord } from '../types';
import { generateCsv } from '../utils/csv';

interface Props {
  proposals: Proposal[];
}

type StateFilter = 'All' | ProposalState;

function statusClass(state: ProposalState) {
  return `status-chip status-${state.toLowerCase()}`;
}

function ariaLabelForVoteType(type: VoteRecord['type']) {
  return `${type} vote`;
}

export default function VoteHistory({ proposals }: Props) {
  const [address, setAddress] = useState('GCFX4Q...');
  const [fromDate, setFromDate] = useState('2025-01-01');
  const [toDate, setToDate] = useState('2026-12-31');
  const [stateFilter, setStateFilter] = useState<StateFilter>('All');

  const votes = useMemo(() => {
    const normalizedAddress = address.trim().toLowerCase();
    const matched: Array<{ proposal: Proposal; vote: VoteRecord }> = [];
    proposals.forEach((proposal) => {
      if (stateFilter !== 'All' && proposal.state !== stateFilter) return;
      proposal.votes.forEach((vote) => {
        if (vote.address.toLowerCase().includes(normalizedAddress)) {
          if (vote.votedAt >= fromDate && vote.votedAt <= toDate) {
            matched.push({ proposal, vote });
          }
        }
      });
    });
    return matched;
  }, [address, proposals, fromDate, toDate, stateFilter]);

  const exportVotes = () => {
    const csv = generateCsv(votes.map((item) => item.vote));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vote-history-${address.replace(/\W/g, '_') || 'unknown'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="vote-history-heading" className="card">
      <div className="header">
        <div>
          <h2 id="vote-history-heading">Wallet vote history</h2>
          <p>View votes cast by any public address without a wallet connection.</p>
        </div>
        <button type="button" onClick={exportVotes} disabled={votes.length === 0} aria-disabled={votes.length === 0}>
          Export CSV
        </button>
      </div>
      <form className="grid" onSubmit={(event) => event.preventDefault()}>
        <label>
          Wallet address
          <input
            type="text"
            value={address}
            placeholder="Enter public address"
            onChange={(event) => setAddress(event.target.value)}
            aria-describedby="address-help"
          />
        </label>
        <div id="address-help" className="visually-hidden">
          Enter a public wallet address to view read-only vote history.
        </div>
        <label>
          From
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label>
          Proposal state
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as StateFilter)}>
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Passed">Passed</option>
            <option value="Rejected">Rejected</option>
            <option value="Executed">Executed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </label>
      </form>
      <div className="table-wrapper" aria-live="polite">
        <table>
          <caption className="visually-hidden">Vote history for the selected address</caption>
          <thead>
            <tr>
              <th scope="col">Proposal</th>
              <th scope="col">Vote</th>
              <th scope="col">Weight</th>
              <th scope="col">State</th>
              <th scope="col">Voted At</th>
            </tr>
          </thead>
          <tbody>
            {votes.map(({ proposal, vote }, index) => (
              <tr key={`${proposal.id}-${index}`}>
                <td>{proposal.title}</td>
                <td aria-label={ariaLabelForVoteType(vote.type)}>{vote.type}</td>
                <td>{vote.weight}</td>
                <td>
                  <span className={statusClass(proposal.state)}>{proposal.state}</span>
                </td>
                <td>{vote.votedAt}</td>
              </tr>
            ))}
            {votes.length === 0 && (
              <tr>
                <td colSpan={5}>No votes found for this address in the selected range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
