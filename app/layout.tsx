import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Poker Ledger', description: 'x' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><div className="max-w-[480px] mx-auto px-[18px] pb-20 pt-5">{children}</div></body></html>);
}
