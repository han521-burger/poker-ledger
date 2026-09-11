'use client';

import { useState } from 'react';

export default function PinModal({
  title = 'Enter host PIN',
  subtitle = 'This is required for every host action.',
  onConfirm,
  onCancel,
}: {
  title?: string;
  subtitle?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">{title}</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
          {subtitle}
        </p>
        <input
          className="field-input mb-4"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="4-digit PIN"
        />
        <button className="btn-primary mb-2" onClick={() => onConfirm(pin)}>
          Confirm
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
