import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Free, Standard & Max Plans',
  description: 'Compare Talent Standard for connected application work and Talent Max for Taco-led scouting, truth-locked packets, and review-first alerts.',
  alternates: { canonical: '/suite/upgrade' },
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
