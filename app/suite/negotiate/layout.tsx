import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'AI Salary Coach',
  description: 'Data-driven negotiation strategy',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
