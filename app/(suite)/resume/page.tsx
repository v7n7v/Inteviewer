'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { talentConsultingAI } from '@/lib/ai/talentconsulting-ai';
import { morphResumeForJD, generateSkillInsights, optimizeSummary, getResumeSuggestions, type Resume, type MorphedResume } from '@/lib/ai/resume-morpher';
import { saveResumeVersion, getResumeVersions, type ResumeVersion, createJobApplication } from '@/lib/database-suite';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import CompanyInfoModal from '@/components/modals/CompanyInfoModal';

interface GapAnalysis {
  skill: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  suggestion: string;
}

interface MorphSuggestion {
  original: string;
  suggested: string;
  reason: string;
}

interface AIAnalysis {
  gapAnalysis: GapAnalysis[];
  morphSuggestions: MorphSuggestion[];
  talentDensityScore: number;
}

export default function LiquidResumePage() {
  const { user } = useStore();
  const [mode, setMode] = useState<'technical' | 'leadership'>('technical');
  const [resume, setResume] = useState<Resume>({
    personal: { name: '', title: '', email: '', phone: '', location: '', summary: '' },
    experience: [],
    education: [],
    skills: [],
  });

  const [jobDescription, setJobDescription] = useState('');
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [morphedResume, setMorphedResume] = useState<MorphedResume | null>(null);
  const [skillInsights, setSkillInsights] = useState<{ skill: string; category: string; level: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'analysis' | 'versions'>('edit');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Company modal state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{ companyName: string; jobTitle?: string; applicationLink?: string } | null>(null);

  useEffect(() => { if (user) loadVersions(); }, [user]);

  const loadVersions = async () => {
    const result = await getResumeVersions();
    if (result.success && result.data) {
      setVersions(result.data);
      if (result.data.length > 0 && !resume.personal.name) setResume(result.data[0].content);
    }
  };

  const handleMorphResume = async () => {
    if (!jobDescription.trim()) return showToast('Enter a job description', '❌');
    if (!resume.personal.name) return showToast('Add your name first', '❌');

    // Show company modal first
    setShowCompanyModal(true);
  };

  const handleCompanyInfoSubmit = async (info: { companyName: string; jobTitle?: string; applicationLink?: string }) => {
    setShowCompanyModal(false);
    setCompanyInfo(info);
    setIsMorphing(true);
    setActiveTab('analysis');

    try {
      // Use talentConsultingAI for comprehensive analysis
      const result = await talentConsultingAI.analyzeResume(JSON.stringify(resume), jobDescription);
      const analysis = JSON.parse(result.choices[0].message.content) as AIAnalysis;
      setAiAnalysis(analysis);

      // Also run the morpher for additional insights
      const morphed = await morphResumeForJD(resume, jobDescription);
      setMorphedResume(morphed);

      // Generate skill insights
      if (resume.skills.length > 0) {
        const insights = await generateSkillInsights(resume.skills);
        setSkillInsights(insights);
      }

      // Auto-generate resume name with company info
      const resumeName = generateResumeName(info.companyName, info.jobTitle);

      // Auto-save version with company-specific name
      const versionResult = await saveResumeVersion(resumeName, resume, { insights: skillInsights, analysis }, mode);

      // Create application tracker entry
      if (versionResult.success && versionResult.data) {
        await createJobApplication({
          companyName: info.companyName,
          jobTitle: info.jobTitle,
          jobDescription,
          resumeVersionId: versionResult.data.id,
          morphedResumeName: resumeName,
          talentDensityScore: analysis.talentDensityScore,
          gapAnalysis: analysis.gapAnalysis,
          applicationLink: info.applicationLink,
        });
      }

      showToast(`Resume analyzed! Talent Density: ${analysis.talentDensityScore}%`, '✅');
      showToast(`Saved as: ${resumeName}`, '💾');
      loadVersions(); // Refresh versions list
    } catch (error) {
      console.error('Morphing error:', error);
      showToast('Analysis failed. Please try again.', '❌');
    } finally {
      setIsMorphing(false);
    }
  };

  const generateResumeName = (companyName: string, jobTitle?: string) => {
    const cleanCompany = companyName.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTitle = jobTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'Position';
    const year = new Date().getFullYear();
    return `Resume_${cleanCompany}_${cleanTitle}_${year}`;
  };

  const handleOptimizeSummary = async () => {
    if (!jobDescription.trim()) return showToast('Enter a job description', '❌');
    setIsLoading(true);
    try {
      const optimized = await optimizeSummary(resume.personal.summary || 'Professional seeking new opportunities', jobDescription);
      setResume({ ...resume, personal: { ...resume.personal, summary: optimized } });
      showToast('Summary optimized!', '✅');
    } catch { showToast('Optimization failed', '❌'); }
    finally { setIsLoading(false); }
  };

  const handleGetSuggestions = async (section: 'experience' | 'skills' | 'summary') => {
    setIsLoading(true);
    try {
      const results = await getResumeSuggestions(resume, section);
      setSuggestions(results);
      showToast('Suggestions ready!', '💡');
    } catch { showToast('Failed to get suggestions', '❌'); }
    finally { setIsLoading(false); }
  };

  const handleSaveVersion = async () => {
    const name = prompt('Enter version name:');
    if (!name) return;
    setIsLoading(true);
    try {
      const result = await saveResumeVersion(name, resume, { insights: skillInsights, analysis: aiAnalysis }, mode);
      if (result.success) { showToast('Version saved!', '✅'); loadVersions(); }
      else showToast(result.error || 'Save failed', '❌');
    } catch { showToast('Save failed', '❌'); }
    finally { setIsLoading(false); }
  };

  const updateField = (path: string[], value: any) => {
    const newResume = JSON.parse(JSON.stringify(resume));
    let current: any = newResume;
    for (let i = 0; i < path.length - 1; i++) current = current[path[i]];
    current[path[path.length - 1]] = value;
    setResume(newResume);
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center max-w-md"
      >
        <span className="text-6xl mb-4 block">🔒</span>
        <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-slate-400">Please sign in to access the Liquid Resume Builder</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-800/50 to-cyan-900/20 border border-white/10 p-8 mb-8"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-4"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-medium text-white/80">Talent Suite • Resume Intelligence</span>
            </motion.div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-3">
              <span className="text-gradient">Liquid Resume</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl">AI-powered resume architect that morphs to match any job description</p>
          </div>

          {/* Talent Density Score */}
          {aiAnalysis && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-4"
            >
              <div className="relative">
                <svg className="w-28 h-28 -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" />
                  <circle cx="56" cy="56" r="48"
                    stroke={aiAnalysis.talentDensityScore >= 80 ? '#00ff88' : aiAnalysis.talentDensityScore >= 60 ? '#00f5ff' : '#ff0055'}
                    strokeWidth="10" fill="none" strokeLinecap="round"
                    strokeDasharray={`${aiAnalysis.talentDensityScore * 3.02} 302`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold text-white">{aiAnalysis.talentDensityScore}</span>
                  <span className="text-xs text-slate-400">Density</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Mode Toggle & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
          {(['technical', 'leadership'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              {m === 'technical' ? '🔧 Technical' : '👥 Leadership'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveVersion} disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all disabled:opacity-50"
          >💾 Save Version</button>
          <span className="text-sm text-slate-500">{versions.length} saved</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {[
            { id: 'edit', label: '✏️ Edit Resume', icon: '✏️' },
            { id: 'analysis', label: '🧠 AI Analysis', icon: '🧠' },
            { id: 'versions', label: '📁 Versions', icon: '📁' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* Edit Tab */}
            {activeTab === 'edit' && (
              <motion.div key="edit" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {/* Resume Editor */}
                <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white">Resume Editor</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Personal Info */}
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <input type="text" value={resume.personal.name} onChange={(e) => updateField(['personal', 'name'], e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white text-lg font-bold focus:border-cyan-500/50 focus:outline-none"
                          placeholder="Your Name"
                        />
                        <input type="text" value={resume.personal.title} onChange={(e) => updateField(['personal', 'title'], e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-cyan-400 focus:border-cyan-500/50 focus:outline-none"
                          placeholder="Job Title"
                        />
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <input type="email" value={resume.personal.email} onChange={(e) => updateField(['personal', 'email'], e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-slate-300 text-sm focus:border-cyan-500/50 focus:outline-none"
                          placeholder="email@example.com"
                        />
                        <input type="tel" value={resume.personal.phone} onChange={(e) => updateField(['personal', 'phone'], e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-slate-300 text-sm focus:border-cyan-500/50 focus:outline-none"
                          placeholder="+1 (555) 000-0000"
                        />
                        <input type="text" value={resume.personal.location} onChange={(e) => updateField(['personal', 'location'], e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-slate-300 text-sm focus:border-cyan-500/50 focus:outline-none"
                          placeholder="City, State"
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-400">
                          {mode === 'technical' ? '🔧 Technical Summary' : '🎯 Leadership Profile'}
                        </label>
                        <button onClick={handleOptimizeSummary} disabled={isLoading || !jobDescription}
                          className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                        >✨ AI Optimize</button>
                      </div>
                      <textarea rows={4} value={resume.personal.summary} onChange={(e) => updateField(['personal', 'summary'], e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-slate-300 focus:border-cyan-500/50 focus:outline-none resize-none"
                        placeholder="Professional summary highlighting your key strengths..."
                      />
                    </div>

                    {/* Skills */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-slate-400">💡 Skills</label>
                        <button onClick={() => handleGetSuggestions('skills')} disabled={isLoading}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors disabled:opacity-50"
                        >Get Suggestions</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {resume.skills.map((skill, i) => (
                          <motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${morphedResume?.highlightedSkills?.includes(skill)
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                              : 'bg-white/5 text-slate-300 border border-white/10'
                              }`}
                          >
                            {skill}
                            <button onClick={() => updateField(['skills'], resume.skills.filter((_, idx) => idx !== i))}
                              className="text-xs opacity-50 hover:opacity-100"
                            >✕</button>
                          </motion.span>
                        ))}
                        <button onClick={() => { const s = prompt('Enter skill:'); if (s) updateField(['skills'], [...resume.skills, s]); }}
                          className="px-4 py-2 rounded-xl text-sm border-2 border-dashed border-white/20 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                        >+ Add Skill</button>
                      </div>
                    </div>

                    {/* Experience */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-slate-400">
                          {mode === 'technical' ? '⚙️ Technical Experience' : '👥 Leadership Experience'}
                        </label>
                      </div>
                      <div className="space-y-4">
                        {resume.experience.map((exp, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <input type="text" value={exp.title}
                              onChange={(e) => { const newExp = [...resume.experience]; newExp[i].title = e.target.value; updateField(['experience'], newExp); }}
                              className="w-full bg-transparent text-white font-semibold mb-3 focus:outline-none"
                              placeholder="Job Title / Company"
                            />
                            <ul className="space-y-2 ml-4">
                              {exp.items.map((item, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <span className="text-cyan-400 mt-1">•</span>
                                  <input type="text" value={item}
                                    onChange={(e) => { const newExp = [...resume.experience]; newExp[i].items[j] = e.target.value; updateField(['experience'], newExp); }}
                                    className="flex-1 bg-transparent text-slate-300 text-sm focus:outline-none"
                                    placeholder="Achievement or responsibility..."
                                  />
                                </li>
                              ))}
                            </ul>
                            <button onClick={() => { const newExp = [...resume.experience]; newExp[i].items.push(''); updateField(['experience'], newExp); }}
                              className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                            >+ Add bullet</button>
                          </div>
                        ))}
                        <button onClick={() => updateField(['experience'], [...resume.experience, { title: '', items: [''] }])}
                          className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                        >+ Add Experience</button>
                      </div>
                    </div>

                    {/* Education */}
                    <div>
                      <label className="text-sm font-semibold text-slate-400 block mb-3">🎓 Education</label>
                      <div className="space-y-3">
                        {resume.education.map((edu, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <input type="text" value={edu.title}
                              onChange={(e) => { const newEdu = [...resume.education]; newEdu[i].title = e.target.value; updateField(['education'], newEdu); }}
                              className="w-full bg-transparent text-white font-semibold focus:outline-none"
                              placeholder="Degree / Certification"
                            />
                          </div>
                        ))}
                        <button onClick={() => updateField(['education'], [...resume.education, { title: '', items: [] }])}
                          className="w-full p-3 rounded-xl border-2 border-dashed border-white/20 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors text-sm"
                        >+ Add Education</button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Analysis Tab */}
            {activeTab === 'analysis' && (
              <motion.div key="analysis" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                {!aiAnalysis ? (
                  <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-cyan-900/10 border border-cyan-500/20 p-12 text-center">
                    <span className="text-6xl mb-4 block">🧠</span>
                    <h3 className="text-xl font-bold text-white mb-2">Run AI Analysis</h3>
                    <p className="text-slate-400 mb-6">Enter a job description and click "Optimize for Talent Density" to get AI-powered insights</p>
                  </div>
                ) : (
                  <>
                    {/* Gap Analysis */}
                    <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-orange-900/10 border border-orange-500/20 overflow-hidden">
                      <div className="p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <span className="text-2xl">⚠️</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">Skill Gap Analysis</h3>
                            <p className="text-sm text-slate-400">{aiAnalysis.gapAnalysis?.length || 0} gaps identified</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 space-y-3">
                        {aiAnalysis.gapAnalysis?.map((gap, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                            className={`p-4 rounded-xl border ${gap.importance === 'critical' ? 'bg-red-500/10 border-red-500/30'
                              : gap.importance === 'important' ? 'bg-yellow-500/10 border-yellow-500/30'
                                : 'bg-green-500/10 border-green-500/30'
                              }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-lg">
                                {gap.importance === 'critical' ? '🔴' : gap.importance === 'important' ? '🟡' : '🟢'}
                              </span>
                              <div>
                                <p className="font-semibold text-white mb-1">{gap.skill}</p>
                                <p className="text-sm text-slate-400">{gap.suggestion}</p>
                              </div>
                            </div>
                          </motion.div>
                        )) || <p className="text-slate-500 text-center">No gaps found</p>}
                      </div>
                    </div>

                    {/* Morph Suggestions */}
                    {aiAnalysis.morphSuggestions && aiAnalysis.morphSuggestions.length > 0 && (
                      <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-cyan-900/10 border border-cyan-500/20 overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                              <span className="text-2xl">✨</span>
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-white">Morph Suggestions</h3>
                              <p className="text-sm text-slate-400">AI-recommended rewrites</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          {aiAnalysis.morphSuggestions.map((suggestion, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                              className="p-4 rounded-xl bg-white/5 border border-white/10"
                            >
                              <div className="mb-3">
                                <span className="text-xs font-semibold text-red-400">BEFORE:</span>
                                <p className="text-sm text-slate-400 line-through">{suggestion.original}</p>
                              </div>
                              <div className="mb-3">
                                <span className="text-xs font-semibold text-green-400">AFTER:</span>
                                <p className="text-sm text-white">{suggestion.suggested}</p>
                              </div>
                              <p className="text-xs text-slate-500">💡 {suggestion.reason}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Versions Tab */}
            {activeTab === 'versions' && (
              <motion.div key="versions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white">Saved Versions</h3>
                  </div>
                  <div className="p-6">
                    {versions.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-6xl mb-4 block">📁</span>
                        <p className="text-slate-400">No saved versions yet</p>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {versions.map((v) => (
                          <motion.button key={v.id} onClick={() => { setResume(v.content); setMode(v.mode); setActiveTab('edit'); showToast(`Loaded: ${v.version_name}`, '✅'); }}
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all text-left group"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">{v.version_name}</h4>
                              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-400">
                                {v.mode === 'technical' ? '🔧' : '👥'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{new Date(v.created_at).toLocaleDateString()}</p>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* JD Input */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-blue-900/10 border border-blue-500/20 overflow-hidden"
          >
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xl">💼</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Target Job</h3>
                  <p className="text-xs text-slate-400">Paste JD for AI matching</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <textarea rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-slate-300 text-sm focus:border-blue-500/50 focus:outline-none resize-none mb-4"
                placeholder="Paste job description here..."
              />
              <button onClick={handleMorphResume} disabled={isMorphing}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
              >
                {isMorphing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Analyzing...
                  </span>
                ) : '🧠 Optimize for Talent Density'}
              </button>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 p-5"
          >
            <h3 className="font-bold text-white mb-4">Resume Stats</h3>
            <div className="space-y-3">
              {[
                { label: 'Skills', value: resume.skills.length, icon: '💡' },
                { label: 'Experience', value: resume.experience.length, icon: '⚙️' },
                { label: 'Education', value: resume.education.length, icon: '🎓' },
                { label: 'Versions', value: versions.length, icon: '📁' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-slate-400 flex items-center gap-2">
                    <span>{stat.icon}</span> {stat.label}
                  </span>
                  <span className="text-xl font-bold text-white">{stat.value}</span>
                </div>
              ))}
              {morphedResume && (
                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">JD Match</span>
                    <span className={`text-2xl font-bold ${morphedResume.matchScore >= 80 ? 'text-green-400'
                      : morphedResume.matchScore >= 60 ? 'text-cyan-400'
                        : 'text-red-400'
                      }`}>{morphedResume.matchScore}%</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Skill Insights */}
          {skillInsights.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-green-900/10 border border-green-500/20 p-5"
            >
              <h3 className="font-bold text-white mb-4">Skill Analysis</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {skillInsights.map((skill, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <div>
                      <span className="text-sm text-white">{skill.skill}</span>
                      <span className="text-xs text-slate-500 ml-2">{skill.category}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(10)].map((_, j) => (
                        <div key={j} className={`w-1.5 h-4 rounded-full ${j < skill.level ? 'bg-green-400' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-cyan-900/10 border border-cyan-500/20 p-5"
            >
              <h3 className="font-bold text-white mb-4">💡 AI Suggestions</h3>
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>

      {/* Company Info Modal */}
      <CompanyInfoModal
        isOpen={showCompanyModal}
        onSubmit={handleCompanyInfoSubmit}
        onCancel={() => setShowCompanyModal(false)}
        jobDescription={jobDescription}
      />
    </div>
  );
}
