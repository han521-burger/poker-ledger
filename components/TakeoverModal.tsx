'use client';

import { useState } from 'react';

export default function TakeoverModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (currentPin: string, newPin: string) => void;
  onCancel: () => void;
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!/^\d{4}$/.test(currentPin)) {
      setError('Enter the current 4-digit PIN');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError('New PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs don't match");
      return;
    }
    onConfirm(currentPin, newPin);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">Take over as host</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
          If the previous host is gone, anyone who knows this session's PIN can take over. Set a new PIN in the same
          step — the old host (and anyone else who only knew the old PIN) will lose access.
        </p>
        <input
          className="field-input mb-3"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={currentPin}
          onChange={(e) => {
            setCurrentPin(e.target.value);
            setError('');
          }}
          placeholder="Current PIN"
        />
        <div className="h-px my-3" style={{ background: 'var(--line)' }} />
        <input
          className="field-input mb-3"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={newPin}
          onChange={(e) => {
            setNewPin(e.target.value);
            setError('');
          }}
          placeholder="New PIN"
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
        <button className="btn-primary mb-2" onClick={submit}>
          Take over
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
