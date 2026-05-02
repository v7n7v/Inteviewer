import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'AI Avatar Interview',
  description: 'Face-to-face mock interview with 3D AI interviewer',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
