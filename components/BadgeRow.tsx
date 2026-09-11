import { Badge } from '@/lib/achievements';

export default function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {badges.map((b) => (
        <div
          key={b.name}
          title={b.description}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
          style={{ background: 'rgba(199,154,75,0.12)', border: '1px solid rgba(199,154,75,0.4)', color: '#c79a4b' }}
        >
          <span>{b.icon}</span>
          <span>{b.name}</span>
        </div>
      ))}
    </div>
  );
}
