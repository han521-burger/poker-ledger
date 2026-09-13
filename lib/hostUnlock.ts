// After a correct PIN entry, the host stays unlocked for this many minutes —
// stored with an expiry timestamp so it survives a page refresh, but still
// locks itself back after being idle. Not tied to any one click.
const PREFIX = 'poker_ledger_unlock_until:';
const UNLOCK_MINUTES = 30;

export function isUnlocked(sessionId: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(PREFIX + sessionId);
  if (!raw) return false;
  const expiry = Number(raw);
  return !isNaN(expiry) && Date.now() < expiry;
}

export function setUnlocked(sessionId: string) {
  if (typeof window === 'undefined') return;
  const expiry = Date.now() + UNLOCK_MINUTES * 60 * 1000;
  window.localStorage.setItem(PREFIX + sessionId, String(expiry));
}

export function unlockMinutesRemaining(sessionId: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(PREFIX + sessionId);
  if (!raw) return 0;
  const expiry = Number(raw);
  if (isNaN(expiry)) return 0;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 60000));
}
