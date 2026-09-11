'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Session } from '@/lib/types';
import { fmt } from '@/lib/settlement';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*')
      .eq('status', 'finished')
      .order('date', { ascending: false })
      .limit(50)
      .then(({ data }) => setSessions((data as Session[]) || []));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          ← Home
        </Link>
        <h1 className="font-display text-lg">Session history</h1>
        <span style={{ width: 32 }} />
      </div>

      <div className="card">
        {sessions === null && <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</div>}
        {sessions && sessions.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-dim)' }}>
            No settled sessions yet
          </div>
        )}
        {sessions &&
          sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <div>
                <div className="text-sm font-medium">{s.location}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  Blinds {s.small_blind}/{s.big_blind} · buy-in {fmt(s.buy_in)}
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {new Date(s.date).toLocaleDateString()}
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}
