import type { Metadata } from 'next';
import TacoMotionLab from './TacoMotionLab';

export const metadata: Metadata = {
  title: 'Taco motion lab',
  description: 'Review the Taco vector identity and state motion system.',
};

export default function TacoMotionLabPage() {
  return <TacoMotionLab />;
}
