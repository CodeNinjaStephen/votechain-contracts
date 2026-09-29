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
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import QuorumProgressBar from "../components/QuorumProgressBar";
import { useProposals } from "../context/ProposalContext";

export default function ProposalDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { proposals } = useProposals();

  const proposal = proposals.find((p) => p.id === id);

  if (!proposal) {
    return (
      <div className="card">
        <p>{t("proposal.notFound", { defaultValue: "Proposal not found." })}</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="proposal-detail-heading" className="card">
      <h2 id="proposal-detail-heading">{proposal.title}</h2>
      <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
        {t("proposal.id", { defaultValue: "Proposal ID:" })} {proposal.id}
        {" · "}
        {t("proposal.state", { defaultValue: "State:" })} {proposal.state}
      </p>

      {proposal.description && (
        <p style={{ marginTop: "0.75rem" }}>{proposal.description}</p>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
          {t("proposal.title", { defaultValue: "Vote Tally" })}
        </h3>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <dt style={{ fontSize: "0.75rem", color: "#6b7280" }}>For</dt>
            <dd style={{ fontWeight: 600 }}>
              {proposal.votes
                .filter((v) => v.type === "For")
                .reduce((sum, v) => sum + v.weight, 0)
                .toLocaleString()}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.75rem", color: "#6b7280" }}>Against</dt>
            <dd style={{ fontWeight: 600 }}>
              {proposal.votes
                .filter((v) => v.type === "Against")
                .reduce((sum, v) => sum + v.weight, 0)
                .toLocaleString()}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.75rem", color: "#6b7280" }}>Abstain</dt>
            <dd style={{ fontWeight: 600 }}>
              {proposal.votes
                .filter((v) => v.type === "Abstain")
                .reduce((sum, v) => sum + v.weight, 0)
                .toLocaleString()}
            </dd>
          </div>
        </dl>

        <QuorumProgressBar
          totalVotes={proposal.totalWeight}
          quorum={proposal.quorum}
          showExactNumbers={true}
        />
      </div>
    </section>
  );
}

