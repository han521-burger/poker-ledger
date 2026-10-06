'use client';

import { useState } from 'react';

export default function RebuyModal({
  playerName,
  defaultAmount,
  onConfirm,
  onCancel,
}: {
  playerName: string;
  defaultAmount: number;
  onConfirm: (amount: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [busy, setBusy] = useState(false);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">{playerName} · Rebuy</h3>
        <input
          className="field-input mb-4"
          type="number"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Rebuy amount"
        />
        <button
          className="btn-primary mb-2"
          disabled={busy}
          onClick={async () => {
            const v = parseFloat(amount);
            if (!(v > 0)) return;
            setBusy(true);
            await onConfirm(v);
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : 'Confirm rebuy'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
