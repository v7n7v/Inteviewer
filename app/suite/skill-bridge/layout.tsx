import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Skill Bridge — AI Skill Gap Analysis & Study Plans',
  description: 'Identify skill gaps between your resume and target roles. Get AI-generated study plans, learning resources, and progress tracking.',
  alternates: { canonical: '/suite/skill-bridge' },
};

export default function SkillBridgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
