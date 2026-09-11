'use client';

import { useEffect, useState } from 'react';
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
  onJoined: (playerId: string, name: string) => void;
}) {
  const [remembered, setRemembered] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
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
    await onJoined(playerId, name);
    rememberPlayer(playerId, name);
    setBusy(false);
    setShowPicker(false);
  }

  async function joinAsNew() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
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
          欢迎回来，<span className="font-semibold">{remembered.name}</span>
        </p>
        <button className="btn-primary" disabled={busy} onClick={() => join(remembered.id, remembered.name)}>
          确认入座
        </button>
        <button className="btn-ghost mt-2" onClick={() => setShowPicker(true)}>
          不是我，换一个身份
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
      <p className="mb-3">这是你第一次在这台设备打开牌局，点选你的名字入座</p>
      <button className="btn-primary" onClick={() => setShowPicker(true)}>
        选择我的身份入座
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
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-3">选择身份</h3>
        <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
          常客名录（点选一键入座）
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {roster.length === 0 && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>暂无更多常客</span>}
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
          或输入新昵称
        </p>
        <input
          className="field-input mb-3"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="输入昵称"
        />
        <button className="btn-primary mb-2" onClick={onNew}>
          添加新玩家并入座
        </button>
        <button className="btn-ghost" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
