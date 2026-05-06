'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { authFetch } from '@/lib/auth-fetch';
import { useTheme } from '@/components/ThemeProvider';
import { showToast } from '@/components/Toast';
import PageHelp from '@/components/PageHelp';
import ProGate from '@/components/ProGate';
import {
  saveStudyProgress,
  markDayComplete,
  unmarkDayComplete,
  markCourseComplete,
  markCourseIncomplete,
  getAllStudyProgress,
  type StudyProgress,
} from '@/lib/database-suite';

import { PriorityPicker, PlanConfigurator, type SkillGap, type SelectedSkillConfig, type Phase } from './components';
import { LearningDashboard } from './dashboard';

// ═══════════════════════════════════════
// RESOURCE DATABASE (kept for backward compat)
// ═══════════════════════════════════════
interface LearningResource {
  title: string; platform: string; icon: string; url: string; duration: string; free: boolean;
}

const RESOURCE_DATABASE: Record<string, LearningResource[]> = {
  'React': [
    { title: 'React Full Course 2025', platform: 'YouTube', icon: 'smart_display', url: 'https://youtube.com/results?search_query=react+full+course+2025', duration: '6h', free: true },
    { title: 'React Documentation', platform: 'React.dev', icon: 'menu_book', url: 'https://react.dev/learn', duration: 'Self-paced', free: true },
  ],
  'TypeScript': [
    { title: 'TypeScript Handbook', platform: 'TypeScript', icon: 'menu_book', url: 'https://www.typescriptlang.org/docs/handbook/', duration: 'Self-paced', free: true },
  ],
  'Python': [
    { title: 'Python for Everybody', platform: 'Coursera', icon: 'school', url: 'https://www.coursera.org/specializations/python', duration: '8mo', free: true },
  ],
  'AWS': [
    { title: 'AWS Cloud Practitioner', platform: 'AWS Skill Builder', icon: 'cloud', url: 'https://skillbuilder.aws/exam-prep/cloud-practitioner', duration: '12h', free: true },
  ],
  'Docker': [
    { title: 'Docker Get Started', platform: 'Docker', icon: '🐳', url: 'https://docs.docker.com/get-started/', duration: '3h', free: true },
  ],
  'Kubernetes': [
    { title: 'Kubernetes Basics', platform: 'Google Cloud', icon: 'school', url: 'https://cloud.google.com/kubernetes-engine/docs/tutorials', duration: '4h', free: true },
  ],
  'SQL': [
    { title: 'SQLBolt Interactive', platform: 'SQLBolt', icon: 'bolt', url: 'https://sqlbolt.com/', duration: '2h', free: true },
  ],
  'Machine Learning': [
    { title: 'ML Crash Course', platform: 'Google', icon: 'school', url: 'https://developers.google.com/machine-learning/crash-course', duration: '15h', free: true },
  ],
};

const SAMPLE_GAPS: SkillGap[] = [
  { skill: 'Kubernetes', confidence: 'ai-added', category: 'technical', priority: 1, reason: 'Required in JD — container orchestration is critical' },
  { skill: 'CI/CD', confidence: 'ai-added', category: 'technical', priority: 2, reason: 'Mentioned 3x in job description' },
  { skill: 'GraphQL', confidence: 'weak', category: 'technical', priority: 3, reason: 'Listed as required skill' },
  { skill: 'AWS', confidence: 'weak', category: 'technical', priority: 4, reason: 'Cloud platform — high demand across roles' },
  { skill: 'Leadership', confidence: 'weak', category: 'soft', priority: 5, reason: 'Senior role requires people management' },
  { skill: 'Docker', confidence: 'ai-added', category: 'technical', priority: 6, reason: 'Foundation for container workflows' },
  { skill: 'TypeScript', confidence: 'weak', category: 'technical', priority: 7, reason: 'Modern frontend standard' },
  { skill: 'System Design', confidence: 'ai-added', category: 'technical', priority: 8, reason: 'Common in senior interviews' },
  { skill: 'Agile', confidence: 'weak', category: 'soft', priority: 9, reason: 'Team methodology — mentioned in JD' },
  { skill: 'Python', confidence: 'weak', category: 'technical', priority: 10, reason: 'Scripting and data analysis' },
];

// ═══════════════════════════════════════
// SKILL COMPLEXITY MAP
// ═══════════════════════════════════════
const SKILL_COMPLEXITY: Record<string, number> = {
  'Docker': 2, 'Git': 2, 'SQL': 2, 'Bash': 2, 'Linux': 2, 'REST API': 2,
  'React': 4, 'TypeScript': 4, 'Next.js': 4, 'Node.js': 4, 'Python': 4,
  'GraphQL': 4, 'CI/CD': 4, 'Kubernetes': 4, 'PostgreSQL': 4, 'MongoDB': 4,
  'Vue': 4, 'Angular': 4, 'Express': 4, 'Django': 4, 'Go': 4, 'Rust': 4,
  'Java': 4, 'Redis': 4, 'Firebase': 4, 'Terraform': 4,
  'AWS': 5, 'Azure': 5, 'GCP': 5, 'Machine Learning': 5, 'System Design': 5,
  'Data Science': 5, 'DevOps': 5, 'Cybersecurity': 5,
  'Leadership': 3, 'Agile': 3, 'Project Management': 3, 'Communication': 3,
};

function getTrainingDays(skill: string, category: 'technical' | 'soft' | 'domain'): number {
  if (SKILL_COMPLEXITY[skill]) return SKILL_COMPLEXITY[skill];
  if (category === 'soft') return 3;
  if (category === 'domain') return 5;
  return 4;
}

// ═══════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════
function SkillBridgePageInner() {
  const { user } = useStore();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const applicationId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('applicationId') : null;

  // Core state
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [phase, setPhase] = useState<Phase>('pick');
  const [selectedSkills, setSelectedSkills] = useState<SkillGap[]>([]);
  const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<Record<string, boolean>>({});
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // Load gaps from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tc_skill_gaps');
      if (stored) {
        const parsed = JSON.parse(stored);
        const gapData: SkillGap[] = (parsed.gaps || []).map((g: any, i: number) => ({
          skill: g.skill,
          confidence: g.confidence || 'ai-added',
          category: g.category || 'technical',
          priority: i + 1,
          reason: g.reason || '',
        }));
        if (parsed.jdTitle) setJobTitle(parsed.jdTitle);
        if (parsed.companyName) setCompanyName(parsed.companyName);
        if (parsed.jd) setJobDescription(parsed.jd);
        if (gapData.length > 0) { setGaps(gapData); return; }
      }
    } catch {}
    setGaps(SAMPLE_GAPS);
  }, []);

  // Load Firestore progress
  const loadProgress = useCallback(async () => {
    try {
      const result = await getAllStudyProgress();
      if (result.success && result.data) {
        setAllProgress(result.data);
        // If user already has active plans, jump to learn phase
        if (result.data.length > 0) setPhase('learn');
      }
    } catch {}
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const getExpectedDays = (p: StudyProgress) =>
    p.total_days || getTrainingDays(p.skill, (p.category as 'technical' | 'soft' | 'domain') || 'technical');

  // ── PHASE 1 HANDLER: User selected skills ──
  const handlePickContinue = (selected: SkillGap[]) => {
    setSelectedSkills(selected);
    setPhase('configure');
  };

  // ── PHASE 2 HANDLER: Generate plans ──
  const handleGenerateAll = async (configs: SelectedSkillConfig[]) => {
    setIsGeneratingBatch(true);
    const jc = (jobTitle || companyName) ? { jobTitle, companyName } : undefined;
    let successCount = 0;
    for (const cfg of configs) {
      try {
        const res = await authFetch('/api/resume/study-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skills: [cfg.skill],
            totalDays: cfg.durationDays,
            platforms: cfg.platforms,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.schedule && data.schedule.length > 0) {
          await saveStudyProgress(cfg.skill, cfg.category, data, applicationId || undefined, jc);
          successCount++;
        }
      } catch (err: any) {
        console.error(`[SkillBridge] Failed for ${cfg.skill}:`, err);
        await saveStudyProgress(cfg.skill, cfg.category, undefined, applicationId || undefined, jc);
        successCount++;
      }
    }
    setIsGeneratingBatch(false);
    showToast(`${successCount} learning plan${successCount > 1 ? 's' : ''} created!`, 'check_circle');
    await loadProgress();
    setPhase('learn');
  };

  // ── PHASE 3 HANDLERS ──
  const handleDayToggle = async (skill: string, day: number, isDone: boolean) => {
    const jc = (jobTitle || companyName) ? { jobTitle, companyName } : undefined;
    if (isDone) {
      const result = await unmarkDayComplete(skill, day);
      if (result.success) { showToast(`Day ${day} unmarked`, '↺'); loadProgress(); }
    } else {
      const hasProgress = allProgress.some(p => p.skill.toLowerCase() === skill.toLowerCase());
      if (!hasProgress) {
        const gap = gaps.find(g => g.skill === skill);
        await saveStudyProgress(skill, gap?.category || 'technical', undefined, applicationId || undefined, jc);
      }
      const result = await markDayComplete(skill, day);
      if (result.success) { showToast(`Day ${day} complete ✓`, 'check_circle'); loadProgress(); }
    }
  };

  const handleMarkComplete = async (skill: string, complete: boolean) => {
    const days = getTrainingDays(skill, gaps.find(g => g.skill === skill)?.category || 'technical');
    const hasProgress = allProgress.some(p => p.skill.toLowerCase() === skill.toLowerCase());
    const jc = (jobTitle || companyName) ? { jobTitle, companyName } : undefined;
    if (!hasProgress) {
      await saveStudyProgress(skill, gaps.find(g => g.skill === skill)?.category || 'technical', undefined, applicationId || undefined, jc);
    }
    if (complete) {
      const result = await markCourseComplete(skill, days);
      if (result.success) { showToast(`${skill} completed! 🎉`, 'emoji_events'); loadProgress(); }
    } else {
      const result = await markCourseIncomplete(skill);
      if (result.success) { showToast(`${skill} progress reset`, 'replay'); loadProgress(); }
    }
  };

  const handleSingleGenerate = async (skill: string) => {
    setLoadingPlans(prev => ({ ...prev, [skill]: true }));
    const jc = (jobTitle || companyName) ? { jobTitle, companyName } : undefined;
    try {
      const category = gaps.find(g => g.skill === skill)?.category || 'technical';
      const totalDays = getTrainingDays(skill, category);
      const res = await authFetch('/api/resume/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: [skill], totalDays, platforms: ['YouTube', 'Official Docs', 'Coursera'] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.schedule?.length > 0) {
        await saveStudyProgress(skill, category, data, applicationId || undefined, jc);
        showToast(`Plan for ${skill} created!`, 'calendar_month');
        loadProgress();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to generate plan', 'cancel');
    }
    setLoadingPlans(prev => ({ ...prev, [skill]: false }));
  };

  const handlePractice = (skill: string) => {
    // Write full context so Gauntlet auto-fills Quick Drill mode
    sessionStorage.setItem('tc_interview_setup', JSON.stringify({
      interviewType: 'quick-drill',
      drillCategory: 'technical',
      drillRole: skill,
      jobDescription: jobDescription || '',
    }));
    router.push('/suite/flashcards');
  };

  return (
    <div className={`min-h-screen ${isLight ? 'bg-white' : 'bg-[var(--theme-bg)]'}`}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero — always visible */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-3xl p-8 mb-8 ${
            isLight
              ? 'bg-white border border-slate-200 shadow-sm'
              : 'bg-white/[0.02] border border-white/[0.06]'
          }`}
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-rounded text-2xl" style={{ color: 'var(--text-secondary)' }}>route</span>
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Skill Bridge</h1>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                  isLight ? 'bg-teal-100 text-teal-800 border border-teal-400' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                }`}>PRO</span>
              </div>
              <p className={`text-sm mt-2 max-w-lg leading-relaxed ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                From Resume to Ready —{' '}
                <span className={`font-semibold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                  we make you the candidate it says you are.
                </span>
              </p>
            </div>

            {/* Phase indicator */}
            <div className="hidden md:flex items-center gap-1">
              {(['pick', 'configure', 'learn'] as Phase[]).map((p, i) => (
                <div key={p} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full transition-all ${
                    phase === p ? 'bg-emerald-500 scale-125' : i < ['pick', 'configure', 'learn'].indexOf(phase) ? 'bg-emerald-500/40' : isLight ? 'bg-slate-200' : 'bg-white/10'
                  }`} />
                  {i < 2 && <div className={`w-4 h-px ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />}
                </div>
              ))}
            </div>
            <PageHelp toolId="skill-bridge" />
          </div>
        </motion.div>

        {/* Phase Router */}
        {phase === 'pick' && (
          <PriorityPicker gaps={gaps} onContinue={handlePickContinue} isLight={isLight} />
        )}

        {phase === 'configure' && (
          <PlanConfigurator
            selectedSkills={selectedSkills}
            onGenerate={handleGenerateAll}
            onBack={() => setPhase('pick')}
            isLight={isLight}
            isGenerating={isGeneratingBatch}
          />
        )}

        {phase === 'learn' && (
          <LearningDashboard
            allProgress={allProgress}
            gaps={gaps}
            onDayToggle={handleDayToggle}
            onMarkComplete={handleMarkComplete}
            onAddMore={() => setPhase('pick')}
            onGeneratePlan={handleSingleGenerate}
            loadingPlans={loadingPlans}
            onPractice={handlePractice}
            isLight={isLight}
            getExpectedDays={getExpectedDays}
          />
        )}
      </div>
    </div>
  );
}

export default function SkillBridgePage() {
  return (
    <ProGate
      feature="Skill Bridge"
      description="Skill Bridge generates personalized learning paths from your resume gaps to interview-ready skills. This is a Pro-exclusive feature."
    >
      <SkillBridgePageInner />
    </ProGate>
  );
}
