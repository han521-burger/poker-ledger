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
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount));

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
          onClick={() => {
            const v = parseFloat(amount);
            if (v > 0) onConfirm(v);
          }}
        >
          Confirm rebuy
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
