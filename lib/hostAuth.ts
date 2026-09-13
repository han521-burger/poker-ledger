// Identifies which device started a given session, so the rebuy / cash-out /
// settle buttons are only shown to that device (or that logged-in account,
// see the created_by check in SessionView). This is visibility only — the
// PIN is still required on every click on top of this.
const PREFIX = 'poker_ledger_host_token:';

export function getHostToken(sessionId: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PREFIX + sessionId);
}

export function setHostToken(sessionId: string, token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFIX + sessionId, token);
}
