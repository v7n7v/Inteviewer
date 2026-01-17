import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { callGeminiAPIForJSON } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    // Context for AI fallback
    const { role = 'interviewer', context = {} } = await req.json();

    // 1. Fetch Real Data from Supabase
    let dbCandidates: any[] = [];
    let dbProfile: any = null;

    if (session) {
      // Fetch Candidates
      const { data: cData } = await supabase
        .from('candidates')
        .select('id, name, ai_grades, updated_at')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(3);

      if (cData) dbCandidates = cData;

      // Fetch User Profile (Skills)
      const { data: pData } = await supabase
        .from('user_profiles')
        .select('skills')
        .eq('user_id', session.user.id)
        .single();

      if (pData) dbProfile = pData;
    }

    // 2. Check if we have enough real data to populate the dashboard
    const hasRealData = dbCandidates.length > 0;

    if (hasRealData) {
      // --- USE REAL DB DATA ---

      // Map Candidates
      const aiDiscovery = dbCandidates.map(c => {
        // Calculate average score from AI grades
        const grades = c.ai_grades || {};
        const values = Object.values(grades).filter(v => typeof v === 'number') as number[];
        const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length) * 10 : 0; // Scale 1-10 to 1-100

        return {
          id: c.id,
          name: c.name || 'Unknown Candidate',
          role: 'Applicant', // 'role' column missing in candidates table
          score: Math.round(avg) || 85,
          trend: '+0%' // Real trend requires history table
        };
      });

      // Map Skills (Career Roadmap)
      let careerRoadmap = {
        skills: [
          { skill: 'Data Analysis', current: 60, target: 85, color: '#0070F3' },
          { skill: 'Strategic Planning', current: 50, target: 80, color: '#22C55E' }
        ],
        timeToTarget: 'N/A',
        completion: 0
      };

      if (dbProfile && dbProfile.skills && Array.isArray(dbProfile.skills) && dbProfile.skills.length > 0) {
        // Assuming skills is array of strings or objects. 
        // If generic JSON, we might need to be careful. 
        // For now, let's just use what we have or fallback if structure doesn't match
        const mappedSkills = dbProfile.skills.slice(0, 4).map((s: any, i: number) => ({
          skill: typeof s === 'string' ? s : (s.name || 'Skill'),
          current: Math.floor(Math.random() * 40) + 40, // Mock progress for functional MVP if not stored
          target: 90,
          color: ['#0070F3', '#22C55E', '#00F5FF', '#A855F7'][i % 4]
        }));
        careerRoadmap = {
          skills: mappedSkills,
          timeToTarget: '3-6 months',
          completion: 45
        };
      }

      // Market Pulse (Hard to get real data without external API, stick to Mock/AI for this widget for now)
      // Or we can return a static structure
      const marketPulse = {
        chartData: [
          { x: 0, y: 40 }, { x: 30, y: 50 }, { x: 60, y: 45 }, { x: 90, y: 60 },
          { x: 120, y: 55 }, { x: 150, y: 70 }, { x: 180, y: 65 }, { x: 200, y: 80 }
        ],
        stats: [
          { label: 'Active Candidates', value: dbCandidates.length.toString(), change: '+1', up: true },
          { label: 'Avg Score', value: '88%', change: '+2%', up: true },
          { label: 'Time to Hire', value: '12d', change: '-2d', up: true }
        ]
      };

      return NextResponse.json({
        aiDiscovery,
        careerRoadmap,
        marketPulse
      });

    } else {
      // --- FALLBACK TO AI GENERATION (Demo Mode) ---
      // This ensures the dashboard isn't empty for new users

      const systemPrompt = `You are an expert AI dashboard engine. 
      Generate real-time, high-fidelity mock data for dashboard widgets.
      The user has no database data yet, so generate realistic sample data to demonstrate value.`;

      const userPrompt = `Generate JSON data for: 'aiDiscovery', 'careerRoadmap', 'marketPulse'.
      Context: User is a ${role}.
      
      1. aiDiscovery: List 3 ${role === 'interviewer' ? 'sample candidates' : 'job matches'}.
      2. careerRoadmap: List 4 trendy skills.
      3. marketPulse: Real-time stats.
      
      Return JSON: { aiDiscovery: [...], careerRoadmap: {...}, marketPulse: {...} }`;

      const data = await callGeminiAPIForJSON(userPrompt, systemPrompt);
      return NextResponse.json(data);
    }

  } catch (error) {
    console.error('Error in insights API:', error);
    // Silent fail to empty object or error
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
