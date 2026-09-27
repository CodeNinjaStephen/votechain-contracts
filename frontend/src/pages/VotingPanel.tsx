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

import { useState } from "react";
import { TransactionToast } from "../components/TransactionToast";
import { VoteConfirmationDialog, VoteChoice } from "../components/VoteConfirmationDialog";
import { useTransactionStatus } from "../hooks/useTransactionStatus";

type Props = {
  proposalTitle?: string;
  estimatedFee?: string;
  onSubmitVote?: (choice: VoteChoice) => Promise<string>;
};

export default function VotingPanel({
  proposalTitle = "Current proposal",
  estimatedFee = "0.00001 XLM",
  onSubmitVote,
}: Props) {
  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);
  const { tx, submit, retry, reset } = useTransactionStatus();

  async function confirmVote() {
    if (!pendingChoice || !onSubmitVote) return;
    const hash = await onSubmitVote(pendingChoice);
    setPendingChoice(null);
    submit(hash);
  }

  return (
    <section aria-labelledby="voting-panel-title">
      <h2 id="voting-panel-title">Cast your vote</h2>
      <div className="vote-actions" role="group" aria-label="Choose a vote">
        {(["Yes", "No", "Abstain"] as VoteChoice[]).map((choice) => (
          <button key={choice} type="button" onClick={() => setPendingChoice(choice)}>
            {choice}
          </button>
        ))}
      </div>
      <TransactionToast tx={tx} onRetry={() => tx.hash && retry(tx.hash)} onDismiss={reset} />
      {pendingChoice && (
        <VoteConfirmationDialog
          proposalTitle={proposalTitle}
          choice={pendingChoice}
          estimatedFee={estimatedFee}
          onConfirm={confirmVote}
          onCancel={() => setPendingChoice(null)}
        />
      )}
    </section>
  );
}
