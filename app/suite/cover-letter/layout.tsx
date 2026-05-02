import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'AI Cover Letter Generator',
  description: 'Generate tailored cover letters in seconds',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
