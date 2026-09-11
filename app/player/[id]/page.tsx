'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { fmt } from '@/lib/settlement';
import PlayerAvatar from '@/components/PlayerAvatar';

type Point = {
  sessionId: string;
  date: string;
  location: string;
  net: number;
  cumulative: number;
};

export default function PlayerPage({ params }: { params: { id: string } }) {
  const playerId = params.id;
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    async function run() {
      const { data: player } = await supabase.from('players').select('name, avatar').eq('id', playerId).single();
      setName(player?.name ?? 'Unknown player');
      setAvatar(player?.avatar ?? null);

      const { data: mySeats } = await supabase
        .from('seats')
        .select('session_id, cash_out')
        .eq('player_id', playerId)
        .eq('count_in_leaderboard', true);

      if (!mySeats || mySeats.length === 0) {
        setPoints([]);
        return;
      }

      const sessionIds = mySeats.map((s) => s.session_id);

      const [{ data: sessionsData }, { data: myBuyIns }] = await Promise.all([
        supabase.from('sessions').select('id, date, location, status').in('id', sessionIds).eq('status', 'finished'),
        supabase.from('buy_ins').select('session_id, amount').eq('player_id', playerId).in('session_id', sessionIds),
      ]);

      const finishedIds = new Set((sessionsData || []).map((s) => s.id));
      const sessionsById = new Map((sessionsData || []).map((s) => [s.id, s]));

      const rows: Point[] = mySeats
        .filter((seat) => finishedIds.has(seat.session_id))
        .map((seat) => {
          const totalBuyIn = (myBuyIns || [])
            .filter((b) => b.session_id === seat.session_id)
            .reduce((a, b) => a + Number(b.amount), 0);
          const cashOut = seat.cash_out == null ? 0 : Number(seat.cash_out);
          const s = sessionsById.get(seat.session_id)!;
          return {
            sessionId: seat.session_id,
            date: s.date,
            location: s.location,
            net: cashOut - totalBuyIn,
            cumulative: 0,
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let running = 0;
      for (const r of rows) {
        running += r.net;
        r.cumulative = running;
      }

      setPoints(rows);
    }
    run();
  }, [playerId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <Link href="/leaderboard" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          ← Leaderboard
        </Link>
        <div className="flex items-center gap-2">
          {name && <PlayerAvatar name={name} avatar={avatar} size={28} />}
          <h1 className="font-display text-lg">{name ?? '…'}</h1>
        </div>
        <span style={{ width: 32 }} />
      </div>

      {points === null && <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</div>}

      {points && points.length === 0 && (
        <div className="card">
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>
            No leaderboard-tracked sessions yet for this player
          </div>
        </div>
      )}

      {points && points.length > 0 && (
        <>
          <div className="card mb-4">
            <div className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              Cumulative net over time
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={points} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(241,232,214,0.1)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fill: 'rgba(241,232,214,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(241,232,214,0.14)' }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: 'rgba(241,232,214,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d2b22', border: '1px solid rgba(241,232,214,0.14)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
                    formatter={(value: number) => [fmt(value), 'Cumulative net']}
                  />
                  <Line type="monotone" dataKey="cumulative" stroke="#c79a4b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
              Session by session
            </div>
            {[...points].reverse().map((p) => (
              <Link
                key={p.sessionId}
                href={`/session/${p.sessionId}`}
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: '1px solid var(--line)' }}
              >
                <div>
                  <div className="text-sm">{p.location}</div>
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {new Date(p.date).toLocaleDateString()}
                  </div>
                </div>
                <span className="num text-sm" style={{ color: p.net >= 0 ? '#7fd39a' : '#e58579' }}>
                  {fmt(p.net)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
