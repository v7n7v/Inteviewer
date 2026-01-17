'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import dynamic from 'next/dynamic';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

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

// Main Component
export default function MarketOraclePage() {
  const { user } = useStore();
  const [step, setStep] = useState<'setup' | 'analyzing' | 'oracle'>('setup');
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('');
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobStar | null>(null);
  const [showBridge, setShowBridge] = useState(false);
  const [activeBridgeSkill, setActiveBridgeSkill] = useState<BridgeSkill | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File processing
  const processFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isWord = fileType.includes('wordprocessingml') || fileName.endsWith('.docx');
    const isText = fileType === 'text/plain' || fileName.endsWith('.txt');

    if (!isPDF && !isWord && !isText) {
      showToast('Upload PDF, Word, or TXT', '❌');
      return;
    }

    try {
      let text = '';
      if (isPDF) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else if (isWord) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }

      setResumeText(text.trim());
      showToast('Resume loaded!', '✅');
    } catch {
      showToast('Error processing file', '❌');
    }
  };

  // Analyze market position
  const analyzeMarket = async () => {
    if (!resumeText.trim()) {
      showToast('Please upload your resume', '❌');
      return;
    }

    setStep('analyzing');

    try {
      const response = await groqJSONCompletion<{
        topSkills: string[];
        missingSkills: string[];
        bridgeSkills: { skill: string; impact: number; salaryIncrease: number }[];
        talentDensityPercentile: number;
        marketTrends: { skill: string; growth: number }[];
        industryInsights: string[];
      }>(
        `You are a Lead Data Scientist analyzing talent market positioning. Analyze this resume against current market demands for ${targetRole || 'tech roles'} in ${location || 'the US'}.`,
        `RESUME:\n${resumeText}\n\nAnalyze and return JSON:
{
  "topSkills": ["skill1", "skill2", ...] (candidate's strongest 5-7 skills),
  "missingSkills": ["skill1", ...] (3-5 in-demand skills they lack),
  "bridgeSkills": [
    {"skill": "specific skill name", "impact": 1-10 score, "salaryIncrease": estimated $ increase}
  ] (top 3 skills that would maximize career growth),
  "talentDensityPercentile": 1-100 (how rare is this candidate in current market),
  "marketTrends": [{"skill": "name", "growth": % growth}] (5 trending skills in their field),
  "industryInsights": ["insight1", ...] (3 actionable market insights)
}`,
        { temperature: 0.3, maxTokens: 2000 }
      );

      // Generate job stars based on skills
      const jobs = generateJobStars(response.topSkills, 60);

      // Calculate user position (center-ish, based on percentile)
      const userZ = (response.talentDensityPercentile / 100) * 6 - 3;
      const currentPosition: [number, number, number] = [0, 0, userZ];

      // Calculate bridge skill positions
      const bridgeSkills: BridgeSkill[] = response.bridgeSkills.map((bs, i) => ({
        ...bs,
        newPosition: [
          currentPosition[0] + (Math.random() - 0.5) * 4,
          currentPosition[1] + (Math.random() - 0.5) * 4,
          currentPosition[2] + (bs.impact / 10) * 3
        ] as [number, number, number],
        newFitScore: Math.min(0.95, 0.6 + bs.impact * 0.035),
      }));

      setAnalysis({
        currentPosition,
        talentDensityPercentile: response.talentDensityPercentile,
        topSkills: response.topSkills,
        missingSkills: response.missingSkills,
        bridgeSkills,
        jobs,
        marketTrends: response.marketTrends,
        industryInsights: response.industryInsights,
      });

      setStep('oracle');
      showToast('Market analysis complete!', '✅');
    } catch (error) {
      console.error('Analysis error:', error);
      showToast('Error analyzing market', '❌');
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-card p-12 text-center max-w-md">
          <span className="text-6xl mb-4 block">🔒</span>
          <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
          <p className="text-slate-400">Please sign in to access Market Oracle</p>
        </div>
      </div>
    );
  }

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
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-indigo-900/30 to-purple-900/30 border border-white/10 p-8 mb-8"
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
              <div className="relative z-10">
                <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-4">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs font-medium text-indigo-400">Career Intelligence Engine</span>
                </motion.div>
                <h1 className="text-4xl lg:text-5xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Market Oracle
                  </span>
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl">
                  Navigate the 3D Opportunity Starfield. Discover your market position, find bridge skills, and chart your path to higher-paying roles.
                </p>
              </div>
            </motion.div>

            <div className="max-w-4xl mx-auto space-y-6">
              {/* Resume Upload */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/5 border border-white/10 p-6"
              >
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <span>📄</span> Your Resume
                </h3>
                {!resumeText ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => { e.preventDefault(); setDragActive(false); e.dataTransfer.files[0] && processFile(e.dataTransfer.files[0]); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${dragActive ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/20 hover:border-white/40'
                      }`}
                  >
                    <span className="text-4xl block mb-3">🚀</span>
                    <p className="text-white font-medium">Drop resume or click to upload</p>
                    <p className="text-sm text-slate-400 mt-1">PDF, Word, or TXT</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 font-medium">✓ Resume loaded</span>
                      <button onClick={() => setResumeText('')} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Target Role & Location */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid md:grid-cols-2 gap-4"
              >
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span>🎯</span> Target Role (Optional)
                  </h3>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none"
                    placeholder="e.g., Senior ML Engineer"
                  />
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span>📍</span> Location (Optional)
                  </h3>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none"
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
                  className="group relative px-12 py-5 rounded-2xl font-bold text-xl overflow-hidden disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <span className="relative flex items-center gap-3 text-white">
                    <span className="text-2xl">🔮</span>
                    Launch Market Oracle
                  </span>
                </button>
              </motion.div>

              {/* Features Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid md:grid-cols-3 gap-4 pt-8"
              >
                {[
                  { icon: '🌌', title: '3D Starfield', desc: 'Navigate job opportunities in 3D space' },
                  { icon: '🌉', title: 'Bridge Skills', desc: 'Discover skills that unlock higher salaries' },
                  { icon: '💎', title: 'Talent Density', desc: 'See how rare you are in the market' },
                ].map((feature, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-3xl block mb-2">{feature.icon}</span>
                    <h4 className="font-semibold text-white">{feature.title}</h4>
                    <p className="text-xs text-slate-400">{feature.desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ANALYZING STEP */}
        {step === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-8"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="w-32 h-32 mx-auto mb-8 relative"
              >
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-indigo-400 border-b-purple-400 border-l-transparent animate-spin" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                  <span className="text-4xl">🔮</span>
                </div>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-4">Scanning the Market Universe</h2>
              <div className="flex justify-center gap-2 mb-4">
                {['Analyzing skills', 'Mapping positions', 'Finding bridges', 'Calculating density'].map((text, i) => (
                  <motion.span
                    key={text}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.5 }}
                    className="px-3 py-1 rounded-full bg-white/5 text-xs text-slate-400"
                  >{text}</motion.span>
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
                  className="glass-card p-4 rounded-2xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl max-w-xs"
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
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Talent Density</p>
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
                  className="glass-card p-4 rounded-2xl border border-purple-500/30 bg-slate-900/80 backdrop-blur-xl"
                >
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">🌉 Bridge Skills</p>
                  <div className="flex gap-2">
                    {analysis.bridgeSkills.map((skill, i) => (
                      <button
                        key={skill.skill}
                        onClick={() => toggleBridgeSkill(skill)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeBridgeSkill?.skill === skill.skill
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                          : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                      >
                        <span className="block">{skill.skill}</span>
                        <span className="text-xs text-green-400">+${(skill.salaryIncrease / 1000).toFixed(0)}K</span>
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Right HUD - Actions */}
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex gap-2"
                >
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
              <Canvas className="w-full h-full" camera={{ position: [0, 0, 15], fov: 60 }}>
                <Suspense fallback={null}>
                  <OracleScene
                    analysis={analysis}
                    selectedJob={selectedJob}
                    setSelectedJob={setSelectedJob}
                    showBridge={showBridge}
                    activeBridgeSkill={activeBridgeSkill}
                  />
                </Suspense>
              </Canvas>
            </div>

            {/* Bottom HUD */}
            <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
              <div className="flex items-end justify-between gap-4 pointer-events-auto">
                {/* Skills Panel */}
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl max-w-md"
                >
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Your Top Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.topSkills.map((skill) => (
                      <span key={skill} className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs border border-cyan-500/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mt-3 mb-2">Missing Skills</p>
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
                  className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl max-w-sm"
                >
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">📈 Market Trends</p>
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
                  className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl"
                >
                  <p className="text-xs text-slate-400">
                    🖱️ Drag to rotate • Scroll to zoom • Click stars for details
                  </p>
                  <p className="text-xs text-purple-400 mt-1">
                    ⭐ Bright stars = 80%+ match • Lines = constellation paths
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
                  <div className="glass-card p-6 rounded-2xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-xl w-96">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{selectedJob.title}</h3>
                        <p className="text-cyan-400">{selectedJob.company}</p>
                      </div>
                      <button
                        onClick={() => { setShowJobCard(false); setSelectedJob(null); }}
                        className="p-2 rounded-lg hover:bg-white/10"
                      >
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                        <span className="text-sm text-slate-400">Salary</span>
                        <span className="text-xl font-bold text-green-400">${selectedJob.salary.toLocaleString()}</span>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-400">Match Score</span>
                          <span className={`text-lg font-bold ${selectedJob.fitScore > 0.8 ? 'text-cyan-400' :
                            selectedJob.fitScore > 0.6 ? 'text-green-400' : 'text-yellow-400'
                            }`}>{Math.round(selectedJob.fitScore * 100)}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                            style={{ width: `${selectedJob.fitScore * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Required Skills</p>
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

                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <p className="text-xs text-purple-400 uppercase tracking-wider mb-1">💡 Why You'll Win</p>
                        <p className="text-sm text-slate-300">
                          {selectedJob.fitScore > 0.8
                            ? "Your skills are a near-perfect match. You're a top candidate for this role."
                            : selectedJob.fitScore > 0.6
                              ? "Strong alignment with 2-3 skill gaps that are learnable in 3-6 months."
                              : "Consider upskilling in the missing areas to become competitive."}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bridge Skill Impact Panel */}
            <AnimatePresence>
              {activeBridgeSkill && (
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                >
                  <div className="glass-card p-6 rounded-2xl border border-purple-500/30 bg-slate-900/95 backdrop-blur-xl w-80">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-2xl">🌉</span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase">Bridge Skill</p>
                        <h4 className="text-lg font-bold text-white">{activeBridgeSkill.skill}</h4>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10">
                        <span className="text-sm text-slate-400">Salary Increase</span>
                        <span className="text-lg font-bold text-green-400">+${activeBridgeSkill.salaryIncrease.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10">
                        <span className="text-sm text-slate-400">New Fit Score</span>
                        <span className="text-lg font-bold text-cyan-400">{Math.round(activeBridgeSkill.newFitScore * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10">
                        <span className="text-sm text-slate-400">Impact Rating</span>
                        <span className="text-lg font-bold text-purple-400">{activeBridgeSkill.impact}/10</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mt-4 text-center">
                      🟣 Purple marker shows your projected position
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
