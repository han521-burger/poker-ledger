'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { PlayerNet, Session, Transfer } from '@/lib/types';
import { fmt } from '@/lib/settlement';

export default function ResultPoster({
  session,
  nets,
  transfers,
  onClose,
}: {
  session: Session;
  nets: PlayerNet[];
  transfers: Transfer[];
  onClose: () => void;
}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const sorted = [...nets].sort((a, b) => (b.net ?? 0) - (a.net ?? 0));
  const mvp = sorted[0];
  const donkey = sorted[sorted.length - 1];
  const atm = [...nets].sort((a, b) => b.rebuyCount - a.rebuyCount)[0];

  async function savePoster() {
    if (!posterRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(posterRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `recap-${session.location}-${new Date(session.date).toLocaleDateString()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div ref={posterRef} className="rounded-2xl p-6" style={{ background: '#0d2b22', border: '1px solid var(--line)' }}>
          <div className="text-center mb-1">
            <div className="font-display text-2xl font-semibold" style={{ color: '#c79a4b' }}>
              Recap
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              {session.location} · {new Date(session.date).toLocaleDateString()} · Blinds {session.small_blind}/{session.big_blind}
            </div>
          </div>

          <div className="h-px my-4" style={{ background: 'var(--line)' }} />

          <div className="space-y-2 text-sm leading-7 mb-4">
            <div>
              🏆 MVP of the night: <b>{mvp?.name}</b>{' '}
              <span className="num" style={{ color: '#7fd39a' }}>{mvp ? fmt(mvp.net ?? 0) : ''}</span>
            </div>
            <div>
              💸 Biggest donor: <b>{donkey?.name}</b>{' '}
              <span className="num" style={{ color: '#e58579' }}>{donkey ? fmt(donkey.net ?? 0) : ''}</span>
            </div>
            <div>
              🏧 ATM of the night: <b>{atm?.name}</b> ({atm?.rebuyCount ?? 0} rebuys)
            </div>
          </div>

          <div className="h-px my-4" style={{ background: 'var(--line)' }} />

          <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
            Everyone's net
          </div>
          {sorted.map((n) => (
            <div key={n.playerId} className="flex items-center justify-between text-sm py-1">
              <span>{n.name}</span>
              <span className="num" style={{ color: (n.net ?? 0) >= 0 ? '#7fd39a' : '#e58579' }}>
                {fmt(n.net ?? 0)}
              </span>
            </div>
          ))}

          {transfers.length > 0 && (
            <>
              <div className="h-px my-4" style={{ background: 'var(--line)' }} />
              <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
                Settle up (fewest transfers)
              </div>
              {transfers.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>
                    {t.from} ➡️ {t.to}
                  </span>
                  <span className="num" style={{ color: '#c79a4b' }}>{fmt(t.amount)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="h-4" />
        <button className="btn-primary mb-2" disabled={saving} onClick={savePoster}>
          {saving ? 'Generating…' : 'Save recap image'}
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Done, back to home
        </button>
      </div>
    </div>
  );
}
