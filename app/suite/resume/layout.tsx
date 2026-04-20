import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Resume Studio — ATS-Optimized Resume Builder',
  description: 'Build and morph your resume to match any job description. AI-powered keyword injection, ATS optimization, 18+ templates, PDF & Word export. Free to try.',
  alternates: { canonical: '/suite/resume' },
};

export default function ResumeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
