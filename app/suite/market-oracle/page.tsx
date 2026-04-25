'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { authFetch } from '@/lib/auth-fetch';
import PageHelp from '@/components/PageHelp';
import FileUploadDropzone from '@/components/FileUploadDropzone';
import { calculateFitScore, type RealJob } from '@/lib/job-search-api';
import { useRouter } from 'next/navigation';
import { type ResumeVersion } from '@/lib/database-suite';
import ResumeLibraryPicker from '@/components/ResumeLibraryPicker';

// Types
interface JobStar {
  id: string;
  title: string;
  company: string;
  salary: number;
  skills: string[];
  fitScore: number;
  position: [number, number, number];
  color: string;
  isConstellation: boolean;
  // Real job fields
  url?: string;
  location?: string;
  description?: string;
  isReal?: boolean;
  source?: string;
}

interface BridgeSkill {
  skill: string;
  impact: number;
  newPosition: [number, number, number];
  salaryIncrease: number;
  newFitScore: number;
}

interface MarketAnalysis {
  currentPosition: [number, number, number];
  talentDensityPercentile: number;
  topSkills: string[];
  missingSkills: string[];
  bridgeSkills: BridgeSkill[];
  jobs: JobStar[];
  marketTrends: { skill: string; growth: number }[];
  industryInsights: string[];
  jobDataSource: string;
}

// JD Decoder analysis from Dual-AI
interface JDIntelligence {
  fitScore: number;
  fitVerdict: string;
  overallAssessment: string;
  competitiveEdge: string;
  matchedSkills: string[];
  gapSkills: string[];
  keywordsToAdd: string[];
  salaryIntel: { min: number; max: number; userPosition: number; withBridgeSkills: number; currency: string };
  redFlags: { flag: string; severity: 'low' | 'medium' | 'high'; explanation: string }[];
  hiddenRequirements: { stated: string; actual: string }[];
  roleLevel: string;
  bridgeSkills: { skill: string; impact: number; salaryIncrease: number }[];
  marketTrends: { skill: string; growth: number }[];
  industryInsights: string[];
}

// Generate mock job data with positions
const generateJobStars = (skills: string[], count: number = 50): JobStar[] => {
  const companies = ['Google', 'Meta', 'Apple', 'Microsoft', 'Amazon', 'Netflix', 'Stripe', 'OpenAI', 'Anthropic', 'Tesla', 'SpaceX', 'Nvidia', 'Salesforce', 'Adobe', 'Uber'];
  const titles = ['Senior Engineer', 'Staff Engineer', 'Tech Lead', 'Principal Engineer', 'Engineering Manager', 'ML Engineer', 'Data Scientist', 'DevOps Lead', 'Architect', 'VP Engineering'];

  return Array.from({ length: count }, (_, i) => {
    const salary = 120000 + Math.random() * 280000;
    const fitScore = 0.3 + Math.random() * 0.7;

    // Position: X/Y for skill clusters, Z for salary
    const x = (Math.random() - 0.5) * 20;
    const y = (Math.random() - 0.5) * 20;
    const z = (salary - 120000) / 28000 - 5; // Normalize Z to -5 to 5 range

    return {
      id: `job-${i}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      company: companies[Math.floor(Math.random() * companies.length)],
      salary: Math.round(salary),
      skills: skills.slice(0, 3 + Math.floor(Math.random() * 5)),
      fitScore,
      position: [x, y, z] as [number, number, number],
      color: fitScore > 0.8 ? '#00f2ff' : fitScore > 0.6 ? '#a855f7' : fitScore > 0.4 ? '#22c55e' : '#6b7280',
      isConstellation: fitScore > 0.75,
    };
  });
};

const OracleScene = dynamic(() => import('./Scene'), { ssr: false });

// Dynamic Canvas wrapper to avoid SSR crash from react-reconciler
const DynamicCanvas = dynamic(
  () => import('@react-three/fiber').then((mod) => {
    const { Canvas } = mod;
    // Wrap Canvas in a forwardRef-compatible component
    return function CanvasWrapper(props: any) {
      return <Canvas {...props} />;
    };
  }),
  { ssr: false }
);

// Main Component
export default function MarketOraclePage() {
  const { user } = useStore();
  const router = useRouter();
  const [step, setStep] = useState<'setup' | 'analyzing' | 'oracle'>('setup');
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('');
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [jdIntel, setJdIntel] = useState<JDIntelligence | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobStar | null>(null);
  const [showBridge, setShowBridge] = useState(false);
  const [activeBridgeSkill, setActiveBridgeSkill] = useState<BridgeSkill | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState(0);
  const [showIntelPanel, setShowIntelPanel] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState<'uploading' | 'extracting' | 'parsing' | null>(null);

  // Saved Resumes integration
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedResumeName, setSelectedResumeName] = useState('');

  const formatResumeToText = (content: any) => {
    if (!content) return '';
    const parts: string[] = [];
    if (content.name) parts.push(content.name);
    if (content.title) parts.push(content.title);
    if (content.summary) parts.push(content.summary);
    if (content.skills?.length) parts.push(`Skills: ${content.skills.join(', ')}`);
    if (content.experience?.length) {
      parts.push('Experience:');
      content.experience.forEach((e: any) => {
        parts.push(`${e.role || e.title} at ${e.company} (${e.duration || e.date || ''})`);
        if (e.achievements?.length) e.achievements.forEach((a: string) => parts.push(`• ${a}`));
        if (e.description) parts.push(e.description);
      });
    }
    if (content.education?.length) {
      parts.push('Education:');
      content.education.forEach((e: any) => parts.push(`${e.degree} from ${e.school} (${e.date || ''})`));
    }
    return parts.join('\n\n');
  };

  const handleSelectResume = (rv: ResumeVersion) => {
    const text = formatResumeToText(rv.content);
    setResumeText(text);
    setSelectedResumeId(rv.id);
    setSelectedResumeName(rv.version_name);
  };


  // Handle resume upload via FileUploadDropzone
  const handleResumeUploaded = (text: string, _fileName: string) => {
    setResumeText(text.trim());
    setIsUploading(false);
    setProcessingStage(null);
    showToast('Resume loaded!', 'check_circle');
  };

  // Analyze market position with Dual-AI
  const analyzeMarket = async () => {
    if (!resumeText.trim()) {
      showToast('Please upload your resume', 'cancel');
      return;
    }

    setStep('analyzing');
    setAnalyzeStage(0);
    setJdIntel(null);

    try {
      // ═══ STAGE 1: Dual-AI JD Analysis (if JD provided) ═══
      if (jdText.trim()) {
        setAnalyzeStage(1);
        try {
          const intelRes = await authFetch('/api/oracle/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText, jdText, targetRole, location }),
          });
          const intelData = await intelRes.json();
          if (intelData.success && intelData.analysis) {
            setJdIntel(intelData.analysis);
          }
        } catch (intelError) {
          console.warn('Dual-AI analysis unavailable, continuing with basic analysis:', intelError);
        }
      }

      // ═══ STAGE 2: Job Market Scan ═══
      setAnalyzeStage(2);

      let jobs: JobStar[] = [];
      let jobDataSource = 'Mock Data (Fallback)';

      // Use JD intel skills if available, otherwise try to extract from JD text
      const topSkillsFallback = ['JavaScript', 'Python', 'React', 'Node.js', 'SQL'];
      const extractedSkills = jdIntel?.matchedSkills || topSkillsFallback;

      try {
        const searchQuery = targetRole || (jdText ? jdText.substring(0, 100) : extractedSkills.slice(0, 3).join(' '));
        const jobResponse = await fetch(`/api/jobs/search?query=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location || '')}`);
        const jobData = await jobResponse.json();

        if (jobData.success && jobData.jobs && jobData.jobs.length > 0) {
          jobDataSource = `${jobData.source} (${jobData.jobs.length} real jobs)`;

          jobs = jobData.jobs.map((job: any, index: number) => {
            const fitScore = calculateFitScore(jdIntel?.matchedSkills || extractedSkills, job.skills || []);
            const salary = job.salary?.max || job.salary?.min || (100000 + Math.random() * 150000);

            const angle = (index / jobData.jobs.length) * Math.PI * 2;
            const radius = (1 - fitScore) * 10 + 2;
            const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 3;
            const y = Math.sin(angle) * radius + (Math.random() - 0.5) * 3;
            const z = (salary - 100000) / 50000 - 2;

            return {
              id: job.id || `job-${index}`,
              title: job.title,
              company: job.company,
              salary: Math.round(salary),
              skills: job.skills || [],
              fitScore,
              position: [x, y, z] as [number, number, number],
              color: fitScore > 0.7 ? '#00f2ff' : fitScore > 0.5 ? '#a855f7' : fitScore > 0.3 ? '#22c55e' : '#6b7280',
              isConstellation: fitScore > 0.6,
              url: job.url,
              location: job.location,
              description: job.description?.substring(0, 500),
              isReal: true,
              source: job.source,
            };
          });

          showToast(`Found ${jobs.length} real job matches!`, 'my_location');
        }
      } catch (jobError) {
        console.error('Job search error, using fallback:', jobError);
      }

      if (jobs.length === 0) {
        jobs = generateJobStars(jdIntel?.matchedSkills || extractedSkills, 60);
        jobDataSource = 'Simulated Data';
      }

      // ═══ STAGE 3: Build Analysis ═══
      setAnalyzeStage(3);

      const percentile = jdIntel?.fitScore || 50;
      const userZ = (percentile / 100) * 6 - 3;
      const currentPosition: [number, number, number] = [0, 0, userZ];

      const bridgeSkillsData = jdIntel?.bridgeSkills || [];
      const bridgeSkills: BridgeSkill[] = bridgeSkillsData.slice(0, 3).map((bs, i) => ({
        ...bs,
        newPosition: [
          currentPosition[0] + (Math.random() - 0.5) * 4,
          currentPosition[1] + (Math.random() - 0.5) * 4,
          currentPosition[2] + (bs.impact / 10) * 3,
        ] as [number, number, number],
        newFitScore: Math.min(0.95, 0.6 + bs.impact * 0.035),
      }));

      setAnalysis({
        currentPosition,
        talentDensityPercentile: percentile,
        topSkills: jdIntel?.matchedSkills || extractedSkills,
        missingSkills: jdIntel?.gapSkills || [],
        bridgeSkills,
        jobs,
        marketTrends: jdIntel?.marketTrends || [],
        industryInsights: jdIntel?.industryInsights || [],
        jobDataSource,
      });

      setStep('oracle');
      showToast(jdText.trim() ? 'Dual-AI analysis complete!' : 'Market analysis complete!', 'check_circle');
    } catch (error) {
      console.error('Analysis error:', error);
      showToast('Error analyzing market', 'cancel');
      setStep('setup');
    }
  };

  // Handle bridge skill toggle
  const toggleBridgeSkill = (skill: BridgeSkill) => {
    if (activeBridgeSkill?.skill === skill.skill) {
      setActiveBridgeSkill(null);
      setShowBridge(false);
    } else {
      setActiveBridgeSkill(skill);
      setShowBridge(true);
    }
  };

  // Handle job selection
  useEffect(() => {
    if (selectedJob) {
      setShowJobCard(true);
    }
  }, [selectedJob]);


  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {/* SETUP STEP */}
        {step === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 lg:p-8"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-indigo-900/30 to-cyan-900/30 border border-white/10 p-8 mb-8"
            >
              <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
                {/* Animated stars background */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(30)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        opacity: [0.2, 1, 0.2],
                        scale: [1, 1.5, 1],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-4">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs font-medium text-indigo-400">Career Intelligence Engine</span>
                  </motion.div>
                  <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">
                    Market Oracle
                  </h1>
                  <p className="text-silver text-sm max-w-2xl">
                    Paste a job description + your resume → Dual-AI decodes your fit score, salary intel, red flags, and bridge skills in the 3D Starfield.
                  </p>
                </div>
                <PageHelp toolId="market-oracle" />
              </div>
            </motion.div>

            <div className="max-w-4xl mx-auto space-y-6">
              {/* Resume Upload */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6"
              >
                <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="text-xl"><span className="material-symbols-rounded align-middle">description</span></span> Your Resume
                  <div className="ml-auto">
                    <ResumeLibraryPicker
                      onSelect={handleSelectResume}
                      selectedId={selectedResumeId}
                      selectedName={selectedResumeName}
                      compact
                    />
                  </div>
                </h3>
                {!resumeText ? (
                  <FileUploadDropzone
                    onUploadSuccess={handleResumeUploaded}
                    isUploading={isUploading}
                    setIsUploading={setIsUploading}
                    variant="large"
                    processingStage={processingStage}
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 font-medium">✓ Resume loaded ({resumeText.length.toLocaleString()} chars)</span>
                      <button onClick={() => setResumeText('')} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* JD Decoder Input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl opacity-50 block dark:opacity-100" />
                <div className="relative">
                  <h3 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                    <span className="text-xl"><span className="material-symbols-rounded">content_paste</span></span> Paste Job Description
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] border border-emerald-500/30 font-medium">JD DECODER</span>
                  </h3>
                  <p className="text-xs text-silver mb-4">Paste any JD to unlock Dual-AI fit analysis, red flags, salary intel, and hidden requirements.</p>
                  <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-emerald-500/50 text-sm resize-none transition-colors"
                    placeholder="Paste the full job description here...

e.g., 'We're looking for a Senior Software Engineer to join our platform team...'"
                    rows={5}
                  />
                  {jdText.trim() && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-emerald-400">✓ JD loaded • Dual-AI analysis will activate</span>
                      <button onClick={() => setJdText('')} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Target Role & Location */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid md:grid-cols-2 gap-4"
              >
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6">
                  <h3 className="font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <span className="text-xl"><span className="material-symbols-rounded">my_location</span></span> Target Role (Optional)
                  </h3>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none"
                    placeholder="e.g., Senior ML Engineer"
                  />
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6">
                  <h3 className="font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <span className="text-xl"><span className="material-symbols-rounded align-middle">pin_drop</span></span> Location (Optional)
                  </h3>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none"
                    placeholder="e.g., San Francisco, Remote"
                  />
                </div>
              </motion.div>

              {/* Launch Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center pt-4"
              >
                <button
                  onClick={analyzeMarket}
                  disabled={!resumeText.trim()}
                  className="group px-8 py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-[var(--text-primary)] hover:border-indigo-500/50 shadow-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-xl"><span className="material-symbols-rounded">rocket_launch</span></span>
                  {jdText.trim() ? 'Decode JD + Analyze Market' : 'Launch Market Oracle'}
                </button>
              </motion.div>

              {/* Inline Feature Strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-6 pt-6 flex-wrap"
              >
                {[
                  { icon: 'content_paste', label: 'JD Decoder' },
                  { icon: 'payments', label: 'Salary Intel' },
                  { icon: 'flag', label: 'Red Flags' },
                  { icon: 'hub', label: '3D Starfield' },
                  { icon: 'route', label: 'Bridge Skills' },
                  { icon: 'my_location', label: 'Actions' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-silver text-sm font-medium">
                    <span className="text-lg material-symbols-rounded">{f.icon}</span>
                    <span>{f.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ANALYZING STEP — Dual-AI Pipeline */}
        {step === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-8"
          >
            <div className="text-center max-w-lg">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="w-32 h-32 mx-auto mb-8 relative"
              >
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-indigo-400 border-b-cyan-400 border-l-transparent animate-spin" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <span className="material-symbols-rounded text-4xl">query_stats</span>
                </div>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-6">
                {jdText.trim() ? 'Dual-AI Decoding Your Fit' : 'Scanning the Market Universe'}
              </h2>
              {/* Pipeline Stages */}
              <div className="space-y-3 mb-6">
                {[
                  { stage: 1, label: 'AI Processor', desc: 'Extracting skills, parsing JD, detecting red flags', icon: 'memory' },
                  { stage: 2, label: 'AI Validator', desc: 'Cross-validating, scoring fit, refining salary intel', icon: 'auto_awesome' },
                  { stage: 3, label: 'Market Scan', desc: 'Mapping job opportunities in 3D space', icon: 'scatter_plot' },
                ].map((s) => (
                  <motion.div
                    key={s.stage}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: s.stage * 0.3 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      analyzeStage >= s.stage
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : analyzeStage === s.stage - 1
                        ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse'
                        : 'bg-[var(--theme-bg-elevated)] border-white/10 opacity-40'
                    }`}
                  >
                    <span className="material-symbols-rounded text-2xl">{analyzeStage > s.stage ? 'check_circle' : s.icon}</span>
                    <div className="text-left flex-1">
                      <p className="text-sm font-semibold text-white">{s.label}</p>
                      <p className="text-xs text-silver">{s.desc}</p>
                    </div>
                    {analyzeStage === s.stage && (
                      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ORACLE STEP - 3D Visualization */}
        {step === 'oracle' && analysis && (
          <motion.div
            key="oracle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-screen flex flex-col overflow-hidden"
          >
            {/* HUD Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 pointer-events-none">
              <div className="flex items-start justify-between gap-4 pointer-events-auto">
                {/* Left HUD - Talent Density */}
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="glass-card p-4 !border-cyan-500/30 max-w-xs"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90">
                        <circle cx="40" cy="40" r="35" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
                        <circle
                          cx="40" cy="40" r="35"
                          stroke="url(#densityGradient)"
                          strokeWidth="6"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${analysis.talentDensityPercentile * 2.2} 220`}
                        />
                        <defs>
                          <linearGradient id="densityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#00f2ff" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-cyan-400">{analysis.talentDensityPercentile}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-silver uppercase tracking-wider">Talent Density</p>
                      <p className="text-lg font-bold text-white">Top {100 - analysis.talentDensityPercentile}%</p>
                      <p className="text-xs text-cyan-400">
                        {analysis.talentDensityPercentile > 80 ? 'Unicorn Status' :
                          analysis.talentDensityPercentile > 60 ? 'High Demand' :
                            analysis.talentDensityPercentile > 40 ? 'Competitive' : 'Growth Opportunity'}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Center HUD - Bridge Skills */}
                <motion.div
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-4 !border-cyan-500/30"
                >
                  <p className="text-xs text-silver uppercase tracking-wider mb-2 text-center flex justify-center items-center gap-1"><span className="material-symbols-rounded text-[14px] align-middle">route</span> Bridge Skills</p>
                  <div className="flex gap-2">
                    {analysis.bridgeSkills.map((skill, i) => (
                      <button
                        key={skill.skill}
                        onClick={() => toggleBridgeSkill(skill)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeBridgeSkill?.skill === skill.skill
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                          : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                      >
                        <span className="block">{skill.skill}</span>
                        <span className="text-xs text-green-400">+${(skill.salaryIncrease / 1000).toFixed(0)}K</span>
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Right HUD - Actions & Data Source */}
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col gap-2 items-end"
                >
                  {/* Data Source Badge */}
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${analysis.jobDataSource.includes('real') || analysis.jobDataSource.includes('API')
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    }`}>
                    {analysis.jobDataSource.includes('real') || analysis.jobDataSource.includes('API') ? <span className="material-symbols-rounded text-[12px] align-middle">public</span> : <span className="text-[12px] inline-block -mb-0.5"><span className="material-symbols-rounded">bolt</span></span>} {analysis.jobDataSource}
                  </div>
                  <button
                    onClick={() => setStep('setup')}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20"
                  >
                    ← New Scan
                  </button>
                </motion.div>
              </div>
            </div>

            {/* 3D Canvas */}
            <div className="flex-1 relative w-full h-full">
              <DynamicCanvas className="w-full h-full" camera={{ position: [0, 0, 15], fov: 60 }}>
                <Suspense fallback={null}>
                  <OracleScene
                    analysis={analysis}
                    selectedJob={selectedJob}
                    setSelectedJob={setSelectedJob}
                    showBridge={showBridge}
                    activeBridgeSkill={activeBridgeSkill}
                  />
                </Suspense>
              </DynamicCanvas>
            </div>

            {/* Bottom HUD */}
            <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
              <div className="flex items-end justify-between gap-4 pointer-events-auto">
                {/* Skills Panel */}
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-4 max-w-md"
                >
                  <p className="text-xs text-silver uppercase tracking-wider mb-2">Your Top Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.topSkills.map((skill) => (
                      <span key={skill} className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs border border-cyan-500/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-silver uppercase tracking-wider mt-3 mb-2">Missing Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.missingSkills.map((skill) => (
                      <span key={skill} className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs border border-red-500/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Market Trends */}
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-4 max-w-sm"
                >
                  <p className="text-xs text-silver uppercase tracking-wider mb-2 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded align-middle">trending_up</span></span> Market Trends</p>
                  <div className="space-y-2">
                    {analysis.marketTrends.slice(0, 4).map((trend) => (
                      <div key={trend.skill} className="flex items-center justify-between">
                        <span className="text-sm text-white">{trend.skill}</span>
                        <span className={`text-xs ${trend.growth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {trend.growth > 0 ? '↑' : '↓'} {Math.abs(trend.growth)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Instructions */}
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card p-4"
                >
                  <p className="text-xs text-silver">
                    <span className="text-[14px] inline-block -mb-0.5"><span className="material-symbols-rounded align-middle">mouse</span></span> Drag to rotate • Scroll to zoom • Click stars for details
                  </p>
                  <p className="text-xs text-cyan-400 mt-1">
                    <span className="text-[14px] inline-block -mb-0.5"><span className="material-symbols-rounded align-middle">star</span></span> Bright stars = 80%+ match • Lines = constellation paths
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Job Card Modal */}
            <AnimatePresence>
              {showJobCard && selectedJob && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <div className="glass-card p-6 !border-cyan-500/30 w-[420px] max-h-[80vh] overflow-y-auto">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-white">{selectedJob.title}</h3>
                          {selectedJob.isReal && (
                            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] border border-green-500/30">
                              REAL JOB
                            </span>
                          )}
                        </div>
                        <p className="text-cyan-400">{selectedJob.company}</p>
                        {selectedJob.location && (
                          <p className="text-silver text-sm flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded align-middle">pin_drop</span></span> {selectedJob.location}</p>
                        )}
                      </div>
                      <button
                        onClick={() => { setShowJobCard(false); setSelectedJob(null); }}
                        className="p-2 rounded-lg hover:bg-white/10"
                      >
                        <svg className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                        <span className="text-sm text-silver">Salary</span>
                        <span className="text-xl font-bold text-green-400">${selectedJob.salary.toLocaleString()}</span>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-silver">Match Score</span>
                          <span className={`text-lg font-bold ${selectedJob.fitScore > 0.8 ? 'text-cyan-400' :
                            selectedJob.fitScore > 0.6 ? 'text-green-400' : 'text-yellow-400'
                            }`}>{Math.round(selectedJob.fitScore * 100)}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-500 rounded-full"
                            style={{ width: `${selectedJob.fitScore * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-silver uppercase tracking-wider mb-2">Required Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.skills.map((skill) => (
                            <span
                              key={skill}
                              className={`px-2 py-1 rounded-full text-xs ${analysis.topSkills.includes(skill)
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                        <p className="text-xs text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded align-middle">lightbulb</span></span> Why You'll Win</p>
                        <p className="text-sm text-silver">
                          {selectedJob.fitScore > 0.8
                            ? "Your skills are a near-perfect match. You're a top candidate for this role."
                            : selectedJob.fitScore > 0.6
                              ? "Strong alignment with 2-3 skill gaps that are learnable in 3-6 months."
                              : "Consider upskilling in the missing areas to become competitive."}
                        </p>
                      </div>

                      {/* Apply Button for Real Jobs */}
                      {selectedJob.isReal && selectedJob.url && (
                        <a
                          href={selectedJob.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-center font-bold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                        >
                          Apply Now →
                        </a>
                      )}

                      {/* Source indicator */}
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-center text-silver">
                          {selectedJob.isReal ? (
                            <span className="flex items-center justify-center gap-1"><span className="material-symbols-rounded text-[14px] align-middle">public</span> Source: <span className="text-cyan-400">{selectedJob.source || 'Job Board'}</span></span>
                          ) : (
                            <span className="flex items-center justify-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">bolt</span></span> Simulated job based on market data</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ JD INTELLIGENCE PANEL ═══ */}
            <AnimatePresence>
              {jdIntel && showIntelPanel && (
                <motion.div
                  initial={{ opacity: 0, x: -60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  className="absolute left-4 top-20 bottom-20 z-20 w-[380px] overflow-y-auto"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
                >
                  <div className="glass-card !border-emerald-500/30 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl"><span className="material-symbols-rounded">content_paste</span></span>
                          <div>
                            <h3 className="text-sm font-bold text-white">JD Intelligence Report</h3>
                            <p className="text-[10px] text-silver">Dual-AI Analysis</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowIntelPanel(false)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-silver"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Fit Score */}
                      <div className="text-center p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                        <div className="relative w-24 h-24 mx-auto mb-3">
                          <svg className="w-24 h-24 -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                            <circle
                              cx="48" cy="48" r="40"
                              stroke={jdIntel.fitScore > 75 ? '#22c55e' : jdIntel.fitScore > 50 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="8"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={`${jdIntel.fitScore * 2.51} 251`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl font-bold ${jdIntel.fitScore > 75 ? 'text-emerald-400' : jdIntel.fitScore > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {jdIntel.fitScore}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-white mb-1 flex items-center justify-center gap-1">
                          {jdIntel.fitVerdict === 'excellent' ? <><span className="text-[14px]"><span className="material-symbols-rounded align-middle">star</span></span> Excellent Match</> :
                           jdIntel.fitVerdict === 'strong' ? <><span className="text-[14px]"><span className="material-symbols-rounded align-middle">fitness_center</span></span> Strong Match</> :
                           jdIntel.fitVerdict === 'moderate' ? <><span className="text-[14px]"><span className="material-symbols-rounded">bar_chart</span></span> Moderate Match</> : <><span className="text-[14px]"><span className="material-symbols-rounded">my_location</span></span> Growth Opportunity</>}
                        </p>
                        <p className="text-[11px] text-silver">{jdIntel.overallAssessment}</p>
                      </div>

                      {/* Matched vs Gap Skills */}
                      <div>
                        <p className="text-xs text-silver uppercase tracking-wider mb-2 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">check_circle</span></span> Matched Skills</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {jdIntel.matchedSkills.slice(0, 8).map(s => (
                            <span key={s} className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">{s}</span>
                          ))}
                        </div>
                        <p className="text-xs text-silver uppercase tracking-wider mb-2 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">cancel</span></span> Gap Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {jdIntel.gapSkills.slice(0, 6).map(s => (
                            <span key={s} className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] border border-red-500/30">{s}</span>
                          ))}
                        </div>
                      </div>

                      {/* Keywords to Add */}
                      {jdIntel.keywordsToAdd?.length > 0 && (
                        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                          <p className="text-xs text-cyan-400 font-semibold mb-2 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">key</span></span> Keywords to Add to Resume</p>
                          <div className="flex flex-wrap gap-1.5">
                            {jdIntel.keywordsToAdd.slice(0, 8).map(k => (
                              <span key={k} className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px]">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Salary Intel */}
                      <div className="p-3 rounded-xl bg-[var(--theme-bg-input)] border border-[var(--theme-border)]">
                        <p className="text-xs text-silver uppercase tracking-wider mb-3 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">payments</span></span> Salary Intelligence</p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-silver">Range</span>
                            <span className="text-sm font-bold text-green-400">
                              ${(jdIntel.salaryIntel.min / 1000).toFixed(0)}K — ${(jdIntel.salaryIntel.max / 1000).toFixed(0)}K
                            </span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden relative">
                            <div className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full" />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-cyan-400 shadow-lg"
                              style={{ left: `${Math.max(5, Math.min(95, jdIntel.salaryIntel.userPosition))}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-silver">
                            <span>Your position: top {100 - jdIntel.salaryIntel.userPosition}%</span>
                            <span className="text-emerald-400">+bridge: ${(jdIntel.salaryIntel.withBridgeSkills / 1000).toFixed(0)}K</span>
                          </div>
                        </div>
                      </div>

                      {/* Red Flags */}
                      {jdIntel.redFlags?.length > 0 && (
                        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                          <p className="text-xs text-red-400 font-semibold mb-2 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded align-middle">flag</span></span> Red Flags Detected</p>
                          <div className="space-y-2">
                            {jdIntel.redFlags.slice(0, 4).map((rf, i) => (
                              <div key={i} className="flex gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                  rf.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                  rf.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>{rf.severity.toUpperCase()}</span>
                                <div>
                                  <p className="text-xs text-white font-medium">{rf.flag}</p>
                                  <p className="text-[10px] text-silver">{rf.explanation}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hidden Requirements */}
                      {jdIntel.hiddenRequirements?.length > 0 && (
                        <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                          <p className="text-xs text-indigo-400 font-semibold mb-2 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">psychology</span></span> Hidden Requirements</p>
                          <div className="space-y-2">
                            {jdIntel.hiddenRequirements.slice(0, 4).map((hr, i) => (
                              <div key={i} className="text-xs">
                                <p className="text-silver line-through">{hr.stated}</p>
                                <p className="text-white font-medium">→ {hr.actual}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Competitive Edge */}
                      {jdIntel.competitiveEdge && (
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                          <p className="text-xs text-emerald-400 font-semibold mb-1 flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">bolt</span></span> Your Competitive Edge</p>
                          <p className="text-xs text-silver">{jdIntel.competitiveEdge}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <p className="text-xs text-silver uppercase tracking-wider flex items-center gap-1"><span className="text-[14px]"><span className="material-symbols-rounded">my_location</span></span> Take Action</p>
                        <button
                          onClick={() => router.push('/suite/resume')}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                        >
                          <span className="flex items-center justify-center gap-2"><span className="text-[18px]"><span className="material-symbols-rounded align-middle">sync</span></span> Morph Resume for This JD</span>
                        </button>
                        <button
                          onClick={() => router.push('/suite/resume')}
                          className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 border border-white/10 transition-all"
                        >
                          <span className="flex items-center justify-center gap-2"><span className="text-[18px]"><span className="material-symbols-rounded align-middle">mail</span></span> Generate Cover Letter</span>
                        </button>
                        <button
                          onClick={() => router.push('/suite/flashcards')}
                          className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 border border-white/10 transition-all"
                        >
                          <span className="flex items-center justify-center gap-2"><span className="text-[18px]"><span className="material-symbols-rounded align-middle">school</span></span> Practice Interview for This Role</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle Intel Panel button (when hidden) */}
            {jdIntel && !showIntelPanel && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setShowIntelPanel(true)}
                className="absolute left-4 top-20 z-20 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-all backdrop-blur-xl"
              >
                <span className="flex items-center gap-2"><span className="text-[18px]"><span className="material-symbols-rounded">content_paste</span></span> Show JD Intelligence</span>
              </motion.button>
            )}

            {/* Bridge Skill Impact Panel */}
            <AnimatePresence>
              {activeBridgeSkill && (
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                >
                  <div className="glass-card p-6 rounded-2xl border border-cyan-500/30 bg-[var(--theme-bg-card)]/95 backdrop-blur-xl w-80">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                        <span className="text-2xl text-white"><span className="material-symbols-rounded align-middle">route</span></span>
                      </div>
                      <div>
                        <p className="text-xs text-silver uppercase">Bridge Skill</p>
                        <h4 className="text-lg font-bold text-white">{activeBridgeSkill.skill}</h4>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10">
                        <span className="text-sm text-silver">Salary Increase</span>
                        <span className="text-lg font-bold text-green-400">+${activeBridgeSkill.salaryIncrease.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10">
                        <span className="text-sm text-silver">New Fit Score</span>
                        <span className="text-lg font-bold text-cyan-400">{Math.round(activeBridgeSkill.newFitScore * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10">
                        <span className="text-sm text-silver">Impact Rating</span>
                        <span className="text-lg font-bold text-cyan-400">{activeBridgeSkill.impact}/10</span>
                      </div>
                    </div>

                    <p className="text-xs text-silver mt-4 text-center flex items-center justify-center gap-1">
                      <span className="material-symbols-rounded text-[14px] align-middle">radio_button_checked</span> Purple marker shows your projected position
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
