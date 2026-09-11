'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/types';
import { getRememberedPlayer, rememberPlayer } from '@/lib/localPlayer';

export default function JoinPanel({
  sessionId,
  seatedPlayerIds,
  onJoined,
}: {
  sessionId: string;
  seatedPlayerIds: string[];
  onJoined: (playerId: string, name: string, countInLeaderboard: boolean) => void;
}) {
  const [remembered, setRemembered] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [countInLeaderboard, setCountInLeaderboard] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRemembered(getRememberedPlayer());
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    supabase
      .from('players')
      .select('*')
      .order('name')
      .then(({ data }) => setRoster((data as Player[]) || []));
  }, [showPicker]);

  const alreadySeated = remembered && seatedPlayerIds.includes(remembered.id);

  async function join(playerId: string, name: string) {
    setBusy(true);
    await onJoined(playerId, name, countInLeaderboard);
    rememberPlayer(playerId, name);
    setBusy(false);
    setShowPicker(false);
  }

  // Case-insensitive dedupe: if a roster entry already matches this name
  // exactly (ignoring case/whitespace), reuse it instead of creating a new
  // duplicate player row for what is really the same person.
  async function joinAsNew() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const exactMatch = roster.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
    if (exactMatch) {
      await join(exactMatch.id, exactMatch.name);
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.from('players').insert({ name }).select().single();
    if (!error && data) {
      await join(data.id, data.name);
    }
    setBusy(false);
  }

  if (remembered && alreadySeated) return null;

  if (remembered && !alreadySeated) {
    return (
      <div className="card mb-4 text-center">
        <p className="mb-3">
          Welcome back, <span className="font-semibold">{remembered.name}</span>
        </p>
        <LeaderboardToggle value={countInLeaderboard} onChange={setCountInLeaderboard} />
        <button className="btn-primary mt-3" disabled={busy} onClick={() => join(remembered.id, remembered.name)}>
          Confirm and take a seat
        </button>
        <button className="btn-ghost mt-2" onClick={() => setShowPicker(true)}>
          Not me — pick a different identity
        </button>
        {showPicker && (
          <RosterPicker
            roster={roster.filter((p) => !seatedPlayerIds.includes(p.id))}
            newName={newName}
            setNewName={setNewName}
            onPick={(p) => join(p.id, p.name)}
            onNew={joinAsNew}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="card mb-4 text-center">
      <p className="mb-3">First time on this device — pick your name to take a seat</p>
      <LeaderboardToggle value={countInLeaderboard} onChange={setCountInLeaderboard} />
      <button className="btn-primary mt-3" onClick={() => setShowPicker(true)}>
        Choose my identity
      </button>
      {showPicker && (
        <RosterPicker
          roster={roster.filter((p) => !seatedPlayerIds.includes(p.id))}
          newName={newName}
          setNewName={setNewName}
          onPick={(p) => join(p.id, p.name)}
          onNew={joinAsNew}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function LeaderboardToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-dim)' }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Count this session on the leaderboard
    </label>
  );
}

function RosterPicker({
  roster,
  newName,
  setNewName,
  onPick,
  onNew,
  onClose,
}: {
  roster: Player[];
  newName: string;
  setNewName: (v: string) => void;
  onPick: (p: Player) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const suggestions = useMemo(() => {
    const q = newName.trim().toLowerCase();
    if (!q) return [];
    return roster.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [newName, roster]);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-3">Choose identity</h3>
        <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
          Regulars (tap to take a seat instantly)
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {roster.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              No more regulars yet
            </span>
          )}
          {roster.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="px-3 py-1.5 rounded-full text-sm"
              style={{ background: '#0d2b22', border: '1px solid var(--line)' }}
            >
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
              Did you mean one of these? Tap to use it instead of creating a duplicate.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="px-3 py-1.5 rounded-full text-sm"
                  style={{ background: 'rgba(199,154,75,0.15)', border: '1px solid #c79a4b', color: '#c79a4b' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="btn-primary mb-2" onClick={onNew}>
          Add new player and take a seat
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
