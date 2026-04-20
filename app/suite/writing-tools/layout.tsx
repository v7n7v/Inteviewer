import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Text Detector & Humanizer — Detect & Rewrite AI Content',
  description: 'Scan text for AI writing patterns with 100+ heuristic checks. Humanize flagged sections with Gemini AI while preserving your voice. Supports resumes, academic papers, and marketing copy.',
  alternates: { canonical: '/suite/writing-tools' },
};

export default function WritingToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
