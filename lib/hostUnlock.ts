// After a correct PIN entry (checked by the database), the host stays
// unlocked for this many minutes. The PIN itself is kept on this device for
// that window because every host action sends it to the database, which
// re-checks it — stored with an expiry so it survives a page refresh but
// still locks itself back after being idle.
const PREFIX = 'poker_ledger_unlock:';
const UNLOCK_MINUTES = 30;

type Unlock = { pin: string; until: number };

function read(sessionId: string): Unlock | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PREFIX + sessionId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Unlock;
    if (typeof parsed.pin === 'string' && Date.now() < parsed.until) return parsed;
  } catch {
    // fall through and clear the bad entry
  }
  window.localStorage.removeItem(PREFIX + sessionId);
  return null;
}

export function getUnlockedPin(sessionId: string): string | null {
  return read(sessionId)?.pin ?? null;
}

export function isUnlocked(sessionId: string): boolean {
  return read(sessionId) !== null;
}

export function setUnlocked(sessionId: string, pin: string) {
  if (typeof window === 'undefined') return;
  const unlock: Unlock = { pin, until: Date.now() + UNLOCK_MINUTES * 60 * 1000 };
  window.localStorage.setItem(PREFIX + sessionId, JSON.stringify(unlock));
}

export function clearUnlocked(sessionId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PREFIX + sessionId);
}

export function unlockMinutesRemaining(sessionId: string): number {
  const unlock = read(sessionId);
  if (!unlock) return 0;
  return Math.max(0, Math.ceil((unlock.until - Date.now()) / 60000));
}
