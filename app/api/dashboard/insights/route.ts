import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion } from '@/lib/ai/groq-client';

export async function POST(req: NextRequest) {
  try {
    const { context = {} } = await req.json();

    // For now, generate AI-powered insights for new/demo users
    // In the future, pull real data from Firestore via Firebase Admin SDK

    const systemPrompt = `You are an expert AI dashboard engine.
    Generate real-time, high-fidelity data for dashboard widgets.
    Generate realistic sample data to demonstrate value for a job seeker.`;

    const userPrompt = `Generate JSON data for: 'aiDiscovery', 'careerRoadmap', 'marketPulse'.
    Context: User is a job seeker.
    
    1. aiDiscovery: List 3 job matches with id, name, role, score (0-100), trend.
    2. careerRoadmap: Object with skills array (skill, current, target, color), timeToTarget, completion.
    3. marketPulse: Object with chartData array (x, y pairs), stats array (label, value, change, up boolean).
    
    Return JSON: { "aiDiscovery": [...], "careerRoadmap": {...}, "marketPulse": {...} }`;

    const data = await groqJSONCompletion(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in insights API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
