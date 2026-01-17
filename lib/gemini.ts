/**
 * AI Client - Now powered by Groq GPT-OSS 120B
 * Maintains backward compatibility with previous Gemini interface
 */

import { groqCompletion, groqJSONCompletion, extractJSON } from './ai/groq-client';

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

/**
 * Main AI API call - now using Groq
 * @param prompt The prompt to send to the AI
 * @param systemPrompt Optional system prompt for context
 */
export async function callGeminiAPI(
  prompt: string,
  systemPrompt: string = 'You are a helpful AI assistant specializing in talent assessment and career development.'
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured. Please check your .env.local file.');
  }

  try {
    const response = await groqCompletion(systemPrompt, prompt, {
      temperature: 0.7,
      maxTokens: 4096,
    });
    return response;
  } catch (error: any) {
    console.error('AI API error:', error);
    throw new Error(`AI API error: ${error.message}`);
  }
}

/**
 * Parse JSON response from AI
 * Handles various formats including markdown code blocks
 */
export function parseJSONResponse<T>(text: string): T | null {
  try {
    return extractJSON(text) as T;
  } catch (e) {
    console.error('Could not parse JSON response:', e);
    return null;
  }
}

/**
 * Call AI with JSON response expected
 * @param prompt The prompt to send
 * @param systemPrompt Optional system context
 */
export async function callGeminiAPIForJSON<T = any>(
  prompt: string,
  systemPrompt: string = 'You are a helpful AI assistant. Always respond with valid JSON.'
): Promise<T> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured');
  }

  try {
    const response = await groqJSONCompletion<T>(systemPrompt, prompt, {
      temperature: 0.5,
      maxTokens: 4096,
    });
    return response;
  } catch (error: any) {
    console.error('AI JSON API error:', error);
    throw new Error(`AI JSON API error: ${error.message}`);
  }
}

/**
 * Generate interview questions from CV and JD
 */
export async function generateInterviewQuestions(
  cvText: string,
  jdText: string
): Promise<{
  questions: string[];
  trapQuestions: string[];
  riskFactors: string[];
}> {
  const systemPrompt = `You are an expert technical interviewer and talent assessor. 
Generate insightful interview questions based on candidate CVs and job descriptions.`;

  const userPrompt = `Based on this CV and Job Description, generate:
1. 10 core interview questions that test claimed expertise
2. 3 "trap questions" to verify deep knowledge
3. Risk factors or gaps to investigate

CV:
${cvText}

Job Description:
${jdText}

Return JSON:
{
  "questions": ["<question 1>", "...", "<question 10>"],
  "trapQuestions": ["<trap 1>", "<trap 2>", "<trap 3>"],
  "riskFactors": ["<risk 1>", "<risk 2>", "<risk 3>"]
}`;

  return callGeminiAPIForJSON(userPrompt, systemPrompt);
}

/**
 * Analyze interview transcript and generate AI grades
 */
export async function analyzeInterviewTranscript(
  transcript: string,
  questions: string[]
): Promise<{
  communication: number;
  technical: number;
  problemSolving: number;
  cultureFit: number;
  leadership: number;
  energy: number;
  feedback: string;
}> {
  const systemPrompt = `You are an expert interview assessor. Analyze interview transcripts and provide objective ratings.`;

  const userPrompt = `Analyze this interview transcript and rate the candidate on a scale of 1-10 for each dimension.

Interview Questions:
${questions.join('\n')}

Transcript:
${transcript}

Return JSON:
{
  "communication": <1-10>,
  "technical": <1-10>,
  "problemSolving": <1-10>,
  "cultureFit": <1-10>,
  "leadership": <1-10>,
  "energy": <1-10>,
  "feedback": "<brief assessment>"
}`;

  return callGeminiAPIForJSON(userPrompt, systemPrompt);
}

/**
 * Generate a job description from requirements
 */
export async function generateJobDescription(
  requirements: string
): Promise<{
  title: string;
  description: string;
  qualifications: string[];
  responsibilities: string[];
}> {
  const systemPrompt = `You are an expert HR professional and job description writer.`;

  const userPrompt = `Create a professional job description based on these requirements:

${requirements}

Return JSON:
{
  "title": "<job title>",
  "description": "<compelling job description>",
  "qualifications": ["<qualification 1>", "..."],
  "responsibilities": ["<responsibility 1>", "..."]
}`;

  return callGeminiAPIForJSON(userPrompt, systemPrompt);
}

// Export for backward compatibility
export default callGeminiAPI;
