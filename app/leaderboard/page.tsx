'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt } from '@/lib/settlement';
import { currentStreak, SessionResult } from '@/lib/achievements';
import PlayerAvatar from '@/components/PlayerAvatar';

type Row = { player_id: string; games: number; wins: number; net_sum: number; players: { name: string; avatar: string | null } | null };

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    async function run() {
      const { data: lb } = await supabase
        .from('leaderboard')
        .select('*, players(name, avatar)')
        .order('net_sum', { ascending: false });
      setRows((lb as Row[]) || []);

      // Compute each player's current streak from their full chronological
      // history. Pulled once in bulk and grouped client-side rather than
      // one query per player.
      const [{ data: sessionsData }, { data: seatsData }, { data: buyInsData }] = await Promise.all([
        supabase.from('sessions').select('id, date').eq('status', 'finished').eq('voided', false),
        supabase.from('seats').select('session_id, player_id, cash_out').eq('count_in_leaderboard', true),
        supabase.from('buy_ins').select('session_id, player_id, amount'),
      ]);

      const sessionsById = new Map((sessionsData || []).map((s) => [s.id, s]));
      const byPlayer = new Map<string, SessionResult[]>();

      (seatsData || []).forEach((seat) => {
        const s = sessionsById.get(seat.session_id);
        if (!s) return;
        const sessionBuyIns = (buyInsData || []).filter(
          (b) => b.session_id === seat.session_id && b.player_id === seat.player_id
        );
        const totalBuyIn = sessionBuyIns.reduce((a, b) => a + Number(b.amount), 0);
        const cashOut = seat.cash_out == null ? 0 : Number(seat.cash_out);
        const list = byPlayer.get(seat.player_id) || [];
        list.push({
          sessionId: seat.session_id,
          date: s.date,
          net: cashOut - totalBuyIn,
          totalBuyIn,
          rebuyCount: sessionBuyIns.length,
        });
        byPlayer.set(seat.player_id, list);
      });

      const streakMap = new Map<string, number>();
      byPlayer.forEach((results, playerId) => {
        const sorted = [...results].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        streakMap.set(playerId, currentStreak(sorted));
      });
      setStreaks(streakMap);
    }
    run();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          ← Home
        </Link>
        <h1 className="font-display text-lg">Leaderboard</h1>
        <span style={{ width: 32 }} />
      </div>

      <div className="card">
        {rows === null && <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>
            No results yet — settle a session to populate this
          </div>
        )}
        {rows &&
          rows.map((r, i) => {
            const streak = streaks.get(r.player_id) ?? 0;
            const isTop = i === 0;
            const isLast = rows.length > 1 && i === rows.length - 1;
            return (
              <Link
                key={r.player_id}
                href={`/player/${r.player_id}`}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: '1px solid var(--line)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm w-5" style={{ color: 'var(--text-dim)' }}>
                    {i + 1}
                  </span>
                  <PlayerAvatar name={r.players?.name || '?'} avatar={r.players?.avatar} size={30} />
                  <div>
                    <div className="text-sm">
                      {r.players?.name || '?'}
                      {isTop && <span className="ml-1.5">🦈</span>}
                      {isLast && <span className="ml-1.5">🎗️</span>}
                    </div>
                    {Math.abs(streak) >= 2 && (
                      <div className="text-xs" style={{ color: streak > 0 ? '#7fd39a' : '#e58579' }}>
                        {streak > 0 ? `🔥 ${streak}-game streak` : `🧊 ${-streak}-game skid`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num" style={{ color: r.net_sum >= 0 ? '#7fd39a' : '#e58579', fontWeight: 600 }}>
                    {fmt(r.net_sum)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {r.games} games · {r.games ? Math.round((r.wins / r.games) * 100) : 0}% win rate
                  </div>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
