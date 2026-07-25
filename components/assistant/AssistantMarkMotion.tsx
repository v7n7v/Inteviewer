'use client';

import AssistantMark, {
  type AssistantMarkSize,
  type AssistantMarkState,
} from './AssistantMark';

export type AssistantMarkMotionState = AssistantMarkState | 'speaking';
export type AssistantMarkMotionSize = AssistantMarkSize;

export interface AssistantMarkMotionProps {
  state?: AssistantMarkMotionState;
  size?: AssistantMarkMotionSize;
  activity?: number;
  className?: string;
  title?: string;
}

/**
 * Canonical animated Taco mark. The activity prop is retained for gallery and
 * API compatibility; motion intensity is governed by the semantic state and
 * reduced-motion preference in AssistantMark.
 */
export default function AssistantMarkMotion({
  state = 'idle',
  size = 'md',
  activity: _activity,
  className = '',
  title,
}: AssistantMarkMotionProps) {
  const assistantState: AssistantMarkState = state === 'speaking' ? 'responding' : state;
  return <AssistantMark state={assistantState} size={size} className={className} title={title} />;
}
