'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/types';
import { rememberPlayer } from '@/lib/localPlayer';
import AvatarPicker, { AVATAR_OPTIONS } from '@/components/AvatarPicker';
import PlayerAvatar from '@/components/PlayerAvatar';

type Stage = 'loading' | 'signed_out' | 'link_sent' | 'needs_profile' | 'has_profile';

export default function AccountPage() {
  const [stage, setStage] = useState<Stage>('loading');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [player, setPlayer] = useState<{ id: string; name: string; avatar: string | null } | null>(null);

  const [roster, setRoster] = useState<Player[]>([]);
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [newName, setNewName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  async function resolveState() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setStage('signed_out');
      return;
    }
    setUserId(session.user.id);
    const { data: profile } = await supabase.from('profiles').select('player_id').eq('user_id', session.user.id).maybeSingle();
    if (profile) {
      const { data: p } = await supabase.from('players').select('id, name, avatar').eq('id', profile.player_id).single();
      setPlayer(p);
      setStage('has_profile');
    } else {
      const { data: r } = await supabase.from('players').select('*').order('name');
      setRoster((r as Player[]) || []);
      setStage('needs_profile');
    }
  }

  useEffect(() => {
    resolveState();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) resolveState();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMagicLink() {
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    setSending(false);
    if (error) {
      alert(`Couldn't send the sign-in link: ${error.message}`);
      return;
    }
    setStage('link_sent');
  }

  async function createProfile() {
    if (!userId) return;
    setSaving(true);
    let playerId = selectedPlayerId;
    let name = roster.find((p) => p.id === selectedPlayerId)?.name ?? '';

    if (mode === 'new') {
      const trimmed = newName.trim();
      if (!trimmed) {
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.from('players').insert({ name: trimmed, avatar }).select().single();
      if (error || !data) {
        alert(`Couldn't create that player: ${error?.message ?? 'unknown error'}`);
        setSaving(false);
        return;
      }
      playerId = data.id;
      name = data.name;
    }

    if (!playerId) {
      setSaving(false);
      return;
    }

    const { error: profileErr } = await supabase.from('profiles').insert({ user_id: userId, player_id: playerId });
    if (profileErr) {
      alert(`Couldn't link your account: ${profileErr.message}`);
      setSaving(false);
      return;
    }
    const { error: avatarErr } = await supabase.from('players').update({ avatar }).eq('id', playerId);
    if (avatarErr) {
      alert(`Profile linked, but the avatar didn't save: ${avatarErr.message}`);
    }
    rememberPlayer(playerId, name);
    setPlayer({ id: playerId, name, avatar });
    setStage('has_profile');
    setSaving(false);
  }

  async function updateAvatar(newAvatar: string) {
    if (!player) return;
    const previous = player.avatar;
    setPlayer({ ...player, avatar: newAvatar });
    const { error } = await supabase.from('players').update({ avatar: newAvatar }).eq('id', player.id);
    if (error) {
      alert(`Couldn't save that avatar: ${error.message}`);
      setPlayer({ ...player, avatar: previous });
    }
  }

  async function saveName() {
    if (!player) return;
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('players').update({ name: trimmed }).eq('id', player.id);
    if (error) {
      alert(`Couldn't save that name: ${error.message}`);
      return;
    }
    rememberPlayer(player.id, trimmed);
    setPlayer({ ...player, name: trimmed });
    setEditingName(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPlayer(null);
    setUserId(null);
    setStage('signed_out');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          ← Home
        </Link>
        <h1 className="font-display text-lg">My account</h1>
        <span style={{ width: 32 }} />
      </div>

      {stage === 'loading' && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>
          Loading…
        </div>
      )}

      {stage === 'signed_out' && (
        <div className="card">
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            An account is optional — you can always just tap your name at the table. Sign up if you want an avatar
            and to be recognized automatically on any device.
          </p>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            Email
          </label>
          <input
            className="field-input mb-3"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button className="btn-primary" disabled={sending} onClick={sendMagicLink}>
            {sending ? 'Sending…' : 'Send me a sign-in link'}
          </button>
        </div>
      )}

      {stage === 'link_sent' && (
        <div className="card text-center">
          <p className="text-sm">
            Check <b>{email}</b> for a sign-in link. Open it on this device to finish setting up your profile.
          </p>
        </div>
      )}

      {stage === 'needs_profile' && (
        <div className="card">
          <h2 className="font-display text-lg mb-3">Set up your profile</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Link this account to your existing name, or create a new one.
          </p>

          <div className="flex gap-2 mb-4">
            <button
              className="btn-small"
              style={mode === 'pick' ? { background: '#c79a4b', color: '#0d2b22', border: 'none' } : undefined}
              onClick={() => setMode('pick')}
            >
              I already play
            </button>
            <button
              className="btn-small"
              style={mode === 'new' ? { background: '#c79a4b', color: '#0d2b22', border: 'none' } : undefined}
              onClick={() => setMode('new')}
            >
              I'm new
            </button>
          </div>

          {mode === 'pick' ? (
            <div className="mb-4">
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
                Find your name
              </label>
              <select
                className="field-input"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
              >
                <option value="">Select…</option>
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
                Your name
              </label>
              <input className="field-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Type your name" />
            </div>
          )}

          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            Pick an avatar
          </label>
          <div className="mb-4">
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          <button
            className="btn-primary"
            disabled={saving || (mode === 'pick' && !selectedPlayerId) || (mode === 'new' && !newName.trim())}
            onClick={createProfile}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      )}

      {stage === 'has_profile' && player && (
        <div className="card text-center">
          <div className="flex justify-center mb-3">
            <PlayerAvatar name={player.name} avatar={player.avatar} size={64} />
          </div>
          <div className="font-display text-lg mb-1">
            {editingName ? (
              <div className="flex items-center gap-2 justify-center">
                <input
                  className="field-input"
                  style={{ maxWidth: 180, textAlign: 'center' }}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                />
                <button className="btn-small" onClick={saveName}>
                  Save
                </button>
                <button className="btn-small" onClick={() => setEditingName(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2">
                {player.name}
                <button
                  className="text-xs underline"
                  style={{ color: 'var(--text-dim)' }}
                  onClick={() => {
                    setNameInput(player.name);
                    setEditingName(true);
                  }}
                >
                  Edit
                </button>
              </span>
            )}
          </div>
          <div className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
            Signed in — this device (and any other you log into) will recognize you automatically.
          </div>

          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            Change avatar
          </label>
          <div className="mb-5">
            <AvatarPicker value={player.avatar ?? AVATAR_OPTIONS[0]} onChange={updateAvatar} />
          </div>

          <Link href={`/player/${player.id}`} className="btn-ghost mb-2" style={{ display: 'block' }}>
            View my stats
          </Link>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
