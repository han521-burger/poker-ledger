export type SessionResult = {
  sessionId: string;
  date: string;
  net: number;
  totalBuyIn: number;
  rebuyCount: number;
};

export type Badge = {
  icon: string;
  name: string;
  description: string;
};

/**
 * Current streak from a chronologically-sorted (oldest → newest) list of
 * session results. Positive = win streak length, negative = losing streak
 * length (as a negative number), 0 = no games yet or last game was a wash.
 */
export function currentStreak(results: SessionResult[]): number {
  if (results.length === 0) return 0;
  const lastSign = Math.sign(results[results.length - 1].net);
  if (lastSign === 0) return 0;
  let count = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (Math.sign(results[i].net) === lastSign) count++;
    else break;
  }
  return lastSign > 0 ? count : -count;
}

export function computeBadges(results: SessionResult[], rank?: { position: number; total: number }): Badge[] {
  const badges: Badge[] = [];
  if (results.length === 0) return badges;

  if (results.some((r) => r.net > 0)) {
    badges.push({ icon: '🥇', name: 'First Win', description: 'Won at least one tracked session' });
  }

  if (results.length >= 5) {
    badges.push({ icon: '🎖️', name: 'Regular', description: 'Played 5+ tracked sessions' });
  }
  if (results.length >= 20) {
    badges.push({ icon: '🏆', name: 'Veteran', description: 'Played 20+ tracked sessions' });
  }

  const streak = currentStreak(results);
  if (streak >= 3) {
    badges.push({ icon: '🔥', name: 'On Fire', description: `Current ${streak}-game win streak` });
  }
  if (streak <= -3) {
    badges.push({ icon: '🧊', name: 'Cold Streak', description: `Current ${-streak}-game losing streak` });
  }

  const maxRebuys = Math.max(0, ...results.map((r) => r.rebuyCount - 1));
  if (maxRebuys >= 5) {
    badges.push({ icon: '🏧', name: 'ATM Night', description: 'Rebought 5+ times in a single session' });
  }

  const hadBigScore = results.some((r) => r.totalBuyIn > 0 && r.net + r.totalBuyIn >= 3 * r.totalBuyIn);
  if (hadBigScore) {
    badges.push({ icon: '💎', name: 'Big Score', description: 'Tripled your buy-in (or more) in a single session' });
  }

  if (rank) {
    if (rank.position === 1) {
      badges.push({ icon: '🦈', name: 'Table Shark', description: '#1 on the leaderboard' });
    } else if (rank.total > 1 && rank.position === rank.total) {
      badges.push({ icon: '🎗️', name: 'Biggest Donor', description: 'Last on the leaderboard' });
    }
  }

  return badges;
}
