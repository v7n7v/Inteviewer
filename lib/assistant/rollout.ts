export type AssistantRolloutPhase = 'internal' | 'canary' | 'general';

export const ASSISTANT_ROLLOUT_METRICS = {
  openRate: 'assistant_open_rate',
  firstUsefulOutcomeRate: 'assistant_first_useful_outcome_rate',
  taskCompletionRate: 'assistant_task_completion_rate',
  correctionRate: 'assistant_user_correction_rate',
  nameConfusionRate: 'assistant_name_confusion_rate',
  supportContactRate: 'assistant_support_contact_rate',
} as const;

export function resolveAssistantRollout(env: NodeJS.ProcessEnv = process.env) {
  const requestedPhase = env.TACO_ROLLOUT_PHASE;
  const phase: AssistantRolloutPhase =
    requestedPhase === 'internal' || requestedPhase === 'canary' || requestedPhase === 'general'
      ? requestedPhase
      : 'general';

  return {
    enabled: env.NEXT_PUBLIC_TACO_ROLLOUT_ENABLED !== 'false',
    phase,
    brandVersion: 'taco-1',
  } as const;
}
