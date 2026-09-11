// "本地设备自动记忆" — remembers which player this browser belongs to,
// so returning on the same phone skips the name-picking step.
const KEY = 'poker_ledger_player_id';
const NAME_KEY = 'poker_ledger_player_name';

export function getRememberedPlayer(): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  const id = window.localStorage.getItem(KEY);
  const name = window.localStorage.getItem(NAME_KEY);
  if (!id || !name) return null;
  return { id, name };
}

export function rememberPlayer(id: string, name: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, id);
  window.localStorage.setItem(NAME_KEY, name);
}

export function forgetPlayer() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(NAME_KEY);
}
