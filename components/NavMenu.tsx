'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 8,
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f1e8d6',
        }}
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path d="M0 1H18" stroke="currentColor" strokeWidth="1.6" />
          <path d="M0 7H18" stroke="currentColor" strokeWidth="1.6" />
          <path d="M0 13H18" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 46,
            background: '#123b2e',
            border: '1px solid var(--line)',
            borderRadius: 12,
            minWidth: 170,
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          {[
            { href: '/account', label: 'My account' },
            { href: '/leaderboard', label: 'Leaderboard' },
            { href: '/history', label: 'History' },
          ].map((item, i, arr) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block text-sm"
              style={{
                padding: '12px 16px',
                color: '#f1e8d6',
                borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
