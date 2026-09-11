'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Session } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [sb, setSb] = useState('1');
  const [bb, setBb] = useState('2');
  const [buyIn, setBuyIn] = useState('200');
  const [location, setLocation] = useState('');
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [recent, setRecent] = useState<Session[]>([]);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*')
      .eq('status', 'finished')
      .order('date', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecent((data as Session[]) || []));
  }, []);

  async function createSession() {
    setCreating(true);
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        small_blind: parseFloat(sb) || 1,
        big_blind: parseFloat(bb) || 2,
        buy_in: parseFloat(buyIn) || 200,
        location: location || '未命名地点',
        host_pin: pin || null,
        status: 'active',
      })
      .select()
      .single();
    setCreating(false);
    if (!error && data) {
      router.push(`/session/${data.id}`);
    }
  }

  return (
    <div>
      <header className="flex items-baseline justify-between pb-4 mb-5" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <div className="font-display text-2xl font-semibold">牌局账本</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            FELT &amp; LEDGER · 常客共享账本
          </div>
        </div>
        <Link href="/leaderboard" className="text-sm" style={{ color: 'var(--text-dim)' }}>
          排行榜 →
        </Link>
      </header>

      <div className="card mb-4">
        <h2 className="font-display text-lg mb-4">开一局新牌局</h2>
        <div className="flex gap-2.5 mb-3.5">
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
              小盲
            </label>
            <input className="field-input" type="number" value={sb} onChange={(e) => setSb(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
              大盲
            </label>
            <input className="field-input" type="number" value={bb} onChange={(e) => setBb(e.target.value)} />
          </div>
        </div>
        <div className="mb-3.5">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            标准买入金额
          </label>
          <input className="field-input" type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
        </div>
        <div className="mb-3.5">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            地点
          </label>
          <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="老王家" />
        </div>
        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            管账人 PIN（4位，可留空）
          </label>
          <input
            className="field-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="1234"
          />
        </div>
        <button className="btn-primary" disabled={creating} onClick={createSession}>
          {creating ? '创建中…' : '开局并生成入座二维码'}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <div className="text-xs mb-2.5" style={{ color: 'var(--text-dim)' }}>
            最近战报
          </div>
          {recent.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="flex items-center justify-between py-1.5 text-sm"
            >
              <span>
                {s.location} · {s.small_blind}/{s.big_blind}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
