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

type SeatWithName = Seat & { players: { name: string } | null };

export default function SessionView({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [seats, setSeats] = useState<SeatWithName[]>([]);
  const [buyIns, setBuyIns] = useState<BuyIn[]>([]);
  const [loading, setLoading] = useState(true);

  const [hostUnlocked, setHostUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [rebuyFor, setRebuyFor] = useState<{ id: string; name: string } | null>(null);
  const [cashoutFor, setCashoutFor] = useState<{ id: string; name: string } | null>(null);
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
      supabase.from('seats').select('*, players(name)').eq('session_id', sessionId),
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

  // Realtime: any change to this session's rows re-fetches, so every phone
  // at the table sees buy-ins / cash-outs update without refreshing.
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
      };
    });
  }, [seats, buyIns]);

  const pot = nets.reduce((a, n) => a + n.totalBuyIn, 0);
  const allCashedOut = seats.length > 0 && seats.every((s) => s.cash_out != null);
  const totalCashOut = nets.reduce((a, n) => a + (n.cashOut || 0), 0);
  const diff = pot - totalCashOut;
  const balanced = allCashedOut && Math.abs(diff) < 0.01;
  const needsPin = !!session?.host_pin;
  const canManage = !needsPin || hostUnlocked;

  async function handleJoin(playerId: string, name: string) {
    await supabase.from('seats').insert({
      session_id: sessionId,
      player_id: playerId,
    });
    await supabase.from('buy_ins').insert({
      session_id: sessionId,
      player_id: playerId,
      amount: session?.buy_in || 0,
    });
    fireToast(`${name} 已入座`);
    load();
  }

  function guard(action: () => void) {
    if (canManage) action();
    else setShowPinModal(true);
  }

  async function doRebuy(playerId: string, amount: number) {
    await supabase.from('buy_ins').insert({ session_id: sessionId, player_id: playerId, amount });
    setRebuyFor(null);
    fireToast(`加买 ${fmt(amount)}`);
    load();
  }

  async function doCashout(playerId: string, amount: number) {
    await supabase
      .from('seats')
      .update({ cash_out: amount, has_left: true })
      .eq('session_id', sessionId)
      .eq('player_id', playerId);
    setCashoutFor(null);
    load();
  }

  async function undoCashout(playerId: string) {
    await supabase
      .from('seats')
      .update({ cash_out: null, has_left: false })
      .eq('session_id', sessionId)
      .eq('player_id', playerId);
    load();
  }

  async function finishSession() {
    if (!session) return;
    // Aggregate into the leaderboard view via a lightweight upsert per player.
    for (const n of nets) {
      await supabase.rpc('bump_leaderboard', {
        p_player_id: n.playerId,
        p_net: n.net ?? 0,
        p_won: (n.net ?? 0) > 0,
      });
    }
    await supabase.from('sessions').update({ status: 'finished' }).eq('id', sessionId);
    setShowResult(true);
    load();
  }

  if (loading) return <div className="text-center py-16 text-sm" style={{ color: 'var(--text-dim)' }}>加载中…</div>;
  if (!session) return <div className="text-center py-16 text-sm">找不到这场牌局</div>;

  const transfers = simplifyDebts(nets);
  const seatedPlayerIds = seats.map((s) => s.player_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          ← 首页
        </Link>
        <button className="btn-small" onClick={() => setShowQR(true)}>
          分享入座
        </button>
      </div>

      {session.status === 'active' && (
        <JoinPanel sessionId={sessionId} seatedPlayerIds={seatedPlayerIds} onJoined={handleJoin} />
      )}

      <div className="card mb-4 text-center">
        <div className="text-sm mb-2" style={{ color: 'var(--text-dim)' }}>
          {session.location} · 盲注 {session.small_blind}/{session.big_blind} · 标准买入 {fmt(session.buy_in)}
        </div>
        <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>
          当前池底总额
        </div>
        <div className="text-4xl font-semibold num" style={{ color: '#c79a4b' }}>
          {fmt(pot)}
        </div>
        {needsPin && !hostUnlocked && session.status === 'active' && (
          <button className="btn-ghost mt-3" onClick={() => setShowPinModal(true)}>
            🔒 解锁管账模式
          </button>
        )}
        {hostUnlocked && <div className="text-xs mt-3" style={{ color: '#c79a4b' }}>✓ 管账模式已解锁</div>}
      </div>

      <div className="card mb-4">
        {seats.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>
            还没有玩家，扫码分享或上方入座
          </div>
        )}
        {seats.map((seat) => {
          const n = nets.find((x) => x.playerId === seat.player_id)!;
          return (
            <div key={seat.id} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={{ background: '#2f5f7a' }}
                >
                  {n.name.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {n.name}{' '}
                    {seat.has_left ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(181,68,58,0.2)', color: '#e8a89f' }}>
                        已离场
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(199,154,75,0.2)', color: '#c79a4b' }}>
                        在场
                      </span>
                    )}
                  </div>
                  <div className="text-xs num" style={{ color: 'var(--text-dim)' }}>
                    买入 {fmt(n.totalBuyIn)}
                    {n.cashOut != null ? ` · 带走 ${fmt(n.cashOut)}` : ''}
                  </div>
                </div>
              </div>
              {session.status === 'active' && (
                <div className="flex gap-1.5">
                  {!seat.has_left && (
                    <button className="btn-small" onClick={() => guard(() => setRebuyFor({ id: seat.player_id, name: n.name }))}>
                      +加买
                    </button>
                  )}
                  {!seat.has_left && (
                    <button className="btn-small" onClick={() => guard(() => setCashoutFor({ id: seat.player_id, name: n.name }))}>
                      离场
                    </button>
                  )}
                  {seat.has_left && (
                    <button className="btn-small" onClick={() => guard(() => undoCashout(seat.player_id))}>
                      撤销
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {seats.length > 0 && session.status === 'active' && (
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
                ? '平账 ✓ 可以结算'
                : `差额 ${fmt(diff)}，请核对流水`
              : `等待所有人清点离场筹码（还差 ${seats.filter((s) => s.cash_out == null).length} 人）`}
          </div>
          <button className="btn-primary" disabled={!balanced} onClick={() => guard(finishSession)}>
            生成清算与战报
          </button>
        </div>
      )}

      {session.status === 'finished' && (
        <div className="card mb-4 text-center">
          <div className="mb-3" style={{ color: 'var(--text-dim)' }}>
            这场牌局已结算完成
          </div>
          <button className="btn-primary" onClick={() => setShowResult(true)}>
            查看战报
          </button>
        </div>
      )}

      {showPinModal && (
        <PinModal
          onConfirm={(pin) => {
            if (pin === session.host_pin) {
              setHostUnlocked(true);
              setShowPinModal(false);
              fireToast('管账模式已解锁');
            } else {
              fireToast('PIN 错误');
            }
          }}
          onCancel={() => setShowPinModal(false)}
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
