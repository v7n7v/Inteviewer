import type { Metadata } from 'next';
import ResumeBuilderLanding from './ResumeBuilderLanding';

export const metadata: Metadata = {
  title: 'Free AI Resume Builder 2026 — Create ATS-Optimized Resumes in Minutes',
  description: 'Build a professional, ATS-optimized resume in minutes with our free AI resume builder. Upload your resume or start from scratch. Powered by Gemini AI with real-time ATS scoring and keyword optimization.',
  keywords: [
    'AI resume builder',
    'free resume builder',
    'ATS resume builder',
    'AI resume maker',
    'resume builder 2026',
    'create resume online free',
    'ATS optimized resume',
    'resume generator AI',
    'professional resume builder',
    'resume builder with AI',
  ],
  openGraph: {
    title: 'Free AI Resume Builder — Talent Studio',
    description: 'Build ATS-optimized resumes in minutes with AI. Free to start.',
    url: 'https://talentconsulting.io/tools/resume-builder',
  },
  alternates: {
    canonical: '/tools/resume-builder',
  },
};

export default function ResumeBuilderPage() {
  return <ResumeBuilderLanding />;
}
