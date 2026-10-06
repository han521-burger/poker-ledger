'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Session } from '@/lib/types';
import { fmt } from '@/lib/settlement';

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadPage(offset: number) {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'finished')
      .order('date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    const page = (data as Session[]) || [];
    setSessions((prev) => (offset === 0 ? page : [...(prev || []), ...page]));
    setHasMore(page.length === PAGE_SIZE);
  }

  useEffect(() => {
    loadPage(0);
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    await loadPage(sessions?.length ?? 0);
    setLoadingMore(false);
  }

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
                <div className="text-sm font-medium">
                  {s.location}
                  {s.voided && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full ml-1.5"
                      style={{ background: 'rgba(181,68,58,0.2)', color: '#e8a89f' }}
                    >
                      Voided
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  Blinds {s.small_blind}/{s.big_blind} · buy-in {fmt(s.buy_in)}
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {new Date(s.date).toLocaleDateString()}
              </span>
            </Link>
          ))}
        {hasMore && (
          <button className="btn-ghost mt-3" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
