'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BuyIn, PlayerNet, Seat, Session } from '@/lib/types';
import { simplifyDebts, fmt } from '@/lib/settlement';
import JoinPanel from './JoinPanel';
import PinModal from './PinModal';
import RebuyModal from './RebuyModal';
import CashoutModal from './CashoutModal';
import QRModal from './QRModal';
import ResultPoster from './ResultPoster';
import BuyInsModal from './BuyInsModal';
import PlayerAvatar from './PlayerAvatar';
import AddPlayerModal from './AddPlayerModal';
import PinResetModal from './PinResetModal';
import TakeoverModal from './TakeoverModal';
import { getHostToken, setHostToken } from '@/lib/hostAuth';
import { isUnlocked, setUnlocked, unlockMinutesRemaining } from '@/lib/hostUnlock';

type SeatWithName = Seat & { players: { name: string; avatar: string | null } | null };

export default function SessionView({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [seats, setSeats] = useState<SeatWithName[]>([]);
  const [buyIns, setBuyIns] = useState<BuyIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [unlockTick, setUnlockTick] = useState(0); // bump to force a re-render when unlock state changes

  // pendingAction holds the function to run once the PIN checks out (skipped
  // entirely if the host already unlocked within the last 30 minutes).
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [rebuyFor, setRebuyFor] = useState<{ id: string; name: string } | null>(null);
  const [cashoutFor, setCashoutFor] = useState<{ id: string; name: string } | null>(null);
  const [recordsFor, setRecordsFor] = useState<{ id: string; name: string } | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [showTakeover, setShowTakeover] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  const fireToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const load = useCallback(async () => {
    const [{ data: s }, { data: st }, { data: bi }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('seats').select('*, players(name, avatar)').eq('session_id', sessionId),
      supabase.from('buy_ins').select('*').eq('session_id', sessionId),
    ]);
    setSession(s as Session);
    setSeats((st as SeatWithName[]) || []);
    setBuyIns((bi as BuyIn[]) || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
    setShareUrl(typeof window !== 'undefined' ? window.location.href : '');
  }, [load]);

  // Visibility of the host-only buttons: this device created the session
  // (local token match) or this logged-in account created it (works across
  // that account's devices). Either way, every click still re-prompts PIN.
  useEffect(() => {
    async function resolveHost() {
      if (!session) return;
      const stored = getHostToken(sessionId);
      if (stored && stored === session.host_token) {
        setIsHost(true);
        return;
      }
      if (session.created_by) {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        setIsHost(!!authSession && authSession.user.id === session.created_by);
        return;
      }
      setIsHost(false);
    }
    resolveHost();
  }, [session, sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats', filter: `session_id=eq.${sessionId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buy_ins', filter: `session_id=eq.${sessionId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, load]);

  const nets: PlayerNet[] = useMemo(() => {
    return seats.map((seat) => {
      const seatBuyIns = buyIns.filter((b) => b.player_id === seat.player_id);
      const totalBuyIn = seatBuyIns.reduce((a, b) => a + Number(b.amount), 0);
      const cashOut = seat.cash_out == null ? null : Number(seat.cash_out);
      return {
        playerId: seat.player_id,
        name: seat.players?.name || '?',
        totalBuyIn,
        cashOut,
        net: cashOut == null ? null : cashOut - totalBuyIn,
        left: seat.has_left,
        rebuyCount: seatBuyIns.length,
        countInLeaderboard: seat.count_in_leaderboard,
      };
    });
  }, [seats, buyIns]);

  const pot = nets.reduce((a, n) => a + n.totalBuyIn, 0);
  const allCashedOut = seats.length > 0 && seats.every((s) => s.cash_out != null);
  const totalCashOut = nets.reduce((a, n) => a + (n.cashOut || 0), 0);
  const potCents = Math.round(pot * 100);
  const cashOutCents = Math.round(totalCashOut * 100);
  const diff = (potCents - cashOutCents) / 100;
  const balanced = allCashedOut && potCents === cashOutCents;

  function requirePin(action: () => void) {
    if (isUnlocked(sessionId)) {
      action();
      return;
    }
    setPendingAction(() => action);
  }

  async function handleJoin(playerId: string, name: string, countInLeaderboard: boolean) {
    const { error: seatErr } = await supabase.from('seats').insert({
      session_id: sessionId,
      player_id: playerId,
      count_in_leaderboard: countInLeaderboard,
    });
    if (seatErr) {
      fireToast(`Couldn't seat ${name}: ${seatErr.message}`);
      return;
    }
    const { error: buyInErr } = await supabase.from('buy_ins').insert({
      session_id: sessionId,
      player_id: playerId,
      amount: session?.buy_in || 0,
    });
    if (buyInErr) {
      fireToast(`Seated, but the initial buy-in failed: ${buyInErr.message}`);
      load();
      return;
    }
    fireToast(`${name} took a seat`);
    load();
  }

  async function doRebuy(playerId: string, amount: number) {
    const { error } = await supabase.from('buy_ins').insert({ session_id: sessionId, player_id: playerId, amount });
    setRebuyFor(null);
    if (error) {
      fireToast(`Rebuy failed: ${error.message}`);
      return;
    }
    fireToast(`Rebuy ${fmt(amount)}`);
    load();
  }

  async function doCashout(playerId: string, amount: number) {
    const { error } = await supabase
      .from('seats')
      .update({ cash_out: amount, has_left: true })
      .eq('session_id', sessionId)
      .eq('player_id', playerId);
    setCashoutFor(null);
    if (error) {
      fireToast(`Cash out failed: ${error.message}`);
      return;
    }
    load();
  }

  async function undoCashout(playerId: string) {
    const { error } = await supabase
      .from('seats')
      .update({ cash_out: null, has_left: false })
      .eq('session_id', sessionId)
      .eq('player_id', playerId);
    if (error) {
      fireToast(`Undo failed: ${error.message}`);
      return;
    }
    load();
  }

  async function finishSession() {
    if (!session) return;
    // Only aggregate into the persistent leaderboard for players who opted
    // in for this session; everyone still shows up in the recap poster below.
    for (const n of nets) {
      if (!n.countInLeaderboard) continue;
      const { error } = await supabase.rpc('bump_leaderboard', {
        p_player_id: n.playerId,
        p_net: n.net ?? 0,
        p_won: (n.net ?? 0) > 0,
      });
      if (error) {
        fireToast(`Leaderboard update failed for ${n.name}: ${error.message}`);
      }
    }
    const { error } = await supabase.from('sessions').update({ status: 'finished' }).eq('id', sessionId);
    if (error) {
      fireToast(`Settle failed: ${error.message}`);
      return;
    }
    setShowResult(true);
    load();
  }

  async function resetPin(newPin: string) {
    const { error } = await supabase.from('sessions').update({ host_pin: newPin }).eq('id', sessionId);
    if (error) {
      fireToast(`Couldn't update PIN: ${error.message}`);
      return;
    }
    setUnlocked(sessionId);
    setUnlockTick((t) => t + 1);
    setShowPinReset(false);
    try {
      await navigator.clipboard.writeText(newPin);
      fireToast('PIN updated and copied to clipboard');
    } catch {
      fireToast('PIN updated');
    }
    load();
  }

  async function takeover(currentPin: string, newPin: string) {
    if (!session) return;
    if (currentPin !== session.host_pin) {
      fireToast('Incorrect current PIN');
      return;
    }
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    // A fresh host_token invalidates every other device's local copy, and
    // clearing created_by revokes the previous host's account-wide access —
    // this device (or account, if signed in) becomes the only recognized host.
    const { data, error } = await supabase
      .from('sessions')
      .update({
        host_pin: newPin,
        host_token: crypto.randomUUID(),
        created_by: authSession?.user?.id ?? null,
      })
      .eq('id', sessionId)
      .select()
      .single();
    if (error || !data) {
      fireToast(`Couldn't take over: ${error?.message ?? 'unknown error'}`);
      return;
    }
    setHostToken(sessionId, data.host_token);
    setIsHost(true);
    setUnlocked(sessionId);
    setUnlockTick((t) => t + 1);
    setShowTakeover(false);
    try {
      await navigator.clipboard.writeText(newPin);
      fireToast('You are now the host — new PIN copied to clipboard');
    } catch {
      fireToast('You are now the host');
    }
    load();
  }

  async function voidSession() {
    const ok = window.confirm(
      "Void this session? It'll be closed without settling or affecting anyone's leaderboard stats. This can't be undone."
    );
    if (!ok) return;
    const { error } = await supabase.from('sessions').update({ status: 'finished', voided: true }).eq('id', sessionId);
    if (error) {
      fireToast(`Couldn't void session: ${error.message}`);
      return;
    }
    fireToast('Session voided');
    load();
  }

  if (loading) return <div className="text-center py-16 text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</div>;
  if (!session) return <div className="text-center py-16 text-sm">This session could not be found</div>;

  const transfers = simplifyDebts(nets);
  const seatedPlayerIds = seats.map((s) => s.player_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          ← Home
        </Link>
        <button className="btn-small" onClick={() => setShowQR(true)}>
          Share join link
        </button>
      </div>

      {session.status === 'active' && (
        <JoinPanel sessionId={sessionId} seatedPlayerIds={seatedPlayerIds} onJoined={handleJoin} />
      )}

      <div className="card mb-4 text-center">
        <div className="text-sm mb-2" style={{ color: 'var(--text-dim)' }}>
          {session.location} · Blinds {session.small_blind}/{session.big_blind} · Standard buy-in {fmt(session.buy_in)}
        </div>
        <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>
          Total buy-ins
        </div>
        <div className="text-4xl font-semibold num" style={{ color: '#c79a4b' }}>
          {fmt(pot)}
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
          Still on the table: <span className="num" style={{ color: '#c79a4b' }}>{fmt(diff)}</span>
        </div>
        {isHost && session.status === 'active' && (
          <>
            {isUnlocked(sessionId) ? (
              <div className="text-xs mt-3" style={{ color: '#c79a4b' }}>
                🔓 Unlocked for {unlockMinutesRemaining(sessionId)} more min
              </div>
            ) : (
              <div className="text-xs mt-3" style={{ color: 'var(--text-dim)' }}>
                🔒 Enter PIN on your next action to unlock for 30 min
              </div>
            )}
            <button className="btn-ghost mt-3" onClick={() => requirePin(() => setShowAddPlayer(true))}>
              + Add player
            </button>
            <button
              className="text-xs mt-3 underline"
              style={{ color: 'var(--text-dim)' }}
              onClick={() => setShowPinReset(true)}
            >
              Forgot PIN? Reset it
            </button>
          </>
        )}
      </div>

      <div className="card mb-4">
        {seats.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>
            No players yet — share the join link or scan the QR code above
          </div>
        )}
        {seats.length > 0 && session.status === 'active' && !isHost && (
          <div className="text-xs mb-3 text-center" style={{ color: 'var(--text-dim)' }}>
            Only the host can manage rebuys, cash-outs, and settlement.{' '}
            <button className="underline" onClick={() => setShowTakeover(true)} style={{ color: 'var(--text-dim)' }}>
              Host gone? Take over
            </button>
          </div>
        )}
        {seats.map((seat) => {
          const n = nets.find((x) => x.playerId === seat.player_id)!;
          const seatBuyIns = buyIns.filter((b) => b.player_id === seat.player_id);
          return (
            <div key={seat.id} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-3">
                <PlayerAvatar name={n.name} avatar={seat.players?.avatar} size={36} />
                <div>
                  <div className="text-sm font-medium">
                    {n.name}{' '}
                    {seat.has_left ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(181,68,58,0.2)', color: '#e8a89f' }}>
                        left
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(199,154,75,0.2)', color: '#c79a4b' }}>
                        active
                      </span>
                    )}
                    {!seat.count_in_leaderboard && (
                      <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(47,95,122,0.25)', color: '#8fb8d1' }}>
                        not on leaderboard
                      </span>
                    )}
                  </div>
                  <div className="text-xs num" style={{ color: 'var(--text-dim)' }}>
                    Bought in {fmt(n.totalBuyIn)}
                    {n.cashOut != null ? ` · cashed out ${fmt(n.cashOut)}` : ''}
                  </div>
                </div>
              </div>
              {isHost && session.status === 'active' && (
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <button className="btn-small" onClick={() => requirePin(() => setRecordsFor({ id: seat.player_id, name: n.name }))}>
                    Records
                  </button>
                  {!seat.has_left && (
                    <button className="btn-small" onClick={() => requirePin(() => setRebuyFor({ id: seat.player_id, name: n.name }))}>
                      + Rebuy
                    </button>
                  )}
                  {!seat.has_left && (
                    <button className="btn-small" onClick={() => requirePin(() => setCashoutFor({ id: seat.player_id, name: n.name }))}>
                      Cash out
                    </button>
                  )}
                  {seat.has_left && (
                    <button className="btn-small" onClick={() => requirePin(() => undoCashout(seat.player_id))}>
                      Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isHost && seats.length > 0 && session.status === 'active' && (
        <div className="card mb-4 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          {allCashedOut
            ? balanced
              ? 'Balanced ✓ — waiting on the host to settle'
              : 'Off balance — the host is double-checking the log'
            : `Waiting on everyone to cash out (${seats.filter((s) => s.cash_out == null).length} left)`}
        </div>
      )}

      {isHost && seats.length > 0 && session.status === 'active' && (
        <div className="card mb-4">
          <div
            className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm mb-3"
            style={{
              background: balanced ? 'rgba(76,145,102,0.18)' : 'rgba(181,68,58,0.2)',
              color: balanced ? '#a6d9b6' : '#f0a89e',
            }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: balanced ? '#5fbf7f' : '#e05c4d' }} />
            {allCashedOut
              ? balanced
                ? 'Balanced ✓ ready to settle'
                : `Off by ${fmt(diff)} — double check the log`
              : `Waiting on everyone to cash out (${seats.filter((s) => s.cash_out == null).length} left)`}
          </div>
          <button className="btn-primary" disabled={!balanced} onClick={() => requirePin(finishSession)}>
            Settle and generate recap
          </button>
        </div>
      )}

      {isHost && session.status === 'active' && (
        <div className="text-center mb-4">
          <button className="text-xs underline" style={{ color: 'var(--text-dim)' }} onClick={() => requirePin(voidSession)}>
            Made a mistake? Void this session instead
          </button>
        </div>
      )}

      {session.status === 'finished' && (
        <div className="card mb-4 text-center">
          {session.voided ? (
            <div style={{ color: 'var(--text-dim)' }}>This session was voided — no stats were recorded</div>
          ) : (
            <>
              <div className="mb-3" style={{ color: 'var(--text-dim)' }}>
                This session has been settled
              </div>
              <button className="btn-primary" onClick={() => setShowResult(true)}>
                View recap
              </button>
            </>
          )}
        </div>
      )}

      {pendingAction && (
        <PinModal
          onConfirm={(pin) => {
            if (pin === session.host_pin) {
              setUnlocked(sessionId);
              setUnlockTick((t) => t + 1);
              const action = pendingAction;
              setPendingAction(null);
              action();
            } else {
              fireToast('Incorrect PIN');
            }
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {rebuyFor && (
        <RebuyModal
          playerName={rebuyFor.name}
          defaultAmount={session.buy_in}
          onConfirm={(amt) => doRebuy(rebuyFor.id, amt)}
          onCancel={() => setRebuyFor(null)}
        />
      )}

      {cashoutFor && (
        <CashoutModal
          playerName={cashoutFor.name}
          onConfirm={(amt) => doCashout(cashoutFor.id, amt)}
          onCancel={() => setCashoutFor(null)}
        />
      )}

      {recordsFor && (
        <BuyInsModal
          playerName={recordsFor.name}
          buyIns={buyIns.filter((b) => b.player_id === recordsFor.id)}
          onChanged={load}
          onClose={() => setRecordsFor(null)}
        />
      )}

      {showPinReset && <PinResetModal onConfirm={resetPin} onCancel={() => setShowPinReset(false)} />}

      {showTakeover && (
        <TakeoverModal onConfirm={takeover} onCancel={() => setShowTakeover(false)} />
      )}

      {showAddPlayer && (
        <AddPlayerModal
          seatedPlayerIds={seatedPlayerIds}
          onAdd={handleJoin}
          onClose={() => setShowAddPlayer(false)}
        />
      )}

      {showQR && <QRModal url={shareUrl} onClose={() => setShowQR(false)} />}

      {showResult && (
        <ResultPoster
          session={session}
          nets={nets}
          transfers={transfers}
          onClose={() => setShowResult(false)}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium shadow-lg z-[200]"
          style={{ background: '#f1e8d6', color: '#0d2b22' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
