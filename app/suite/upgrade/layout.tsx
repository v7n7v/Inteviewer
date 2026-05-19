import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Free, Pro & Studio Plans',
  description: 'Start free with 3 resume morphs, 3 interviews, and AI detection. Upgrade to Pro or Max for higher-limit AI career tools.',
  alternates: { canonical: '/suite/upgrade' },
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
