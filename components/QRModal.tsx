'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

export default function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="modal-overlay">
      <div className="modal text-center">
        <h3 className="font-display text-lg mb-4">Scan or share the link to join</h3>
        <div className="bg-cream inline-block p-4 rounded-xl mb-4">
          <QRCodeSVG value={url} size={220} bgColor="#f1e8d6" fgColor="#0d2b22" />
        </div>
        <div
          className="text-xs break-all mb-4 p-3 rounded-lg"
          style={{ background: '#0d2b22', border: '1px solid var(--line)', color: 'var(--text-dim)' }}
        >
          {url}
        </div>
        <button
          className="btn-primary mb-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard may be unavailable, QR still works */
            }
          }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
