export const ASSISTANT_OPEN_EVENT = 'assistant:open' as const;
export const LEGACY_ASSISTANT_OPEN_EVENT = 'sona:open' as const;

export const ASSISTANT_STORAGE_KEYS = {
  personality: 'taco-personality',
  legacyPersonality: 'sona-personality',
  voiceId: 'taco-voice-id',
  legacyVoiceId: 'sona-voice-id',
  audioReplies: 'taco-audio-replies',
  legacyAudioReplies: 'sona-audio-replies',
  promoDismissed: 'tc_promo_taco_dismissed',
  legacyPromoDismissed: 'tc_promo_sona_dismissed',
  /* Whether the context rail is expanded. Absent means minimised, which is the default -
     the rail was made collapsible because the page read as crowded, so the quiet state is
     the one you get without asking. No legacy key: this preference did not exist before. */
  contextPanelExpanded: 'tc_taco_context_expanded',
} as const;

export function readAssistantStorage(storage: Storage, key: string, legacyKey: string): string | null {
  return storage.getItem(key) ?? storage.getItem(legacyKey);
}

export function writeAssistantStorage(storage: Storage, key: string, legacyKey: string, value: string): void {
  storage.setItem(key, value);
  // Dual-write during the migration so an older open tab can still read the preference.
  storage.setItem(legacyKey, value);
}
