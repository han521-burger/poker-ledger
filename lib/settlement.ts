import { PlayerNet, Transfer } from './types';

/**
 * Greedy debt-simplification: repeatedly match the largest creditor with the
 * largest debtor. Produces the minimum number of transfers to settle a set
 * of net positions that sum to (approximately) zero.
 */
export function simplifyDebts(nets: PlayerNet[]): Transfer[] {
  const creditors = nets
    .filter((n) => (n.net ?? 0) > 0.01)
    .map((n) => ({ name: n.name, amt: n.net as number }))
    .sort((a, b) => b.amt - a.amt);

  const debtors = nets
    .filter((n) => (n.net ?? 0) < -0.01)
    .map((n) => ({ name: n.name, amt: -(n.net as number) }))
    .sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }

  return transfers;
}

export function fmt(n: number): string {
  const rounded = Math.round(n);
  return (rounded < 0 ? '-$' : '$') + Math.abs(rounded).toLocaleString();
}
