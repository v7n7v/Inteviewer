import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Oracle — AI Salary & Career Intelligence',
  description: 'Get AI-powered market intelligence: salary benchmarks, demand trends, skill gap analysis, and career trajectory insights for any role or industry.',
  alternates: { canonical: '/suite/market-oracle' },
};

export default function MarketOracleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
