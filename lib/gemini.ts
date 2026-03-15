/**
 * AI Client — Secure BFF Pattern
 * All AI calls now go through /api/ai server-side route
 * No API keys are exposed to the client
 */

/**
 * Main AI text completion
 */
export async function callGeminiAPI(
  prompt: string,
  systemPrompt: string = 'You are a helpful AI assistant specializing in talent assessment and career development.'
): Promise<string> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      prompt,
      systemPrompt,
      options: { temperature: 0.7, maxTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'AI request failed' }));
    throw new Error(err.error || `AI API error (${response.status})`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Parse JSON from AI response text
 */
export function parseJSONResponse<T>(text: string): T | null {
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1].trim());
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch {
    console.error('Could not parse JSON response');
    return null;
  }
}

/**
 * AI completion with structured JSON response
 */
export async function callGeminiAPIForJSON<T = any>(
  prompt: string,
  systemPrompt: string = 'You are a helpful AI assistant. Always respond with valid JSON.'
): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'json',
      prompt,
      systemPrompt,
      options: { temperature: 0.5, maxTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'AI JSON request failed' }));
    throw new Error(err.error || `AI JSON API error (${response.status})`);
  }

  const data = await response.json();
  return data.result as T;
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
 * Analyze transcript and generate AI grades
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

export default callGeminiAPI;
