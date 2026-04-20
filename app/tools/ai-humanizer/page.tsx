import type { Metadata } from 'next';
import AIHumanizerLanding from './AIHumanizerLanding';

export const metadata: Metadata = {
  title: 'Free AI Humanizer — Make AI Text Undetectable & Natural',
  description: 'Transform AI-generated text into natural, human-sounding writing. Our AI humanizer rewrites ChatGPT, Claude, and Gemini output to bypass AI detectors while preserving meaning. Free to try.',
  keywords: [
    'AI humanizer',
    'make AI text undetectable',
    'humanize AI text',
    'AI text rewriter',
    'bypass AI detector',
    'AI humanizer free',
    'undetectable AI writer',
    'humanize ChatGPT text',
    'AI to human text converter',
    'AI content humanizer',
  ],
  openGraph: {
    title: 'Free AI Humanizer — Talent Studio',
    description: 'Make AI-generated text undetectable. Humanize ChatGPT, Claude & Gemini output.',
    url: 'https://talentconsulting.io/tools/ai-humanizer',
  },
  alternates: {
    canonical: '/tools/ai-humanizer',
  },
};

export default function AIHumanizerPage() {
  return <AIHumanizerLanding />;
}
