'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Session } from '@/lib/types';
import { setHostToken } from '@/lib/hostAuth';
import NavMenu from '@/components/NavMenu';

export default function HomePage() {
  const router = useRouter();
  const [sb, setSb] = useState('0.20');
  const [bb, setBb] = useState('0.40');
  const [buyIn, setBuyIn] = useState('40');
  const [location, setLocation] = useState('Monash Logan Hall');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [recent, setRecent] = useState<Session[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*')
      .eq('status', 'finished')
      .eq('voided', false)
      .order('date', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecent((data as Session[]) || []));
  }, []);

  async function createSession() {
    if (!/^\d{4}$/.test(pin)) {
      setPinError('Enter a 4-digit PIN to start a session');
      return;
    }
    setPinError('');
    setCreating(true);
    // The PIN goes into a private table the page can't read back; the
    // function returns this device's host token alongside the new id.
    const { data, error } = await supabase.rpc('create_session', {
      p_small_blind: parseFloat(sb) || 1,
      p_big_blind: parseFloat(bb) || 2,
      p_buy_in: parseFloat(buyIn) || 200,
      p_location: location,
      p_pin: pin,
    });
    if (error || !data) {
      setCreating(false);
      alert(`Couldn't start the session: ${error?.message ?? 'unknown error'}`);
      return;
    }
    // `creating` stays true until we navigate away, so a second tap can't
    // start a duplicate session.
    const created = data as { id: string; host_token: string };
    setHostToken(created.id, created.host_token);
    try {
      await navigator.clipboard.writeText(pin);
      setToast('PIN copied to clipboard — paste it to share with a co-host');
    } catch {
      // Clipboard access can fail (permissions, insecure context); not
      // worth blocking the flow over, the PIN is still shown on screen.
    }
    setTimeout(() => router.push(`/session/${created.id}`), 700);
  }

  return (
    <div>
      <header className="flex items-center justify-between pb-4 mb-5" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <div className="font-display text-2xl font-semibold">Poker Ledger</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            FELT &amp; LEDGER · shared home-game bankroll
          </div>
        </div>
        <NavMenu />
      </header>

      <div className="card mb-4">
        <h2 className="font-display text-lg mb-4">Start a new session</h2>
        <div className="flex gap-2.5 mb-3.5">
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
              Small blind
            </label>
            <input className="field-input" type="number" value={sb} onChange={(e) => setSb(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
              Big blind
            </label>
            <input className="field-input" type="number" value={bb} onChange={(e) => setBb(e.target.value)} />
          </div>
        </div>
        <div className="mb-3.5">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            Standard buy-in
          </label>
          <input className="field-input" type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
        </div>
        <div className="mb-3.5">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            Location
          </label>
          <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mike's place" />
        </div>
        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
            Host PIN (4 digits, required — you'll enter this every time you rebuy, cash someone out, or settle)
          </label>
          <input
            className="field-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setPinError('');
            }}
            placeholder="1234"
          />
          {pinError && (
            <div className="text-xs mt-1.5" style={{ color: '#e58579' }}>
              {pinError}
            </div>
          )}
        </div>
        <button className="btn-primary" disabled={creating} onClick={createSession}>
          {creating ? 'Creating…' : 'Start session and generate join QR code'}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <div className="text-xs mb-2.5" style={{ color: 'var(--text-dim)' }}>
            Recent recaps
          </div>
          {recent.map((s) => (
            <Link key={s.id} href={`/session/${s.id}`} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {s.location} · {s.small_blind}/{s.big_blind}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
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
