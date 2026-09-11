'use client';

import { useState } from 'react';

export default function CashoutModal({
  playerName,
  onConfirm,
  onCancel,
}: {
  playerName: string;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">{playerName} · Cash out</h3>
        <input
          className="field-input mb-4"
          type="number"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Chips remaining on the table"
        />
        <button
          className="btn-primary mb-2"
          onClick={() => {
            const v = parseFloat(amount);
            if (!isNaN(v) && v >= 0) onConfirm(v);
          }}
        >
          Confirm cash out
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
