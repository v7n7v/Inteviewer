/**
 * TalentConsulting.io AI Functions
 * Specialized AI functions for TalentConsulting.io features
 * Uses GPT-OSS 120B via Groq SDK
 */

import Groq from "groq-sdk";

const MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "llama-3.3-70b-versatile";

// Initialize Groq client
const getGroqClient = () => {
    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!apiKey) {
        throw new Error('GROQ_API_KEY not found in environment variables');
    }

    return new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });
};

// Helper to safely parse JSON from AI response
const safeJSONParse = (content: string) => {
    try {
        // Try direct parse first
        return JSON.parse(content);
    } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }
        // Try to find JSON object/array in the response
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            return JSON.parse(objectMatch[0]);
        }
        throw new Error('Could not parse JSON from response');
    }
};

export const talentConsultingAI = {
    /**
     * THE LIQUID RESUME ARCHITECT
     * Analyzes a CV against a JD to create a 'Morphed' resume strategy.
     */
    analyzeResume: async (resumeText: string, jobDescription: string) => {
        const groq = getGroqClient();

        const systemPrompt = `You are the TalentConsulting.io Liquid Resume Architect. Your goal is to transform a static CV into a high-density 'Mission Fit' document. 

You MUST respond with a valid JSON object containing:
1. "gapAnalysis": Array of {skill: string, importance: "critical"|"important"|"nice-to-have", suggestion: string}
2. "morphSuggestions": Array of {original: string, suggested: string, reason: string}
3. "talentDensityScore": Number 0-100

Be specific and actionable.`;

        const userPrompt = `Analyze this resume against the job description:

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Provide your analysis as a JSON object with gapAnalysis (missing skills with importance levels), morphSuggestions (specific bullet rewrites), and talentDensityScore (0-100 overall match).`;

        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 4096,
            });

            const content = response.choices[0].message.content || '{}';
            const parsed = safeJSONParse(content);

            // Ensure we have the expected structure
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            gapAnalysis: parsed.gapAnalysis || [],
                            morphSuggestions: parsed.morphSuggestions || [],
                            talentDensityScore: parsed.talentDensityScore || 50
                        })
                    }
                }]
            };
        } catch (error: any) {
            console.error('Resume analysis error:', error);

            // Try fallback model
            if (error.status === 403 || error.status === 404) {
                console.log('Trying fallback model:', FALLBACK_MODEL);
                const response = await groq.chat.completions.create({
                    model: FALLBACK_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 4096,
                });

                const content = response.choices[0].message.content || '{}';
                const parsed = safeJSONParse(content);

                return {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                gapAnalysis: parsed.gapAnalysis || [],
                                morphSuggestions: parsed.morphSuggestions || [],
                                talentDensityScore: parsed.talentDensityScore || 50
                            })
                        }
                    }]
                };
            }

            throw error;
        }
    },

    /**
     * THE MISSION BLUEPRINT GENERATOR
     * Generates high-end Silicon Valley style Job Requirements.
     */
    generateJD: async (roleTitle: string, teamContext: string) => {
        const groq = getGroqClient();

        const systemPrompt = `You are a top-tier Silicon Valley Recruiter. Generate a 'Mission Blueprint' instead of a standard JD.

Include:
1. Role Overview (compelling mission statement)
2. First 90 Days Success Metrics (specific OKRs)
3. Core Requirements (must-have skills)
4. Nice-to-Have (bonus qualifications)
5. Culture Pulse (team dynamics and values)
6. Talent Density Requirement (what exceptional looks like)
7. Growth Path (career trajectory)

Make it compelling, specific, and attractive to top talent.`;

        const userPrompt = `Create a Mission Blueprint JD for:
Role: ${roleTitle}
Team Context: ${teamContext}

Generate a professional, attractive job description that would attract high-density talent.`;

        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 2048,
            });

            return response;
        } catch (error: any) {
            if (error.status === 403 || error.status === 404) {
                return await groq.chat.completions.create({
                    model: FALLBACK_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048,
                });
            }
            throw error;
        }
    },

    /**
     * THE SHADOW INTERVIEWER (Chat)
     * Real-time interview co-pilot and feedback.
     */
    chatInterview: async (messages: any[], currentTranscript: string) => {
        const groq = getGroqClient();

        const systemPrompt = `You are the Shadow Interviewer at TalentConsulting.io. 
Monitor this live transcript and provide the human interviewer with strategic insights.

Current Transcript: "${currentTranscript}"

Your role:
- Identify key themes and patterns in responses
- Suggest 2 deep-dive follow-up questions
- Flag any inconsistencies or areas to probe
- Keep responses concise and actionable`;

        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages
                ],
                temperature: 0.7,
                max_tokens: 512,
            });

            return response;
        } catch (error: any) {
            if (error.status === 403 || error.status === 404) {
                return await groq.chat.completions.create({
                    model: FALLBACK_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...messages
                    ],
                    temperature: 0.7,
                    max_tokens: 512,
                });
            }
            throw error;
        }
    },

    /**
     * THE MARKET ORACLE
     * Predictive salary and career pathing.
     */
    getMarketInsights: async (skills: string[]) => {
        const groq = getGroqClient();

        const systemPrompt = `You are the TalentConsulting.io Market Oracle. Analyze skill sets and provide career intelligence.

You MUST respond with a valid JSON object containing:
1. "marketValueScore": Number 0-100 (overall market value)
2. "salaryRange": {min: number, max: number, median: number} (in USD)
3. "demandLevel": "high" | "medium" | "low"
4. "skillHeatmap": Array of {skill: string, demand: number, growth: number}
5. "nextLogicalSkill": {name: string, reason: string, potentialIncrease: number}
6. "careerPaths": Array of {title: string, probability: number}

Base your analysis on current market trends for tech roles.`;

        const userPrompt = `Analyze the market value and career potential for this skill set:
Skills: ${skills.join(", ")}

Provide comprehensive market intelligence as a JSON object.`;

        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 2048,
            });

            const content = response.choices[0].message.content || '{}';
            const parsed = safeJSONParse(content);

            return {
                choices: [{
                    message: {
                        content: JSON.stringify(parsed)
                    }
                }]
            };
        } catch (error: any) {
            if (error.status === 403 || error.status === 404) {
                const response = await groq.chat.completions.create({
                    model: FALLBACK_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 2048,
                });

                const content = response.choices[0].message.content || '{}';
                const parsed = safeJSONParse(content);

                return {
                    choices: [{
                        message: {
                            content: JSON.stringify(parsed)
                        }
                    }]
                };
            }
            throw error;
        }
    },

    /**
     * GENERAL CHAT COMPLETION
     * For custom prompts
     */
    chat: async (systemPrompt: string, userPrompt: string) => {
        const groq = getGroqClient();

        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 2048,
            });

            return response.choices[0].message.content || '';
        } catch (error: any) {
            if (error.status === 403 || error.status === 404) {
                const response = await groq.chat.completions.create({
                    model: FALLBACK_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048,
                });
                return response.choices[0].message.content || '';
            }
            throw error;
        }
    }
};
