import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Network CRM',
  description: 'Manage your professional connections',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
