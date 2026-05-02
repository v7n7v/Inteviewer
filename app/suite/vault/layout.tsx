import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Study Vault',
  description: 'Saved interview prep and practice notes',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
