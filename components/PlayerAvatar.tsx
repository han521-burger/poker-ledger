export default function PlayerAvatar({
  name,
  avatar,
  size = 36,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  if (avatar) {
    return (
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.55, background: '#0d2b22', border: '1px solid var(--line)' }}
      >
        {avatar}
      </div>
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: '#2f5f7a' }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
