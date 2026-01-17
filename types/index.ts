export interface User {
  id: string;
  email: string;
  full_name?: string;
}

export interface Question {
  question: string;
  purpose: string;
  expectedAnswer?: string;
  isCustom?: boolean;
}

export interface TrapQuestion {
  question: string;
  trap: string;
  goodAnswer: string;
}

export interface RiskFactor {
  level: 'high' | 'medium' | 'low';
  description: string;
}

export interface Grades {
  communication: number;
  technical: number;
  problemSolving: number;
  cultureFit: number;
  leadership: number;
  energy: number;
}

export interface Candidate {
  id?: string;
  user_id?: string;
  name: string;
  cvText: string;
  jdText: string;
  questions: Question[];
  trapQuestions: TrapQuestion[];
  riskFactors: RiskFactor[];
  transcript: string;
  humanGrades: Grades;
  aiGrades: Grades;
  notes: string;
  timestamp: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AudioSnippet {
  url: string;
  timestamp: string;
  questionNum: number;
}

export type TabType = 'detective' | 'copilot' | 'calibration' | 'analytics';
