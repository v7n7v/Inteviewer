import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'JD Generator',
  description: 'AI job description creation tool',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
