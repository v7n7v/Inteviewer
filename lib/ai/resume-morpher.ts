/**
 * Resume Morphing AI powered by Groq GPT-OSS 120B
 * Uses Groq to analyze JD and re-prioritize resume content
 */

import { groqJSONCompletion, groqCompletion } from './groq-client';

interface ResumeSection {
  title: string;
  items: string[];
}

interface Resume {
  personal: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  experience: ResumeSection[];
  education: ResumeSection[];
  skills: string[];
  certifications?: string[];
  projects?: ResumeSection[];
}

interface MorphedResume extends Resume {
  matchScore: number;
  highlightedSkills: string[];
  prioritizedSections: string[];
}

export async function morphResumeForJD(
  resume: Resume,
  jobDescription: string
): Promise<MorphedResume> {
  const systemPrompt = `You are an expert resume optimizer and ATS (Applicant Tracking System) specialist. 
Analyze job descriptions and resumes to provide precise matching insights.`;

  const userPrompt = `Analyze this job description and resume, then provide optimization insights.

Job Description:
${jobDescription}

Resume:
${JSON.stringify(resume, null, 2)}

Return a JSON object with:
{
  "matchScore": <number 0-100>,
  "highlightedSkills": [<array of skills from resume that match JD>],
  "prioritizedExperienceIndices": [<array of indices showing best order for experience items>],
  "recommendedSectionOrder": ["experience", "skills", "projects", "education"],
  "reasoning": "<brief explanation>"
}`;

  try {
    const analysis = await groqJSONCompletion<{
      matchScore: number;
      highlightedSkills: string[];
      prioritizedExperienceIndices?: number[];
      recommendedSectionOrder?: string[];
      reasoning?: string;
    }>(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 2048 });

    // Apply morphing
    const morphedResume: MorphedResume = {
      ...resume,
      matchScore: analysis.matchScore || 0,
      highlightedSkills: analysis.highlightedSkills || [],
      prioritizedSections: analysis.recommendedSectionOrder || ['experience', 'skills', 'education'],
      // Reorder experience based on AI recommendation
      experience: analysis.prioritizedExperienceIndices
        ? analysis.prioritizedExperienceIndices
            .map((idx: number) => resume.experience[idx])
            .filter(Boolean)
        : resume.experience,
    };

    console.log('Resume morphing analysis:', analysis.reasoning);
    return morphedResume;
  } catch (error) {
    console.error('Resume morphing error:', error);
    // Return original resume with default values
    return {
      ...resume,
      matchScore: 0,
      highlightedSkills: [],
      prioritizedSections: ['experience', 'skills', 'education'],
    };
  }
}

export async function generateSkillInsights(
  skills: string[]
): Promise<{ skill: string; category: string; level: number }[]> {
  const systemPrompt = `You are a career development expert specializing in skill categorization and market analysis.`;

  const userPrompt = `Analyze these skills and categorize them. For each skill, provide:
- category (e.g., "Frontend", "Backend", "DevOps", "Soft Skills", "Data Science", etc.)
- level (estimated proficiency 1-10 based on common industry standards)

Skills: ${skills.join(', ')}

Return a JSON array:
[
  { "skill": "React", "category": "Frontend", "level": 8 },
  { "skill": "Python", "category": "Backend", "level": 7 }
]`;

  try {
    const insights = await groqJSONCompletion<
      Array<{ skill: string; category: string; level: number }>
    >(systemPrompt, userPrompt, { temperature: 0.2, maxTokens: 1024 });

    return insights;
  } catch (error) {
    console.error('Skill insight error:', error);
    return skills.map(skill => ({ skill, category: 'General', level: 5 }));
  }
}

export async function optimizeSummary(
  currentSummary: string,
  jobDescription: string
): Promise<string> {
  const systemPrompt = `You are a professional resume writer specializing in crafting compelling career summaries.
Write concise, impactful summaries that highlight relevant experience and match job requirements.`;

  const userPrompt = `Rewrite this professional summary to better match the job description.
Keep it concise (2-3 sentences), professional, and impactful.
Focus on the most relevant experience and skills for this role.

Current Summary:
${currentSummary}

Target Job Description:
${jobDescription}

Return ONLY the optimized summary text, no explanations or formatting.`;

  try {
    const optimized = await groqCompletion(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 256,
    });

    return optimized.trim();
  } catch (error) {
    console.error('Summary optimization error:', error);
    return currentSummary;
  }
}

/**
 * Generate a complete resume from scratch based on user input
 */
export async function generateResumeFromPrompt(
  prompt: string
): Promise<Partial<Resume>> {
  const systemPrompt = `You are a professional resume builder. Create structured resume content based on user descriptions.`;

  const userPrompt = `Based on this description, generate resume content:

${prompt}

Return a JSON object with:
{
  "personal": {
    "title": "<job title>",
    "summary": "<professional summary>"
  },
  "experience": [
    {
      "title": "<job title or project name>",
      "items": ["<achievement 1>", "<achievement 2>"]
    }
  ],
  "skills": ["<skill 1>", "<skill 2>"],
  "education": [
    {
      "title": "<degree or certification>",
      "items": []
    }
  ]
}`;

  try {
    const resume = await groqJSONCompletion<Partial<Resume>>(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    return resume;
  } catch (error) {
    console.error('Resume generation error:', error);
    throw error;
  }
}

/**
 * Get AI suggestions for improving resume sections
 */
export async function getResumeSuggestions(
  resume: Resume,
  section: 'experience' | 'skills' | 'summary'
): Promise<string[]> {
  const systemPrompt = `You are a resume improvement expert. Provide specific, actionable suggestions.`;

  const userPrompt = `Review this resume section and provide 3-5 specific improvement suggestions.

Resume Section (${section}):
${JSON.stringify(resume[section === 'summary' ? 'personal' : section], null, 2)}

Return a JSON array of suggestion strings:
["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]`;

  try {
    const suggestions = await groqJSONCompletion<string[]>(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 512,
    });

    return suggestions;
  } catch (error) {
    console.error('Suggestion generation error:', error);
    return ['Unable to generate suggestions at this time'];
  }
}

export type { Resume, MorphedResume, ResumeSection };
