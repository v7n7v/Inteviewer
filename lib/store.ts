import { create } from 'zustand';
import type { Candidate, TabType, AudioSnippet } from '@/types';
import type { User } from '@supabase/supabase-js';

// Per-question interview data
export interface QuestionData {
  questionIndex: number;
  transcript: string;
  aiNudge: string;
  audioUrl: string | null;
  keywords: string[];
  status: 'not-started' | 'in-progress' | 'completed';
  timestamp: string | null;
  captureMode?: 'mic-only' | 'meeting';
}

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // 2FA pending state - prevents auto-redirect during OTP verification
  pending2FA: boolean;
  setPending2FA: (pending: boolean) => void;

  // Current tab
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;

  // Current candidate being interviewed
  currentCandidate: Candidate;
  setCurrentCandidate: (candidate: Partial<Candidate>) => void;
  resetCurrentCandidate: () => void;

  // Interview state
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  detectedKeywords: Set<string>;
  addKeyword: (keyword: string) => void;
  clearKeywords: () => void;

  // Audio snippets
  audioSnippets: AudioSnippet[];
  addAudioSnippet: (snippet: AudioSnippet) => void;
  clearAudioSnippets: () => void;

  // Per-question data
  questionData: { [key: number]: QuestionData };
  setQuestionData: (index: number, data: Partial<QuestionData>) => void;
  getQuestionData: (index: number) => QuestionData;
  clearQuestionData: () => void;
}

const defaultGrades = {
  communication: 5,
  technical: 5,
  problemSolving: 5,
  cultureFit: 5,
  leadership: 5,
  energy: 5,
};

const defaultCandidate: Candidate = {
  name: '',
  cvText: '',
  jdText: '',
  questions: [],
  trapQuestions: [],
  riskFactors: [],
  transcript: '',
  humanGrades: { ...defaultGrades },
  aiGrades: { ...defaultGrades },
  notes: '',
  timestamp: null,
};

export const useStore = create<AppState>((set, get) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // 2FA pending state
  pending2FA: false,
  setPending2FA: (pending) => set({ pending2FA: pending }),

  // Current tab
  currentTab: 'detective',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  // Current candidate
  currentCandidate: { ...defaultCandidate },
  setCurrentCandidate: (updates) =>
    set((state) => ({
      currentCandidate: { ...state.currentCandidate, ...updates },
    })),
  resetCurrentCandidate: () => set({ currentCandidate: { ...defaultCandidate } }),

  // Interview state
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  detectedKeywords: new Set<string>(),
  addKeyword: (keyword) =>
    set((state) => {
      const newKeywords = new Set(state.detectedKeywords);
      newKeywords.add(keyword);
      return { detectedKeywords: newKeywords };
    }),
  clearKeywords: () => set({ detectedKeywords: new Set<string>() }),

  // Audio snippets
  audioSnippets: [],
  addAudioSnippet: (snippet) =>
    set((state) => ({
      audioSnippets: [...state.audioSnippets, snippet],
    })),
  clearAudioSnippets: () => set({ audioSnippets: [] }),

  // Per-question data
  questionData: {},
  setQuestionData: (index, data) =>
    set((state) => ({
      questionData: {
        ...state.questionData,
        [index]: {
          ...state.questionData[index],
          questionIndex: index,
          transcript: '',
          aiNudge: '',
          audioUrl: null,
          keywords: [],
          status: 'not-started',
          timestamp: null,
          ...data,
        },
      },
    })),
  getQuestionData: (index) => {
    const data = get().questionData[index];
    return data || {
      questionIndex: index,
      transcript: '',
      aiNudge: '',
      audioUrl: null,
      keywords: [],
      status: 'not-started',
      timestamp: null,
    };
  },
  clearQuestionData: () => set({ questionData: {} }),
}));

// Selector for auth state (convenience hook)
export const useAuthState = () => {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  return { user, setUser };
};
