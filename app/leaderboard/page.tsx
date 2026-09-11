'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt } from '@/lib/settlement';
import PlayerAvatar from '@/components/PlayerAvatar';

type Row = { player_id: string; games: number; wins: number; net_sum: number; players: { name: string; avatar: string | null } | null };

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    supabase
      .from('leaderboard')
      .select('*, players(name, avatar)')
      .order('net_sum', { ascending: false })
      .then(({ data }) => setRows((data as Row[]) || []));
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
          rows.map((r, i) => (
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
                <span className="text-sm">{r.players?.name || '?'}</span>
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
          ))}
      </div>
    </div>
  );
}
