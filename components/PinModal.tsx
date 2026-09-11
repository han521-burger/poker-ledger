'use client';

import { useState } from 'react';

export default function PinModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 className="font-display text-lg mb-4">解锁管账模式</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
          输入房主设置的 4 位 PIN，解锁后本设备可以加买 / 离场 / 结算，直到刷新页面为止。
        </p>
        <input
          className="field-input mb-4"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="4位密码"
        />
        <button className="btn-primary mb-2" onClick={() => onConfirm(pin)}>
          确认
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
