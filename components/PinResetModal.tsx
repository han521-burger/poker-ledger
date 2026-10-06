'use client';

import { useState } from 'react';

export default function PinResetModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (newPin: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs don't match");
      return;
    }
    setBusy(true);
    await onConfirm(pin);
    setBusy(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">Reset host PIN</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
          This device (or account) is already recognized as the host, so you can set a new PIN without knowing the
          old one.
        </p>
        <input
          className="field-input mb-3"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError('');
          }}
          placeholder="New 4-digit PIN"
        />
        <input
          className="field-input mb-3"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirmPin}
          onChange={(e) => {
            setConfirmPin(e.target.value);
            setError('');
          }}
          placeholder="Confirm new PIN"
        />
        {error && (
          <div className="text-xs mb-3" style={{ color: '#e58579' }}>
            {error}
          </div>
        )}
        <button className="btn-primary mb-2" disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : 'Save new PIN'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
