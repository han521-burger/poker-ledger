'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/types';

export default function AddPlayerModal({
  seatedPlayerIds,
  onAdd,
  onClose,
}: {
  seatedPlayerIds: string[];
  onAdd: (playerId: string, name: string, countInLeaderboard: boolean) => void;
  onClose: () => void;
}) {
  const [roster, setRoster] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [countInLeaderboard, setCountInLeaderboard] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('players')
      .select('*')
      .order('name')
      .then(({ data }) => setRoster((data as Player[]) || []));
  }, []);

  const available = useMemo(() => roster.filter((p) => !seatedPlayerIds.includes(p.id)), [roster, seatedPlayerIds]);

  const suggestions = useMemo(() => {
    const q = newName.trim().toLowerCase();
    if (!q) return [];
    return available.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [newName, available]);

  async function addExisting(p: Player) {
    setBusy(true);
    await onAdd(p.id, p.name, countInLeaderboard);
    setBusy(false);
    onClose();
  }

  // Same case-insensitive dedupe as the self-serve join panel, so a host
  // typo doesn't spawn a duplicate player record for someone already listed.
  async function addNew() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const exact = roster.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
    if (exact) {
      await addExisting(exact);
      return;
    }
    const { data, error } = await supabase.from('players').insert({ name }).select().single();
    if (error || !data) {
      alert(`Couldn't create that player: ${error?.message ?? 'unknown error'}`);
      setBusy(false);
      return;
    }
    await onAdd(data.id, data.name, countInLeaderboard);
    setBusy(false);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-3">Add a player</h3>
        <label className="flex items-center gap-2 text-xs mb-4 cursor-pointer" style={{ color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={countInLeaderboard} onChange={(e) => setCountInLeaderboard(e.target.checked)} />
          Count this session on their leaderboard
        </label>

        <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
          Regulars (tap to seat instantly)
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {available.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              No more regulars yet
            </span>
          )}
          {available.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => addExisting(p)}
              className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5"
              style={{ background: '#0d2b22', border: '1px solid var(--line)' }}
            >
              {p.avatar && <span>{p.avatar}</span>}
              {p.name}
            </button>
          ))}
        </div>

        <div className="h-px my-3" style={{ background: 'var(--line)' }} />
        <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
          Or type a new name
        </p>
        <input
          className="field-input mb-2"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Type a name"
        />
        {suggestions.length > 0 && (
          <div className="mb-3">
            <p className="text-xs mb-1.5" style={{ color: '#c79a4b' }}>
              Did you mean one of these?
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addExisting(p)}
                  className="px-3 py-1.5 rounded-full text-sm"
                  style={{ background: 'rgba(199,154,75,0.15)', border: '1px solid #c79a4b', color: '#c79a4b' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn-primary mb-2" disabled={busy} onClick={addNew}>
          Add and seat
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
