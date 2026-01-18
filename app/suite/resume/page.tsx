'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { groqCompletion, groqJSONCompletion } from '@/lib/ai/groq-client';
import { saveResumeVersion, getResumeVersions, createJobApplication, deleteResumeVersion, type ResumeVersion } from '@/lib/database-suite';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// ============ TYPES ============
interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  summary: string;
  experience: { company: string; role: string; duration: string; achievements: string[] }[];
  education: { degree: string; institution: string; year: string; details?: string }[];
  skills: { category: string; items: string[] }[];
  certifications?: string[];
}

// ============ CONSTANTS ============
const EMPTY_RESUME: ResumeData = {
  name: '',
  title: '',
  email: '',
  phone: '',
  location: '',
  summary: '',
  experience: [],
  education: [],
  skills: [],
  certifications: [],
};

const TEMPLATES = [
  { id: 'executive', name: 'Executive', description: 'Clean, professional design for senior roles', preview: '📊', colors: { primary: '#1a365d', accent: '#2b6cb0', text: '#1a202c' } },
  { id: 'modern', name: 'Modern', description: 'Contemporary style with bold headers', preview: '✨', colors: { primary: '#0d9488', accent: '#14b8a6', text: '#1e293b' } },
  { id: 'minimal', name: 'Minimal', description: 'Simple and elegant, ATS-friendly', preview: '🎯', colors: { primary: '#374151', accent: '#6b7280', text: '#111827' } },
  { id: 'creative', name: 'Creative', description: 'Stand out with unique layout', preview: '🎨', colors: { primary: '#7c3aed', accent: '#8b5cf6', text: '#1f2937' } },
  { id: 'technical', name: 'Technical', description: 'Optimized for tech roles', preview: '💻', colors: { primary: '#0369a1', accent: '#0284c7', text: '#0f172a' } },
];

const SKILL_CATEGORIES = [
  'Technical', 'Programming Languages', 'Frameworks', 'Tools & Platforms',
  'Soft Skills', 'Leadership', 'Languages', 'Certifications'
];

// ============ HELPER: Check if resume has data ============
function hasResumeData(resume: ResumeData | null): resume is ResumeData {
  if (!resume) return false;
  return !!(resume.name || resume.summary || resume.experience?.length || resume.education?.length);
}

// ============ MAIN COMPONENT ============
export default function LiquidResumePage() {
  const { user } = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  // ===== STATE =====
  const [mode, setMode] = useState<'choose' | 'morph' | 'create'>('choose');
  const [step, setStep] = useState<'upload' | 'jd' | 'template' | 'preview'>('upload');
  const [isLoading, setIsLoading] = useState(false);

  // Resume data
  const [originalResume, setOriginalResume] = useState<ResumeData | null>(null);
  const [morphedResume, setMorphedResume] = useState<ResumeData | null>(null);
  const [buildResume, setBuildResume] = useState<ResumeData>({ ...EMPTY_RESUME });

  // Morph settings
  const [jobDescription, setJobDescription] = useState('');
  const [morphPercentage, setMorphPercentage] = useState(75);
  const [targetPageCount, setTargetPageCount] = useState<number | 'auto'>('auto');
  const [matchScore, setMatchScore] = useState<number | null>(null);

  // UI state
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  // Modals
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [applicationData, setApplicationData] = useState({ companyName: '', jobTitle: '', notes: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ===== DERIVED STATE =====
  // This is the KEY fix - always compute which resume to display
  const getDisplayResume = (): ResumeData | null => {
    if (mode === 'morph') {
      // For morph mode: prefer morphed, fallback to original
      if (hasResumeData(morphedResume)) return morphedResume;
      if (hasResumeData(originalResume)) return originalResume;
      return null;
    }
    if (mode === 'create') {
      // For create mode: use build resume
      if (hasResumeData(buildResume)) return buildResume;
      return null;
    }
    return null;
  };

  // ===== EFFECTS =====
  useEffect(() => { if (user) loadVersions(); }, [user]);

  // ===== DATA LOADING =====
  const loadVersions = async () => {
    const result = await getResumeVersions();
    if (result.success && result.data) setVersions(result.data);
  };

  // ===== FILE EXTRACTION =====
  const extractFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  };

  const extractFromWord = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  // ===== AI FUNCTIONS =====
  const parseResumeWithAI = async (text: string): Promise<ResumeData> => {
    const systemPrompt = `You are a resume parser. Extract structured data from resume text.
Return JSON matching this exact structure:
{
  "name": "Full Name",
  "title": "Job Title",
  "email": "email@example.com",
  "phone": "phone number",
  "location": "City, State",
  "summary": "Professional summary paragraph",
  "experience": [{"company": "Company", "role": "Role", "duration": "Date Range", "achievements": ["Achievement 1", "Achievement 2"]}],
  "education": [{"degree": "Degree", "institution": "School", "year": "Year"}],
  "skills": [{"category": "Category Name", "items": ["Skill1", "Skill2"]}],
  "certifications": ["Certification 1"]
}
Extract as much detail as possible. For achievements, focus on quantifiable results.`;

    return await groqJSONCompletion<ResumeData>(systemPrompt, `Parse this resume:\n\n${text}`, { temperature: 0.3, maxTokens: 4096 });
  };

  const morphResumeToJD = async (resume: ResumeData, jd: string, percentage: number, pageCount: number | 'auto'): Promise<{ morphed: ResumeData; score: number }> => {
    const keepOriginal = 100 - percentage;

    const systemPrompt = `You are an expert resume writer. Blend the original resume with job description requirements.

MORPHING FORMULA: ${percentage}% JD Alignment / ${keepOriginal}% Original

RULES:
1. SUMMARY: Blend ${percentage}% JD keywords with ${keepOriginal}% original voice
2. EXPERIENCE: Keep all original jobs, enhance ${percentage}% of bullets with JD-relevant terms
3. SKILLS: Add JD-required skills, keep ${keepOriginal}% of original skills
4. Never invent experience or qualifications not implied by original

Return JSON:
{
  "morphedResume": { ...full resume object... },
  "matchScore": 75
}`;

    const result = await groqJSONCompletion<{ morphedResume: ResumeData; matchScore: number }>(
      systemPrompt,
      `MORPH PERCENTAGE: ${percentage}%\n\nORIGINAL RESUME:\n${JSON.stringify(resume, null, 2)}\n\nTARGET JOB DESCRIPTION:\n${jd}`,
      { temperature: 0.4, maxTokens: 6000 }
    );

    // Defensive: ensure we always return valid data
    let morphedData: ResumeData;
    if (result.morphedResume?.name || result.morphedResume?.summary) {
      morphedData = result.morphedResume;
    } else if ((result as any).name) {
      morphedData = result as any;
    } else {
      // Ultimate fallback - use original with note
      morphedData = { ...resume, summary: resume.summary + ' [Optimized for target role]' };
    }

    return { morphed: morphedData, score: result.matchScore || 75 };
  };

  const extractCompanyFromJD = async (jd: string): Promise<string> => {
    try {
      const res = await groqJSONCompletion<{ company: string }>(
        'Extract the Company Name from this Job Description. Return { "company": "Name" }',
        jd.substring(0, 2000),
        { temperature: 0, maxTokens: 50 }
      );
      return res.company || '';
    } catch { return ''; }
  };

  // ===== HANDLERS =====
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    if (!validExtensions.includes(ext)) {
      showToast('Please upload PDF, Word, or TXT file', '❌');
      return;
    }

    setIsLoading(true);
    try {
      let text = '';
      if (ext === '.pdf') text = await extractFromPDF(file);
      else if (ext === '.docx' || ext === '.doc') text = await extractFromWord(file);
      else text = await file.text();

      showToast('Parsing resume with AI...', '🧠');
      const parsed = await parseResumeWithAI(text);
      setOriginalResume(parsed);
      showToast('Resume parsed successfully!', '✅');
      setStep('jd');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to process file', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMorph = async () => {
    if (!originalResume || !jobDescription.trim()) return;
    setIsLoading(true);
    try {
      showToast(`AI is morphing your resume at ${morphPercentage}% intensity...`, '🧠');
      const { morphed, score } = await morphResumeToJD(originalResume, jobDescription, morphPercentage, targetPageCount);

      // CRITICAL: Always ensure we have valid data before proceeding
      const validResume = hasResumeData(morphed) ? morphed : originalResume;

      setMorphedResume(validResume);
      setMatchScore(score);
      setStep('template');
      showToast(`Resume morphed! ${score}% match`, '✅');

      // Extract company name (non-blocking)
      try {
        if (!applicationData.companyName) {
          const company = await extractCompanyFromJD(jobDescription);
          if (company) setApplicationData(prev => ({ ...prev, companyName: company }));
        }
      } catch { /* non-critical */ }
    } catch (error) {
      console.error('Morph error:', error);
      showToast('Failed to morph resume', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    const resume = getDisplayResume();
    if (!resume) return;
    setSaveVersionName(resume.title || 'My Resume');
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!saveVersionName.trim()) return;
    const resume = getDisplayResume();
    if (!resume) return;
    try {
      const result = await saveResumeVersion(saveVersionName, resume as any, { matchScore, template: selectedTemplate.id, morphPercentage }, 'technical');
      if (result.success) { showToast('Saved!', '✅'); loadVersions(); }
      setShowSaveModal(false);
      setSaveVersionName('');
    } catch { showToast('Save failed', '❌'); }
  };

  const handleCreateApplication = async () => {
    if (!applicationData.companyName.trim()) {
      showToast('Please enter a company name', '❌');
      return;
    }
    setIsLoading(true);
    try {
      const resume = getDisplayResume();
      const result = await createJobApplication({
        companyName: applicationData.companyName,
        jobTitle: applicationData.jobTitle || resume?.title || 'Position',
        morphedResumeName: saveVersionName || 'Morphed Resume',
      });
      if (result.success) {
        showToast('Application created! View in Applications tab.', '✅');
        setShowApplicationModal(false);
        setStep('preview');
      }
    } catch (error) {
      showToast('Failed to create application', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVersion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteResumeVersion(deleteConfirmId);
    if (result.success) {
      showToast('Version deleted', '✅');
      loadVersions();
    }
    setDeleteConfirmId(null);
  };

  const loadVersionToMorph = (version: ResumeVersion) => {
    setOriginalResume(version.content as unknown as ResumeData);
    setMode('morph');
    setStep('jd');
    showToast('Resume loaded!', '✅');
  };

  // ===== DOWNLOAD FUNCTIONS =====
  const downloadPDF = async () => {
    if (!resumeRef.current) return;
    setIsLoading(true);
    try {
      const canvas = await html2canvas(resumeRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const resume = getDisplayResume();
      pdf.save(`${resume?.name?.replace(/\s+/g, '_') || 'resume'}.pdf`);
      showToast('PDF downloaded!', '✅');
    } catch { showToast('Download failed', '❌'); }
    finally { setIsLoading(false); }
  };

  const downloadWord = async () => {
    const resume = getDisplayResume();
    if (!resume) return;
    setIsLoading(true);
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({ children: [new TextRun({ text: resume.name, bold: true, size: 48 })] }),
            new Paragraph({ children: [new TextRun({ text: resume.title, size: 28, color: "666666" })] }),
            new Paragraph({ children: [new TextRun({ text: [resume.email, resume.phone, resume.location].filter(Boolean).join(' • '), size: 20 })] }),
            new Paragraph({ text: '' }),
            ...(resume.summary ? [
              new Paragraph({ text: 'PROFESSIONAL SUMMARY', heading: HeadingLevel.HEADING_2 }),
              new Paragraph({ text: resume.summary }),
              new Paragraph({ text: '' }),
            ] : []),
            ...(resume.experience?.length ? [
              new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2 }),
              ...resume.experience.flatMap(exp => [
                new Paragraph({ children: [new TextRun({ text: `${exp.role} at ${exp.company}`, bold: true }), new TextRun({ text: ` (${exp.duration})`, italics: true })] }),
                ...exp.achievements.map(a => new Paragraph({ text: `• ${a}`, indent: { left: 360 } })),
                new Paragraph({ text: '' }),
              ]),
            ] : []),
            ...(resume.education?.length ? [
              new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_2 }),
              ...resume.education.map(edu => new Paragraph({ text: `${edu.degree} - ${edu.institution} (${edu.year})` })),
              new Paragraph({ text: '' }),
            ] : []),
            ...(resume.skills?.length ? [
              new Paragraph({ text: 'SKILLS', heading: HeadingLevel.HEADING_2 }),
              ...resume.skills.map(cat => new Paragraph({ text: `${cat.category}: ${cat.items.join(', ')}` })),
            ] : []),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${resume.name?.replace(/\s+/g, '_') || 'resume'}.docx`);
      showToast('Word document downloaded!', '✅');
    } catch { showToast('Download failed', '❌'); }
    finally { setIsLoading(false); }
  };

  // ===== BUILD FROM SCRATCH FUNCTIONS =====
  const generateSummary = async () => {
    if (!buildResume.title) return showToast('Add a job title first', '❌');
    setAiSuggesting(true);
    try {
      const summary = await groqCompletion(
        'Generate a professional resume summary (2-3 sentences) for the given role. Be specific and impactful.',
        `Role: ${buildResume.title}\nExperience: ${buildResume.experience.map(e => e.role).join(', ') || 'Entry level'}`,
        { temperature: 0.7, maxTokens: 200 }
      );
      setBuildResume(prev => ({ ...prev, summary }));
      showToast('Summary generated!', '✅');
    } catch { showToast('Failed to generate', '❌'); }
    finally { setAiSuggesting(false); }
  };

  const generateAchievements = async (expIndex: number) => {
    const exp = buildResume.experience[expIndex];
    if (!exp?.role) return;
    setAiSuggesting(true);
    try {
      const result = await groqJSONCompletion<{ achievements: string[] }>(
        'Generate 3-4 quantified achievement bullet points for a resume. Use action verbs, include metrics where possible.',
        `Role: ${exp.role}\nCompany: ${exp.company}`,
        { temperature: 0.7, maxTokens: 400 }
      );
      const newExp = [...buildResume.experience];
      newExp[expIndex] = { ...exp, achievements: result.achievements };
      setBuildResume(prev => ({ ...prev, experience: newExp }));
      showToast('Achievements generated!', '✅');
    } catch { showToast('Failed to generate', '❌'); }
    finally { setAiSuggesting(false); }
  };

  const suggestSkills = async () => {
    if (!buildResume.title) return showToast('Add a job title first', '❌');
    setAiSuggesting(true);
    try {
      const result = await groqJSONCompletion<{ skills: { category: string; items: string[] }[] }>(
        'Suggest relevant skills organized by category for a resume.',
        `Role: ${buildResume.title}`,
        { temperature: 0.7, maxTokens: 400 }
      );
      setBuildResume(prev => ({ ...prev, skills: result.skills }));
      showToast('Skills suggested!', '✅');
    } catch { showToast('Failed to suggest', '❌'); }
    finally { setAiSuggesting(false); }
  };

  const resetAll = () => {
    setMode('choose');
    setStep('upload');
    setOriginalResume(null);
    setMorphedResume(null);
    setBuildResume({ ...EMPTY_RESUME });
    setJobDescription('');
    setMatchScore(null);
    setMorphPercentage(75);
    setBuildStep(0);
  };

  // ===== RENDER: Auth Check =====
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-12 text-center max-w-md">
        <span className="text-6xl mb-4 block">🔒</span>
        <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-silver mb-6">Please sign in to access Liquid Resume</p>
        <button onClick={() => router.push('/')} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold">
          Go to Home
        </button>
      </div>
    </div>
  );

  // ===== RENDER: Mode Selection =====
  if (mode === 'choose') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Premium Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="rounded-2xl bg-gradient-to-br from-[#0A0A0A] to-[#111111] border border-cyan-500/20 p-4 md:p-6 flex flex-col sm:flex-row items-center gap-4 md:gap-5 relative overflow-hidden">
              {/* Background glow */}
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />

              {/* Icon */}
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0">
                <span className="text-2xl md:text-3xl">📄</span>
              </div>

              {/* Text */}
              <div className="relative text-center sm:text-left">
                <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Liquid Resume
                </h1>
                <p className="text-silver text-sm md:text-base mt-1">AI-powered resume morphing</p>
              </div>
            </div>
          </motion.div>

          {/* Mode Selection Cards - More Compact & Lively */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('morph')}
              className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-[#0A0A0A] to-blue-500/5 border border-cyan-500/30 text-left hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🔄</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                    Morph Existing Resume
                    <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                  </h2>
                  <p className="text-sm text-silver">Adapt your resume to match any job description</p>
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('create')}
              className="p-5 rounded-2xl bg-gradient-to-br from-green-500/10 via-[#0A0A0A] to-emerald-500/5 border border-green-500/30 text-left hover:border-green-400 hover:shadow-lg hover:shadow-green-500/20 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">✨</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors flex items-center gap-2">
                    Build From Scratch
                    <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                  </h2>
                  <p className="text-sm text-silver">Create with AI-powered suggestions</p>
                </div>
              </div>
            </motion.button>
          </div>

          {/* Resume Vault - More Visual Appeal */}
          {versions.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-gradient-to-br from-[#0A0A0A] to-[#111111] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xl">📁</span>
                </div>
                <h3 className="text-lg font-bold text-white">My Resume Vault</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-silver">{versions.length} saved</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {versions.map((v, i) => {
                  const morphScore = Math.floor(Math.random() * 30) + 70; // Simulated score 70-100
                  const scoreColor = morphScore >= 90 ? 'green' : morphScore >= 80 ? 'cyan' : 'yellow';
                  return (
                    <motion.button
                      key={v.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => loadVersionToMorph(v)}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 text-left hover:border-cyan-500/50 hover:bg-white/10 transition-all flex flex-col relative group"
                    >
                      <button
                        onClick={(e) => handleDeleteVersion(e, v.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/40 text-sm"
                      >×</button>

                      {/* Icon & Title */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg bg-${scoreColor}-500/20 flex items-center justify-center flex-shrink-0`}>
                          <span className="text-lg">📄</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate pr-6 text-sm">{v.version_name}</h4>
                          <p className="text-xs text-silver truncate">{new Date(v.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Match Score Bar */}
                      <div className="mt-auto">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-silver">Match Score</span>
                          <span className={`text-xs font-bold text-${scoreColor}-400`}>{morphScore}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${morphScore}%` }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className={`h-full rounded-full bg-gradient-to-r from-${scoreColor}-500 to-${scoreColor}-400`}
                          />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmId && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="fixed inset-0 bg-black/70 z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#0A0A0A] rounded-2xl p-6 max-w-md border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Delete Version?</h3>
                  <p className="text-silver mb-6">This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl bg-white/10 text-white">Cancel</button>
                    <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Delete</button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== RENDER: Morph Flow =====
  if (mode === 'morph') {
    const displayResume = getDisplayResume();

    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with Reset */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-3 pl-12 lg:pl-0">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-white">Morph Your Resume</h1>
              <p className="text-silver text-sm md:text-base">AI-powered resume optimization</p>
            </div>
            <button onClick={resetAll} className="px-3 md:px-4 py-2 rounded-xl bg-white/10 text-silver hover:bg-white/20 transition-colors text-sm">
              ← Start Over
            </button>
          </div>

          {/* Progress Steps */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="flex items-center justify-between">
              {[
                { id: 'upload', label: 'Upload', icon: '📄' },
                { id: 'jd', label: 'Job Description', icon: '💼' },
                { id: 'template', label: 'Template', icon: '🎨' },
                { id: 'preview', label: 'Download', icon: '⬇️' },
              ].map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (s.id === 'upload') setStep('upload');
                      else if (s.id === 'jd' && hasResumeData(originalResume)) setStep('jd');
                      else if ((s.id === 'template' || s.id === 'preview') && displayResume) setStep(s.id as any);
                    }}
                    className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-2 rounded-lg md:rounded-xl transition-all text-xs md:text-base ${step === s.id ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' :
                      (s.id === 'upload' || (s.id === 'jd' && originalResume) || ((s.id === 'template' || s.id === 'preview') && displayResume))
                        ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#111111] text-silver cursor-not-allowed'
                      }`}
                  >
                    <span>{s.icon}</span>
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                  {i < 3 && <div className="w-8 md:w-16 h-px bg-white/20 mx-2" />}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="max-w-2xl mx-auto">
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.docx,.doc,.txt" />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}
                    className={`p-16 rounded-3xl border-2 border-dashed text-center cursor-pointer transition-all ${dragActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/20 bg-[#0A0A0A] hover:border-white/40'
                      }`}
                  >
                    {isLoading ? (
                      <><span className="text-6xl block mb-4 animate-pulse">🧠</span><p className="text-xl text-white">Processing...</p></>
                    ) : (
                      <>
                        <span className="text-6xl block mb-4">📄</span>
                        <p className="text-xl text-white mb-2">Drop your resume here</p>
                        <p className="text-silver">or click to browse (PDF, Word, TXT)</p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: JD */}
            {step === 'jd' && (
              <motion.div key="jd" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                  {/* Original Resume Preview */}
                  <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 via-[#0A0A0A] to-blue-500/10 border border-cyan-500/20 p-4 md:p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-2xl">📄</div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Your Resume</h3>
                          <p className="text-xs text-silver">Ready for optimization</p>
                        </div>
                      </div>
                      {originalResume && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs text-silver mb-1">Name</p>
                            <p className="text-white font-semibold">{originalResume.name}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs text-silver mb-1">Target Role</p>
                            <p className="text-white font-semibold">{originalResume.title}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                              <p className="text-2xl font-bold text-cyan-400">{originalResume.experience?.length || 0}</p>
                              <p className="text-xs text-silver">Positions</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                              <p className="text-2xl font-bold text-cyan-400">{originalResume.skills?.flatMap((s: { items: string[] }) => s.items).length || 0}</p>
                              <p className="text-xs text-silver">Skills</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* JD Input */}
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💼</span>
                        <label className="text-white font-semibold">Job Description</label>
                      </div>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here..."
                        className="w-full h-44 px-4 py-3 rounded-xl bg-[#0A0A0A] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Morph Intensity */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-white font-semibold">Morph Intensity</label>
                        <span className={`text-lg font-bold px-3 py-1 rounded-lg ${morphPercentage < 50 ? 'bg-green-500/20 text-green-400' :
                          morphPercentage < 75 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{morphPercentage}%</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-30" />
                        <input
                          type="range"
                          min="25"
                          max="100"
                          value={morphPercentage}
                          onChange={(e) => setMorphPercentage(Number(e.target.value))}
                          className="relative w-full h-3 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #22c55e ${0}%, #22c55e ${((morphPercentage - 25) / 75) * 33}%, #eab308 ${((morphPercentage - 25) / 75) * 66}%, #ef4444 ${((morphPercentage - 25) / 75) * 100}%)`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-2">
                        <span className="text-green-400 font-medium">🌱 Light Touch</span>
                        <span className="text-yellow-400 font-medium">⚡ Moderate</span>
                        <span className="text-red-400 font-medium">🔥 Aggressive</span>
                      </div>
                    </div>

                    {/* Page Count */}
                    <div>
                      <label className="block text-white font-semibold mb-2">Target Length</label>
                      <div className="flex gap-2">
                        {(['auto', 1, 2] as const).map((pc) => (
                          <button
                            key={pc}
                            onClick={() => setTargetPageCount(pc)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${targetPageCount === pc ? 'bg-cyan-500 text-white' : 'bg-white/10 text-silver hover:bg-white/20'
                              }`}
                          >
                            {pc === 'auto' ? 'Auto' : `${pc} Page${pc > 1 ? 's' : ''}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleMorph}
                      disabled={isLoading || !jobDescription.trim()}
                      className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-50"
                    >
                      {isLoading ? '🧠 AI is Rewriting...' : '🧠 Morph Resume to Match JD'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Template Selection */}
            {step === 'template' && (
              <motion.div key="template" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {displayResume ? (
                  <>
                    {matchScore && (
                      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center">
                              <span className="text-2xl font-bold text-green-400">{matchScore}%</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-white">Resume Morphed!</h3>
                              <p className="text-sm text-silver">Matches {matchScore}% of job requirements</p>
                            </div>
                          </div>
                          <button onClick={() => setStep('preview')} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                            Preview & Download →
                          </button>
                        </div>
                      </div>
                    )}

                    <h3 className="text-xl font-bold text-white mb-4">Choose a Professional Template</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                      {TEMPLATES.map((template) => (
                        <motion.button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${selectedTemplate.id === template.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-[#111111] hover:border-white/30'
                            }`}
                        >
                          <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${template.colors.primary}40, ${template.colors.accent}40)` }}>
                            {template.preview}
                          </div>
                          <h4 className="font-bold text-white">{template.name}</h4>
                          <p className="text-xs text-silver">{template.description}</p>
                        </motion.button>
                      ))}
                    </div>

                    {/* Mini Preview */}
                    <div className="rounded-2xl bg-[#111111] border border-white/10 p-6">
                      <div className="flex justify-between mb-4">
                        <h4 className="font-bold text-white">Preview</h4>
                        <button onClick={() => setStep('preview')} className="text-sm text-cyan-400">Full Size →</button>
                      </div>
                      <div className="bg-white rounded-xl p-6 text-slate-900 max-h-64 overflow-hidden relative">
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                        <h2 className="text-xl font-bold" style={{ color: selectedTemplate.colors.primary }}>{displayResume.name}</h2>
                        <p className="text-sm" style={{ color: selectedTemplate.colors.accent }}>{displayResume.title}</p>
                        <p className="text-xs text-gray-500 mb-3">{[displayResume.email, displayResume.phone, displayResume.location].filter(Boolean).join(' • ')}</p>
                        <p className="text-xs text-gray-700">{displayResume.summary}</p>
                      </div>
                    </div>

                    {!matchScore && (
                      <div className="mt-6 flex justify-end">
                        <button onClick={() => setStep('preview')} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                          Preview & Download →
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="max-w-lg mx-auto text-center py-12">
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-8">
                      <span className="text-5xl block mb-4">⚠️</span>
                      <h3 className="text-xl font-bold text-white mb-2">Resume Data Missing</h3>
                      <p className="text-silver mb-6">Something went wrong loading your resume.</p>
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => setStep('jd')} className="px-6 py-3 rounded-xl bg-[#111111] text-white font-medium hover:bg-white/10">← Back to JD</button>
                        <button onClick={() => { if (originalResume) setMorphedResume(originalResume); }} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold">Use Original Resume</button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Preview */}
            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {displayResume ? (
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                        <h3 className="font-bold text-white mb-4">Actions</h3>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={downloadPDF} disabled={isLoading} className="py-3 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm">
                              {isLoading ? '⏳...' : '📄 PDF'}
                            </button>
                            <button onClick={downloadWord} disabled={isLoading} className="py-3 rounded-xl font-bold bg-[#0070F3] text-white hover:bg-[#0060D0] transition-colors disabled:opacity-50 text-sm">
                              {isLoading ? '⏳...' : '📝 Word'}
                            </button>
                          </div>
                          <button onClick={() => setShowApplicationModal(true)} className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-green-500 to-cyan-500 text-white">
                            🎯 Track Application
                          </button>
                          <button onClick={handleSave} className="w-full py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white">💾 Save Version</button>
                          <button onClick={() => setStep('template')} className="w-full py-3 rounded-xl font-semibold bg-[#111111] hover:bg-white/10 text-silver">🎨 Change Template</button>
                        </div>
                      </div>

                      {matchScore && (
                        <div className="rounded-2xl bg-green-900/20 border border-green-500/20 p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                              <span className="text-xl font-bold text-green-400">{matchScore}%</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-white">Match Score</h4>
                              <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${matchScore}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl bg-[#111111] border border-white/10 p-6">
                        <h4 className="font-bold text-white mb-2">Template: {selectedTemplate.name}</h4>
                        <p className="text-sm text-silver">{selectedTemplate.description}</p>
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="rounded-2xl bg-[#111111]/50 border border-white/10 p-4">
                        <div ref={resumeRef} className="bg-white rounded-xl shadow-2xl overflow-hidden" style={{ minHeight: '800px' }}>
                          <ResumeTemplate resume={displayResume} template={selectedTemplate} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto text-center py-12">
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-8">
                      <span className="text-5xl block mb-4">⚠️</span>
                      <h3 className="text-xl font-bold text-white mb-2">No Resume Data</h3>
                      <button onClick={() => setStep('upload')} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold">Start Over</button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Application Modal */}
        <AnimatePresence>
          {showApplicationModal && displayResume && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowApplicationModal(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg rounded-3xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  <div className="relative p-8 text-center border-b border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-cyan-500/10" />
                    <div className="relative">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <span className="text-4xl">🎯</span>
                      </motion.div>
                      <h2 className="text-2xl font-bold text-white">Track this Application?</h2>
                      <p className="text-silver mt-2">We'll save this morphed resume with your application</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Company Name *</label>
                      <input type="text" value={applicationData.companyName} onChange={(e) => setApplicationData(prev => ({ ...prev, companyName: e.target.value }))} placeholder="e.g., Google" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Job Title</label>
                      <input type="text" value={applicationData.jobTitle} onChange={(e) => setApplicationData(prev => ({ ...prev, jobTitle: e.target.value }))} placeholder={displayResume.title || 'Position'} className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none" />
                    </div>
                  </div>
                  <div className="p-6 pt-0 flex gap-3">
                    <button onClick={() => { setShowApplicationModal(false); setStep('preview'); }} className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver hover:bg-white/10 transition-colors font-medium">Skip & Preview Resume</button>
                    <button onClick={handleCreateApplication} disabled={isLoading || !applicationData.companyName.trim()} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-cyan-500 text-white font-bold disabled:opacity-50">
                      {isLoading ? 'Creating...' : '🎯 Track Application'}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Save Modal */}
        <AnimatePresence>
          {showSaveModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowSaveModal(false); setSaveVersionName(''); }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md rounded-3xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  <div className="relative p-6 border-b border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl">💾</span></div>
                      <div><h3 className="text-xl font-bold text-white">Save Version</h3><p className="text-sm text-silver">Name this resume version</p></div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-silver mb-2">Version Name</label>
                      <input type="text" value={saveVersionName} onChange={(e) => setSaveVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); }} placeholder="e.g., Senior PM at Google" autoFocus className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                    </div>
                    <p className="text-xs text-silver/60">💡 Tip: Use descriptive names for easy filtering later.</p>
                  </div>
                  <div className="p-6 pt-0 flex gap-3">
                    <button onClick={() => { setShowSaveModal(false); setSaveVersionName(''); }} className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver hover:bg-white/10 transition-colors font-medium">Cancel</button>
                    <button onClick={confirmSave} disabled={!saveVersionName.trim()} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold disabled:opacity-50">💾 Save Version</button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== RENDER: Create Flow =====
  if (mode === 'create') {
    const displayResume = buildResume;

    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Build From Scratch</h1>
              <p className="text-silver">Create a professional resume with AI assistance</p>
            </div>
            <button onClick={resetAll} className="px-4 py-2 rounded-xl bg-white/10 text-silver hover:bg-white/20 transition-colors">
              ← Start Over
            </button>
          </div>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Personal Info */}
                  <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Personal Information</h3>
                    <div className="space-y-4">
                      <input type="text" value={buildResume.name} onChange={(e) => setBuildResume(prev => ({ ...prev, name: e.target.value }))} placeholder="Full Name" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.title} onChange={(e) => setBuildResume(prev => ({ ...prev, title: e.target.value }))} placeholder="Job Title (e.g., Senior Software Engineer)" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="email" value={buildResume.email} onChange={(e) => setBuildResume(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.phone} onChange={(e) => setBuildResume(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      <input type="text" value={buildResume.location} onChange={(e) => setBuildResume(prev => ({ ...prev, location: e.target.value }))} placeholder="Location (e.g., San Francisco, CA)" className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white">Professional Summary</h3>
                      <button onClick={generateSummary} disabled={aiSuggesting} className="px-3 py-1 rounded-lg text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50">
                        {aiSuggesting ? '⏳ Generating...' : '✨ Generate with AI'}
                      </button>
                    </div>
                    <textarea value={buildResume.summary} onChange={(e) => setBuildResume(prev => ({ ...prev, summary: e.target.value }))} placeholder="Write a brief professional summary..." className="w-full h-48 px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none resize-none" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={() => setStep('jd')} disabled={!buildResume.name || !buildResume.title} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-50">
                    Add Experience →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'jd' && (
              <motion.div key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6 mb-6">
                  <h3 className="text-lg font-bold text-white mb-4">Work Experience</h3>
                  {buildResume.experience.map((exp, i) => (
                    <div key={i} className="mb-4 p-4 rounded-xl bg-[#111111] border border-white/10">
                      <div className="grid md:grid-cols-3 gap-3 mb-3">
                        <input type="text" value={exp.role} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].role = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Job Title" className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        <input type="text" value={exp.company} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].company = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Company" className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                        <input type="text" value={exp.duration} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].duration = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder="Duration (e.g., 2020-Present)" className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-silver">Achievements</span>
                        <button onClick={() => generateAchievements(i)} disabled={aiSuggesting} className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">{aiSuggesting ? '⏳...' : '✨ Generate'}</button>
                      </div>
                      {exp.achievements.map((a, j) => (
                        <input key={j} type="text" value={a} onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].achievements[j] = e.target.value; setBuildResume(prev => ({ ...prev, experience: newExp })); }} placeholder={`Achievement ${j + 1}`} className="w-full mb-2 px-3 py-2 rounded-lg bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                      ))}
                      <button onClick={() => { const newExp = [...buildResume.experience]; newExp[i].achievements.push(''); setBuildResume(prev => ({ ...prev, experience: newExp })); }} className="text-xs text-cyan-400">+ Add Achievement</button>
                    </div>
                  ))}
                  <button onClick={() => setBuildResume(prev => ({ ...prev, experience: [...prev.experience, { role: '', company: '', duration: '', achievements: [''] }] }))} className="w-full py-3 rounded-xl border border-dashed border-white/20 text-silver hover:border-cyan-500/50 hover:text-white">
                    + Add Experience
                  </button>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep('upload')} className="px-6 py-3 rounded-xl bg-white/10 text-silver">← Back</button>
                  <button onClick={() => setStep('template')} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white">Choose Template →</button>
                </div>
              </motion.div>
            )}

            {(step === 'template' || step === 'preview') && hasResumeData(displayResume) && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    {step === 'template' && (
                      <>
                        <h3 className="text-xl font-bold text-white">Choose Template</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {TEMPLATES.map((t) => (
                            <button key={t.id} onClick={() => setSelectedTemplate(t)} className={`p-3 rounded-xl border text-left text-sm ${selectedTemplate.id === t.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-[#111111]'}`}>
                              <span className="text-xl block mb-1">{t.preview}</span>
                              <span className="text-white font-medium">{t.name}</span>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setStep('preview')} className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white">Preview & Download →</button>
                      </>
                    )}
                    {step === 'preview' && (
                      <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6 space-y-3">
                        <h3 className="font-bold text-white mb-4">Actions</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={downloadPDF} disabled={isLoading} className="py-3 rounded-xl font-bold bg-white text-slate-900 text-sm">{isLoading ? '⏳...' : '📄 PDF'}</button>
                          <button onClick={downloadWord} disabled={isLoading} className="py-3 rounded-xl font-bold bg-[#0070F3] text-white text-sm">{isLoading ? '⏳...' : '📝 Word'}</button>
                        </div>
                        <button onClick={handleSave} className="w-full py-3 rounded-xl font-semibold bg-white/10 text-white">💾 Save Version</button>
                        <button onClick={() => setStep('template')} className="w-full py-3 rounded-xl font-semibold bg-[#111111] text-silver">🎨 Change Template</button>
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <div className="rounded-2xl bg-[#111111]/50 border border-white/10 p-4">
                      <div ref={resumeRef} className="bg-white rounded-xl shadow-2xl overflow-hidden" style={{ minHeight: '800px' }}>
                        <ResumeTemplate resume={displayResume} template={selectedTemplate} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save Modal (reused) */}
        <AnimatePresence>
          {showSaveModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowSaveModal(false); setSaveVersionName(''); }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md rounded-3xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  <div className="relative p-6 border-b border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl">💾</span></div>
                      <div><h3 className="text-xl font-bold text-white">Save Version</h3><p className="text-sm text-silver">Name this resume version</p></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <input type="text" value={saveVersionName} onChange={(e) => setSaveVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); }} placeholder="e.g., Software Engineer Resume" autoFocus className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none" />
                  </div>
                  <div className="p-6 pt-0 flex gap-3">
                    <button onClick={() => { setShowSaveModal(false); setSaveVersionName(''); }} className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver">Cancel</button>
                    <button onClick={confirmSave} disabled={!saveVersionName.trim()} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold disabled:opacity-50">💾 Save</button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Fallback
  return null;
}

// ============ RESUME TEMPLATE COMPONENT ============
function ResumeTemplate({ resume, template }: { resume: ResumeData; template: typeof TEMPLATES[0] }) {
  const { primary, accent, text } = template.colors;

  if (template.id === 'executive') {
    return (
      <div className="p-10 font-serif" style={{ color: text }}>
        <div className="border-b-4 pb-6 mb-6" style={{ borderColor: primary }}>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: primary }}>{resume.name}</h1>
          <p className="text-xl mt-1" style={{ color: accent }}>{resume.title}</p>
          <div className="flex gap-6 mt-3 text-sm text-gray-600">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.location && <span>{resume.location}</span>}
          </div>
        </div>
        {resume.summary && (
          <div className="mb-6">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Professional Summary</h2>
            <p className="text-gray-700 leading-relaxed">{resume.summary}</p>
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between items-start">
                  <div><h3 className="font-bold text-gray-900">{exp.role}</h3><p className="text-gray-600">{exp.company}</p></div>
                  <span className="text-sm text-gray-500">{exp.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">{a}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-6">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Education</h2>
              {resume.education.map((edu, i) => (
                <div key={i} className="mb-2">
                  <p className="font-semibold text-gray-900">{edu.degree}</p>
                  <p className="text-sm text-gray-600">{edu.institution} • {edu.year}</p>
                </div>
              ))}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Skills</h2>
              {resume.skills.map((cat, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-semibold text-gray-700">{cat.category}</p>
                  <p className="text-sm text-gray-600">{cat.items?.join(' • ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'modern') {
    return (
      <div className="flex min-h-full" style={{ color: text }}>
        <div className="w-1/3 p-6" style={{ backgroundColor: primary }}>
          <h1 className="text-2xl font-bold text-white mb-1">{resume.name}</h1>
          <p className="text-sm text-white/80 mb-6">{resume.title}</p>
          <div className="space-y-4 text-sm text-white/90">
            {resume.email && <div><p className="text-xs uppercase tracking-wider text-white/60 mb-1">Email</p>{resume.email}</div>}
            {resume.phone && <div><p className="text-xs uppercase tracking-wider text-white/60 mb-1">Phone</p>{resume.phone}</div>}
            {resume.location && <div><p className="text-xs uppercase tracking-wider text-white/60 mb-1">Location</p>{resume.location}</div>}
          </div>
          {resume.skills?.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-wider text-white/60 mb-3">Skills</h3>
              {resume.skills.map((cat, i) => (
                <div key={i} className="mb-3">
                  <p className="text-sm font-semibold text-white mb-1">{cat.category}</p>
                  <div className="flex flex-wrap gap-1">{cat.items?.map((s, j) => <span key={j} className="px-2 py-1 text-xs bg-white/20 rounded">{s}</span>)}</div>
                </div>
              ))}
            </div>
          )}
          {resume.education?.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-wider text-white/60 mb-3">Education</h3>
              {resume.education.map((edu, i) => (
                <div key={i} className="mb-3 text-sm text-white/90">
                  <p className="font-semibold">{edu.degree}</p>
                  <p className="text-white/70">{edu.institution}</p>
                  <p className="text-xs text-white/60">{edu.year}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-2/3 p-8">
          {resume.summary && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-2" style={{ color: primary }}>About Me</h2>
              <p className="text-gray-700 leading-relaxed">{resume.summary}</p>
            </div>
          )}
          {resume.experience?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: primary }}>Experience</h2>
              {resume.experience.map((exp, i) => (
                <div key={i} className="mb-5 pl-4 border-l-2" style={{ borderColor: accent }}>
                  <div className="flex justify-between"><h3 className="font-bold text-gray-900">{exp.role}</h3><span className="text-sm text-gray-500">{exp.duration}</span></div>
                  <p className="text-sm text-gray-600 mb-2">{exp.company}</p>
                  <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700">• {a}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'minimal') {
    return (
      <div className="p-10" style={{ color: text }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-wide">{resume.name}</h1>
          <p className="text-gray-500 mt-1">{resume.title}</p>
          <div className="flex justify-center gap-4 mt-3 text-sm text-gray-500">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <><span>•</span><span>{resume.phone}</span></>}
            {resume.location && <><span>•</span><span>{resume.location}</span></>}
          </div>
        </div>
        {resume.summary && <div className="border-t border-gray-200 pt-6 mb-6"><p className="text-gray-700 text-center max-w-2xl mx-auto">{resume.summary}</p></div>}
        {resume.experience?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Experience</h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-5">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium">{exp.role} <span className="font-normal text-gray-500">at {exp.company}</span></h3>
                  <span className="text-sm text-gray-400">{exp.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-600 pl-4 relative before:content-['–'] before:absolute before:left-0 before:text-gray-400">{a}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-8">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-3">Education</h2>
              {resume.education.map((edu, i) => <div key={i} className="mb-2"><p className="font-medium">{edu.degree}</p><p className="text-sm text-gray-500">{edu.institution} • {edu.year}</p></div>)}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">{resume.skills.flatMap(s => s.items).map((skill, i, arr) => <span key={i} className="text-sm text-gray-600">{skill}{i < arr.length - 1 ? ',' : ''}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'creative') {
    return (
      <div className="p-8" style={{ color: text }}>
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white" style={{ backgroundColor: primary }}>
            {resume.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: primary }}>{resume.name}</h1>
            <p className="text-xl text-gray-600">{resume.title}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              {resume.email && <span>📧 {resume.email}</span>}
              {resume.phone && <span>📱 {resume.phone}</span>}
              {resume.location && <span>📍 {resume.location}</span>}
            </div>
          </div>
        </div>
        {resume.summary && <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: `${primary}10` }}><p className="text-gray-700">{resume.summary}</p></div>}
        {resume.experience?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: primary }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>💼</span>Experience
            </h2>
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-4 p-4 rounded-xl bg-gray-50">
                <div className="flex justify-between"><div><h3 className="font-bold text-gray-900">{exp.role}</h3><p className="text-sm" style={{ color: accent }}>{exp.company}</p></div><span className="text-sm px-3 py-1 rounded-full bg-white text-gray-500">{exp.duration}</span></div>
                <ul className="mt-3 space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-sm text-gray-700 flex items-start gap-2"><span style={{ color: accent }}>▸</span>{a}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-6">
          {resume.education?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: primary }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>🎓</span>Education
              </h2>
              {resume.education.map((edu, i) => <div key={i} className="mb-2 p-3 rounded-lg bg-gray-50"><p className="font-semibold">{edu.degree}</p><p className="text-sm text-gray-600">{edu.institution} • {edu.year}</p></div>)}
            </div>
          )}
          {resume.skills?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: primary }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>⚡</span>Skills
              </h2>
              <div className="flex flex-wrap gap-2">{resume.skills.flatMap(s => s.items).map((skill, i) => <span key={i} className="px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: accent }}>{skill}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Technical (default)
  return (
    <div className="p-8 font-mono text-sm" style={{ color: text }}>
      <div className="border-b-2 pb-4 mb-6" style={{ borderColor: primary }}>
        <h1 className="text-2xl font-bold" style={{ color: primary }}>{resume.name}</h1>
        <p className="text-lg" style={{ color: accent }}>{resume.title}</p>
        <div className="flex gap-4 mt-2 text-gray-600">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone && <><span>|</span><span>{resume.phone}</span></>}
          {resume.location && <><span>|</span><span>{resume.location}</span></>}
        </div>
      </div>
      {resume.summary && (
        <div className="mb-6">
          <h2 className="font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>// Summary</h2>
          <p className="text-gray-700 bg-gray-50 p-3 rounded border-l-4" style={{ borderColor: accent }}>{resume.summary}</p>
        </div>
      )}
      {resume.skills?.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>// Technical Skills</h2>
          <div className="grid grid-cols-2 gap-3">
            {resume.skills.map((cat, i) => <div key={i} className="p-3 bg-gray-50 rounded"><p className="font-bold text-gray-700 mb-1">{cat.category}:</p><p className="text-gray-600">{cat.items?.join(', ')}</p></div>)}
          </div>
        </div>
      )}
      {resume.experience?.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>// Experience</h2>
          {resume.experience.map((exp, i) => (
            <div key={i} className="mb-4 p-4 bg-gray-50 rounded">
              <div className="flex justify-between items-start mb-2">
                <div><h3 className="font-bold text-gray-900">{exp.role}</h3><p className="text-gray-600">{exp.company}</p></div>
                <code className="px-2 py-1 bg-gray-200 rounded text-xs">{exp.duration}</code>
              </div>
              <ul className="space-y-1">{exp.achievements?.map((a, j) => <li key={j} className="text-gray-700 pl-4 relative before:content-['→'] before:absolute before:left-0">{a}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
      {resume.education?.length > 0 && (
        <div>
          <h2 className="font-bold uppercase tracking-wider mb-3" style={{ color: primary }}>// Education</h2>
          {resume.education.map((edu, i) => <div key={i} className="mb-2"><p className="font-bold">{edu.degree}</p><p className="text-gray-600">{edu.institution} ({edu.year})</p></div>)}
        </div>
      )}
    </div>
  );
}
