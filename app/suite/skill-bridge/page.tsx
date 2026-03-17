'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

// ═══════════════════════════════════════
// SKILL GAP DATA TYPES
// ═══════════════════════════════════════
interface SkillGap {
  skill: string;
  confidence: 'ai-added' | 'weak' | 'strong';
  category: 'technical' | 'soft' | 'domain';
  resources: LearningResource[];
}

interface LearningResource {
  title: string;
  platform: string;
  icon: string;
  url: string;
  duration: string;
  free: boolean;
}

// ═══════════════════════════════════════
// CURATED LEARNING RESOURCES DATABASE
// Maps common tech skills to best free resources
// ═══════════════════════════════════════
const RESOURCE_DATABASE: Record<string, LearningResource[]> = {
  'React': [
    { title: 'React Full Course 2025', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=react+full+course+2025', duration: '6h', free: true },
    { title: 'React Documentation', platform: 'React.dev', icon: '📘', url: 'https://react.dev/learn', duration: 'Self-paced', free: true },
    { title: 'React Basics', platform: 'freeCodeCamp', icon: '🏗️', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react', duration: '10h', free: true },
  ],
  'TypeScript': [
    { title: 'TypeScript for Beginners', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=typescript+full+course', duration: '3h', free: true },
    { title: 'TypeScript Handbook', platform: 'TypeScript', icon: '📘', url: 'https://www.typescriptlang.org/docs/handbook/', duration: 'Self-paced', free: true },
    { title: 'Execute Program', platform: 'Execute Program', icon: '💻', url: 'https://www.executeprogram.com/courses/typescript', duration: '8h', free: false },
  ],
  'Next.js': [
    { title: 'Next.js 15 Full Course', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=next.js+full+course+2025', duration: '8h', free: true },
    { title: 'Learn Next.js', platform: 'Vercel', icon: '▲', url: 'https://nextjs.org/learn', duration: '12h', free: true },
  ],
  'Node.js': [
    { title: 'Node.js Complete Guide', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=node.js+complete+guide', duration: '8h', free: true },
    { title: 'Introduction to Node.js', platform: 'Node.dev', icon: '📘', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs', duration: 'Self-paced', free: true },
  ],
  'Python': [
    { title: 'Python for Everybody', platform: 'Coursera', icon: '🎓', url: 'https://www.coursera.org/specializations/python', duration: '8mo', free: true },
    { title: 'Automate the Boring Stuff', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=automate+the+boring+stuff+python', duration: '10h', free: true },
    { title: 'Python Certification', platform: 'freeCodeCamp', icon: '🏗️', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', duration: '40h', free: true },
  ],
  'AWS': [
    { title: 'AWS Cloud Practitioner', platform: 'AWS Skill Builder', icon: '☁️', url: 'https://skillbuilder.aws/exam-prep/cloud-practitioner', duration: '12h', free: true },
    { title: 'AWS Certified Solutions Architect', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=aws+solutions+architect+2025', duration: '15h', free: true },
    { title: 'AWS re/Start', platform: 'Amazon', icon: '📦', url: 'https://aws.amazon.com/training/restart/', duration: '12wk', free: true },
  ],
  'Docker': [
    { title: 'Docker in 2 Hours', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=docker+full+course', duration: '2h', free: true },
    { title: 'Docker Get Started', platform: 'Docker', icon: '🐳', url: 'https://docs.docker.com/get-started/', duration: '3h', free: true },
  ],
  'Kubernetes': [
    { title: 'Kubernetes Course', platform: 'YouTube (KodeKloud)', icon: '🎥', url: 'https://youtube.com/results?search_query=kubernetes+full+course+kodekloud', duration: '6h', free: true },
    { title: 'EKS Workshop', platform: 'AWS', icon: '☁️', url: 'https://www.eksworkshop.com/', duration: '8h', free: true },
    { title: 'Kubernetes Basics', platform: 'Google Cloud', icon: '🎓', url: 'https://cloud.google.com/kubernetes-engine/docs/tutorials', duration: '4h', free: true },
  ],
  'SQL': [
    { title: 'SQL Full Course', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=sql+full+course+2025', duration: '4h', free: true },
    { title: 'SQL Course', platform: 'freeCodeCamp', icon: '🏗️', url: 'https://www.freecodecamp.org/learn/relational-database/', duration: '20h', free: true },
    { title: 'SQLBolt Interactive', platform: 'SQLBolt', icon: '⚡', url: 'https://sqlbolt.com/', duration: '2h', free: true },
  ],
  'GraphQL': [
    { title: 'GraphQL Full Course', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=graphql+full+course', duration: '4h', free: true },
    { title: 'How to GraphQL', platform: 'Prisma', icon: '📘', url: 'https://www.howtographql.com/', duration: '6h', free: true },
  ],
  'CI/CD': [
    { title: 'GitHub Actions Tutorial', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=github+actions+complete+guide', duration: '3h', free: true },
    { title: 'CI/CD with GitHub Actions', platform: 'GitHub', icon: '🐙', url: 'https://docs.github.com/en/actions/learn-github-actions', duration: '4h', free: true },
  ],
  'Machine Learning': [
    { title: 'Machine Learning Crash Course', platform: 'Google', icon: '🎓', url: 'https://developers.google.com/machine-learning/crash-course', duration: '15h', free: true },
    { title: 'Practical Deep Learning', platform: 'fast.ai', icon: '🧠', url: 'https://course.fast.ai/', duration: '40h', free: true },
    { title: 'ML Specialization', platform: 'Coursera', icon: '🎓', url: 'https://www.coursera.org/specializations/machine-learning-introduction', duration: '3mo', free: true },
  ],
  'Data Analysis': [
    { title: 'Google Data Analytics', platform: 'Coursera', icon: '🎓', url: 'https://www.coursera.org/professional-certificates/google-data-analytics', duration: '6mo', free: true },
    { title: 'Data Analysis with Python', platform: 'freeCodeCamp', icon: '🏗️', url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/', duration: '20h', free: true },
  ],
  'Leadership': [
    { title: 'Leadership & Management', platform: 'LinkedIn Learning', icon: '💼', url: 'https://www.linkedin.com/learning/topics/leadership-and-management', duration: '4h', free: false },
    { title: 'Team Leadership', platform: 'Coursera', icon: '🎓', url: 'https://www.coursera.org/learn/leading-teams', duration: '8h', free: true },
  ],
  'Agile': [
    { title: 'Agile with Atlassian Jira', platform: 'Coursera', icon: '🎓', url: 'https://www.coursera.org/learn/agile-atlassian-jira', duration: '4h', free: true },
    { title: 'Scrum Master Certification Prep', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=scrum+master+certification+prep', duration: '3h', free: true },
  ],
  'Project Management': [
    { title: 'Google Project Management', platform: 'Coursera', icon: '🎓', url: 'https://www.coursera.org/professional-certificates/google-project-management', duration: '6mo', free: true },
    { title: 'PMP Exam Prep', platform: 'YouTube', icon: '🎥', url: 'https://youtube.com/results?search_query=pmp+exam+prep+2025', duration: '8h', free: true },
  ],
};

// Fallback resources for any skill not in the database
function getDefaultResources(skill: string): LearningResource[] {
  return [
    { title: `${skill} Complete Guide`, platform: 'YouTube', icon: '🎥', url: `https://youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial+2025`, duration: 'Varies', free: true },
    { title: `Learn ${skill}`, platform: 'Google', icon: '🎓', url: `https://www.google.com/search?q=learn+${encodeURIComponent(skill)}+free+course`, duration: 'Self-paced', free: true },
    { title: `${skill} Training`, platform: 'LinkedIn Learning', icon: '💼', url: `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(skill)}`, duration: 'Varies', free: false },
  ];
}

// ═══════════════════════════════════════
// SAMPLE GAP DATA (populated from enhance step)
// ═══════════════════════════════════════
const SAMPLE_GAPS: SkillGap[] = [
  {
    skill: 'Kubernetes',
    confidence: 'ai-added',
    category: 'technical',
    resources: RESOURCE_DATABASE['Kubernetes'] || getDefaultResources('Kubernetes'),
  },
  {
    skill: 'CI/CD',
    confidence: 'ai-added',
    category: 'technical',
    resources: RESOURCE_DATABASE['CI/CD'] || getDefaultResources('CI/CD'),
  },
  {
    skill: 'GraphQL',
    confidence: 'weak',
    category: 'technical',
    resources: RESOURCE_DATABASE['GraphQL'] || getDefaultResources('GraphQL'),
  },
  {
    skill: 'AWS',
    confidence: 'weak',
    category: 'technical',
    resources: RESOURCE_DATABASE['AWS'] || getDefaultResources('AWS'),
  },
  {
    skill: 'Leadership',
    confidence: 'weak',
    category: 'soft',
    resources: RESOURCE_DATABASE['Leadership'] || getDefaultResources('Leadership'),
  },
];

// ═══════════════════════════════════════
// CONFIDENCE BADGE COMPONENT
// ═══════════════════════════════════════
function ConfidenceBadge({ confidence }: { confidence: SkillGap['confidence'] }) {
  const config = {
    'ai-added': { label: 'AI-Added', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '⚠️' },
    'weak': { label: 'Needs Work', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: '📈' },
    'strong': { label: 'Confirmed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: '✅' },
  }[confidence];

  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${config.color}`}>
      {config.icon} {config.label}
    </span>
  );
}

// ═══════════════════════════════════════
// SKILL GAP CARD COMPONENT
// ═══════════════════════════════════════
function SkillGapCard({ gap, index, onPractice }: { gap: SkillGap; index: number; onPractice: (skill: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl glass-card overflow-hidden hover:border-white/[0.1] transition-all"
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
            gap.confidence === 'ai-added' ? 'bg-amber-500/10' :
            gap.confidence === 'weak' ? 'bg-orange-500/10' : 'bg-emerald-500/10'
          }`}>
            {gap.category === 'technical' ? '💻' : gap.category === 'soft' ? '🤝' : '🏢'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{gap.skill}</h3>
            <p className="text-[10px] text-white/30 capitalize">{gap.category} skill</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge confidence={gap.confidence} />
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            className="w-4 h-4 text-white/20"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Expandable resources */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-white/[0.04] pt-3">
              <p className="text-[10px] text-white/25 font-medium uppercase tracking-wider mb-2">
                🎯 Curated Learning Path
              </p>
              {gap.resources.map((resource, i) => (
                <a
                  key={i}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{resource.icon}</span>
                    <div>
                      <p className="text-[11px] text-white/60 font-medium group-hover:text-white/80 transition-colors">{resource.title}</p>
                      <p className="text-[9px] text-white/20">{resource.platform} · {resource.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {resource.free && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">FREE</span>
                    )}
                    <svg className="w-3 h-3 text-white/15 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}

              {/* Gauntlet CTA */}
              <button
                onClick={() => onPractice(gap.skill)}
                className="w-full mt-2 py-2.5 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.08] border border-amber-500/[0.15] text-amber-400 hover:from-amber-500/[0.12] hover:to-orange-500/[0.12] transition-all flex items-center justify-center gap-2"
              >
                <span>⚔️</span> Practice &ldquo;{gap.skill}&rdquo; in The Gauntlet
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════
// MAIN SKILL BRIDGE PAGE
// ═══════════════════════════════════════
export default function SkillBridgePage() {
  const { user } = useStore();
  const router = useRouter();
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [filter, setFilter] = useState<'all' | 'ai-added' | 'weak'>('all');
  const [hasData, setHasData] = useState(false);

  // Load skill gaps from localStorage (saved by enhance step)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tc_skill_gaps');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert stored skills to SkillGap objects with resources
        const gapData: SkillGap[] = (parsed.gaps || []).map((g: any) => ({
          skill: g.skill,
          confidence: g.confidence || 'ai-added',
          category: g.category || 'technical',
          resources: RESOURCE_DATABASE[g.skill] || getDefaultResources(g.skill),
        }));
        if (gapData.length > 0) {
          setGaps(gapData);
          setHasData(true);
          return;
        }
      }
    } catch {}
    // Fallback to sample data for new users / demo
    setGaps(SAMPLE_GAPS);
    setHasData(false);
  }, []);

  const filteredGaps = gaps.filter(g => filter === 'all' || g.confidence === filter);
  const aiAddedCount = gaps.filter(g => g.confidence === 'ai-added').length;
  const weakCount = gaps.filter(g => g.confidence === 'weak').length;

  const handlePractice = (skill: string) => {
    // Navigate to interview simulator (Gauntlet) with skill context
    localStorage.setItem('tc_gauntlet_skill', skill);
    router.push('/suite/help');
  };

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌉</span>
            <h1 className="text-2xl font-bold text-white">Skill Bridge</h1>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-medium">PRO</span>
          </div>
          <p className="text-sm text-white/40 mt-1 max-w-xl">From Resume to Ready — close the gap between what your resume says and what you know.</p>
        </motion.div>

        {/* Mission statement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative mb-8 p-5 rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.06] via-emerald-500/[0.03] to-blue-500/[0.06]" />
          <div className="absolute inset-[1px] rounded-xl bg-[var(--theme-bg-card)]" />
          <div className="relative flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-white/60 leading-relaxed">
                We don&apos;t just dress up your resume.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-semibold">
                  We make you the candidate it says you are.
                </span>
              </p>
              <p className="text-[10px] text-white/20 mt-1">Our AI identified skills that were enhanced on your resume. Here&apos;s your personalized learning path to make them real.</p>
            </div>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          {[
            { label: 'Skills Detected', value: gaps.length, icon: '🔍', color: 'text-cyan-400' },
            { label: 'AI-Enhanced', value: aiAddedCount, icon: '⚠️', color: 'text-amber-400' },
            { label: 'Needs Practice', value: weakCount, icon: '📈', color: 'text-orange-400' },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-xl glass-card text-center">
              <span className="text-base">{stat.icon}</span>
              <p className={`text-lg font-bold ${stat.color} mt-0.5`}>{stat.value}</p>
              <p className="text-[9px] text-white/20">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* No data state */}
        {!hasData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-6 p-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/[0.1]"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <p className="text-[11px] text-blue-400/70">
                <span className="font-semibold">Demo Mode:</span> Run AI Enhance on your resume to see personalized skill gaps.
                These are sample skills to show you how the bridge works.
              </p>
            </div>
          </motion.div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { key: 'all', label: 'All Skills', count: gaps.length },
            { key: 'ai-added', label: 'AI-Added', count: aiAddedCount },
            { key: 'weak', label: 'Needs Work', count: weakCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                filter === f.key
                  ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Skill gap cards */}
        <div className="space-y-2">
          {filteredGaps.map((gap, i) => (
            <SkillGapCard key={gap.skill} gap={gap} index={i} onPractice={handlePractice} />
          ))}
        </div>

        {/* Quick learning resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-10 mb-6"
        >
          <h2 className="text-base font-semibold text-white/70 mb-4 flex items-center gap-2">
            <span>🌐</span> Free Learning Platforms
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { name: 'YouTube', icon: '🎥', url: 'https://youtube.com', desc: 'Free video courses', color: 'from-red-500/10 to-red-600/5' },
              { name: 'freeCodeCamp', icon: '🏗️', url: 'https://freecodecamp.org', desc: 'Free coding bootcamp', color: 'from-emerald-500/10 to-emerald-600/5' },
              { name: 'Google Certs', icon: '🎓', url: 'https://grow.google/certificates/', desc: 'Career certificates', color: 'from-blue-500/10 to-blue-600/5' },
              { name: 'AWS Training', icon: '☁️', url: 'https://skillbuilder.aws/', desc: 'Cloud skills', color: 'from-amber-500/10 to-amber-600/5' },
              { name: 'Coursera', icon: '📚', url: 'https://coursera.org', desc: 'University courses', color: 'from-blue-500/10 to-indigo-600/5' },
              { name: 'LinkedIn Learning', icon: '💼', url: 'https://linkedin.com/learning', desc: 'Professional skills', color: 'from-sky-500/10 to-sky-600/5' },
              { name: 'edX', icon: '🏛️', url: 'https://edx.org', desc: 'MIT/Harvard courses', color: 'from-red-500/10 to-purple-600/5' },
              { name: 'Codecademy', icon: '💻', url: 'https://codecademy.com', desc: 'Interactive coding', color: 'from-violet-500/10 to-violet-600/5' },
            ].map((platform) => (
              <a
                key={platform.name}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-xl glass-card hover:border-white/[0.12] transition-all group"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-base mb-2`}>
                  {platform.icon}
                </div>
                <p className="text-[11px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">{platform.name}</p>
                <p className="text-[9px] text-white/20">{platform.desc}</p>
              </a>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 p-5 rounded-xl bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.04] border border-amber-500/[0.1] text-center"
        >
          <p className="text-base font-semibold text-white/70 mb-1">Ready to put your skills to the test?</p>
          <p className="text-[11px] text-white/25 mb-3">The Gauntlet will simulate real interviews targeting your gap areas.</p>
          <button
            onClick={() => router.push('/suite/help')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-400 hover:from-amber-500/15 hover:to-orange-500/15 transition-all"
          >
            ⚔️ Enter The Gauntlet
          </button>
        </motion.div>
      </div>
    </div>
  );
}
