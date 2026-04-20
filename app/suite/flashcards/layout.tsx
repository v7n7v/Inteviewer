import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Interview Simulator — Practice with STAR-Graded Feedback',
  description: 'Practice behavioral interviews with AI-generated questions tailored to your target job. Get real-time STAR methodology grading and voice mode. Prep smarter, not harder.',
  alternates: { canonical: '/suite/flashcards' },
};

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
