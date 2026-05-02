import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Resume Gallery',
  description: 'Browse professional resume templates',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
