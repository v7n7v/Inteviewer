import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interview Debrief | TalentConsulting',
  description: 'Log every interview, track question patterns, identify weak spots, and improve your confidence over time.',
  alternates: { canonical: '/suite/interview-debrief' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
