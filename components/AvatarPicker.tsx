'use client';

export const AVATAR_OPTIONS = [
  '🃏', '♠️', '♣️', '♥️', '♦️',
  '🎲', '🎩', '🕶️', '🐯', '🦊',
  '🐻', '🐼', '🦁', '🐵', '🐸',
  '🦄', '🐺', '🐨', '🐹', '🦉',
  '🧧', '🪙', '💰', '🤑', '👑',
  '💎', '🦈', '🐉', '🍀', '🎰',
  '🔥', '😎', '🌟', '⚡', '🥃',
];

export default function AvatarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {AVATAR_OPTIONS.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className="aspect-square rounded-full flex items-center justify-center text-xl"
          style={{
            background: value === a ? 'rgba(199,154,75,0.25)' : '#0d2b22',
            border: value === a ? '1px solid #c79a4b' : '1px solid var(--line)',
          }}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
