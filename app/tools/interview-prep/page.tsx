import type { Metadata } from 'next';
import InterviewPrepLanding from './InterviewPrepLanding';

export const metadata: Metadata = {
  title: 'AI Interview Practice — Master Behavioral & Technical Interviews',
  description: 'Practice job interviews with AI-powered mock sessions. Get real-time feedback on your STAR method answers, behavioral questions, and technical responses. Personalized coaching based on your target role.',
  keywords: [
    'AI interview practice',
    'mock interview AI',
    'AI interview prep',
    'behavioral interview practice',
    'STAR method practice',
    'interview simulator',
    'AI interview coach',
    'practice interview questions',
    'job interview preparation',
    'AI mock interview free',
  ],
  openGraph: {
    title: 'AI Interview Practice — Talent Studio',
    description: 'Practice job interviews with AI. Get real-time feedback on STAR answers.',
    url: 'https://talentconsulting.io/tools/interview-prep',
  },
  alternates: {
    canonical: '/tools/interview-prep',
  },
};

export default function InterviewPrepPage() {
  return <InterviewPrepLanding />;
}
