import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Taco AI Agent',
  description: 'Your intelligent career companion',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
