import type { Metadata } from 'next';
import AIDetectorDemo from './AIDetectorDemo';

export const metadata: Metadata = {
  title: 'Free AI Text Detector — Check If Text Is AI-Generated',
  description: 'Free AI content detector with 100+ pattern analysis. Check if your resume, cover letter, or essay was flagged as AI-generated. Detect ChatGPT, Claude, and Gemini writing patterns instantly.',
  keywords: [
    'AI text detector',
    'AI content detector free',
    'check if text is AI generated',
    'ChatGPT detector',
    'AI writing detector',
    'AI detection tool',
    'detect AI writing',
    'AI plagiarism checker',
    'is my text AI generated',
    'AI detector for resumes',
    'AI content checker',
  ],
  openGraph: {
    title: 'Free AI Text Detector — Talent Studio',
    description: 'Check if your text is AI-generated. 100+ pattern analysis. Free.',
    url: 'https://talentconsulting.io/tools/ai-detector',
  },
  alternates: {
    canonical: '/tools/ai-detector',
  },
};

export default function AIDetectorPage() {
  return <AIDetectorDemo />;
}
