'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BuyIn } from '@/lib/types';
import { fmt } from '@/lib/settlement';

export default function BuyInsModal({
  playerName,
  buyIns,
  onChanged,
  onClose,
}: {
  playerName: string;
  buyIns: BuyIn[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveEdit(id: string) {
    const amount = parseFloat(editValue);
    if (!amount || amount <= 0) return;
    setBusy(true);
    await supabase.from('buy_ins').update({ amount }).eq('id', id);
    setBusy(false);
    setEditingId(null);
    onChanged();
  }

  async function removeEntry(id: string) {
    setBusy(true);
    await supabase.from('buy_ins').delete().eq('id', id);
    setBusy(false);
    onChanged();
  }

  const sorted = [...buyIns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">{playerName} · Buy-in records</h3>
        {sorted.length === 0 && (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-dim)' }}>
            No buy-ins recorded
          </div>
        )}
        {sorted.map((b, i) => (
          <div key={b.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
            <div>
              <div className="text-sm">
                {i === 0 ? 'Initial buy-in' : `Rebuy #${i}`}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {editingId === b.id ? (
              <div className="flex items-center gap-2">
                <input
                  className="field-input"
                  style={{ width: 90, padding: '6px 8px' }}
                  type="number"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
                <button className="btn-small" disabled={busy} onClick={() => saveEdit(b.id)}>
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="num text-sm">{fmt(Number(b.amount))}</span>
                <button
                  className="btn-small"
                  onClick={() => {
                    setEditingId(b.id);
                    setEditValue(String(b.amount));
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn-small"
                  disabled={busy}
                  style={{ color: '#e58579' }}
                  onClick={() => removeEntry(b.id)}
                >
                  Void
                </button>
              </div>
            )}
          </div>
        ))}
        <button className="btn-ghost mt-4" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
