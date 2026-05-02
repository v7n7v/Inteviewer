import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'LinkedIn Optimizer',
  description: 'AI-powered profile optimization',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
