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

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Resume data structure
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

// Empty resume template
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

// Template definitions
const TEMPLATES = [
  { id: 'executive', name: 'Executive', description: 'Clean, professional design for senior roles', preview: '📊', colors: { primary: '#1a365d', accent: '#2b6cb0', text: '#1a202c' } },
  { id: 'modern', name: 'Modern', description: 'Contemporary style with bold headers', preview: '✨', colors: { primary: '#0d9488', accent: '#14b8a6', text: '#1e293b' } },
  { id: 'minimal', name: 'Minimal', description: 'Simple and elegant, ATS-friendly', preview: '🎯', colors: { primary: '#374151', accent: '#6b7280', text: '#111827' } },
  { id: 'creative', name: 'Creative', description: 'Stand out with unique layout', preview: '🎨', colors: { primary: '#7c3aed', accent: '#8b5cf6', text: '#1f2937' } },
  { id: 'technical', name: 'Technical', description: 'Optimized for tech roles', preview: '💻', colors: { primary: '#0369a1', accent: '#0284c7', text: '#0f172a' } },
];

// Skill categories for builder
const SKILL_CATEGORIES = [
  'Technical', 'Programming Languages', 'Frameworks', 'Tools & Platforms',
  'Soft Skills', 'Leadership', 'Languages', 'Certifications'
];

export default function LiquidResumePage() {
  const { user } = useStore();
  // Mode: 'choose' (landing), 'morph' (upload+morph flow), 'create' (build from scratch)
  const [mode, setMode] = useState<'choose' | 'morph' | 'create'>('choose');
  const [step, setStep] = useState<'upload' | 'jd' | 'template' | 'preview' | 'build'>('upload');
  const [originalResume, setOriginalResume] = useState<ResumeData | null>(null);
  const [morphedResume, setMorphedResume] = useState<ResumeData | null>(null);
  const [buildResume, setBuildResume] = useState<ResumeData>({ ...EMPTY_RESUME });
  const [jobDescription, setJobDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [morphPercentage, setMorphPercentage] = useState<number>(75);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [vaultSortOrder, setVaultSortOrder] = useState<'date' | 'name' | 'score'>('date');
  const [dragActive, setDragActive] = useState(false);
  const [buildStep, setBuildStep] = useState(0); // For guided builder
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationData, setApplicationData] = useState({ companyName: '', jobTitle: '', notes: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { if (user) loadVersions(); }, [user]);

  const loadVersions = async () => {
    const result = await getResumeVersions();
    if (result.success && result.data) setVersions(result.data);
  };

  // ============ MORPH FLOW FUNCTIONS ============
  const extractFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text.trim();
  };

  const extractFromWord = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  };

  const parseResumeWithAI = async (text: string): Promise<ResumeData> => {
    const systemPrompt = `You are an expert resume parser. Extract ALL information from this resume into a structured JSON format.

Return this EXACT JSON structure:
{
  "name": "Full Name",
  "title": "Current/Target Job Title",
  "email": "email@example.com",
  "phone": "phone number",
  "location": "City, State/Country",
  "linkedin": "LinkedIn URL if present",
  "website": "Personal website if present",
  "summary": "Professional summary (2-3 sentences)",
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Start - End",
      "achievements": ["Achievement 1 with metrics", "Achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "School Name",
      "year": "Year",
      "details": "GPA, honors if any"
    }
  ],
  "skills": [
    { "category": "Technical", "items": ["Skill1", "Skill2"] },
    { "category": "Soft Skills", "items": ["Communication", "Leadership"] }
  ],
  "certifications": ["Cert 1", "Cert 2"]
}

Extract as much detail as possible. For achievements, focus on quantifiable results.`;

    return await groqJSONCompletion<ResumeData>(systemPrompt, `Parse this resume:\n\n${text}`, { temperature: 0.3, maxTokens: 4096 });
  };

  const extractCompanyFromJD = async (jd: string): Promise<string> => {
    try {
      const res = await groqJSONCompletion<{ company: string }>(
        'Extract the Company Name from this Job Description. If none found, return empty string.',
        `JOB DESCRIPTION:\n${jd.substring(0, 2000)}\n\nReturn JSON: { "company": "Name" }`,
        { temperature: 0, maxTokens: 50 }
      );
      return res.company || '';
    } catch { return ''; }
  };

  const morphResumeToJD = async (resume: ResumeData, jd: string, percentage: number): Promise<{ morphed: ResumeData; score: number }> => {
    // Calculate exact proportions based on percentage
    const keepOriginal = 100 - percentage; // How much to keep from original
    const alignToJD = percentage; // How much to align to JD

    const systemPrompt = `You are an expert resume writer. Your task is to BLEND the original resume with job description requirements using EXACT proportions.

═══════════════════════════════════════════════════════════════
STRICT MORPHING FORMULA: ${percentage}% JD Alignment / ${keepOriginal}% Original
═══════════════════════════════════════════════════════════════

QUANTITATIVE RULES - FOLLOW EXACTLY:

1. SUMMARY (${percentage}% morph):
   - Keep ${keepOriginal}% of original wording/structure
   - Modify ${alignToJD}% to include JD keywords and requirements
   ${percentage <= 30 ? '→ Only add 1-2 keywords, keep original tone completely' :
        percentage <= 50 ? '→ Blend in 3-4 JD keywords while preserving core message' :
          percentage <= 70 ? '→ Rewrite to emphasize JD requirements while keeping facts' :
            '→ Fully rewrite as a pitch for this specific role'}

2. EXPERIENCE BULLET POINTS (${percentage}% morph per bullet):
   - For each achievement, keep ${keepOriginal}% of original phrasing
   - Modify ${alignToJD}% to align with JD requirements
   ${percentage <= 30 ? '→ Change only 1-2 words per bullet to add keywords' :
        percentage <= 50 ? '→ Rephrase about half of each bullet to match JD language' :
          percentage <= 70 ? '→ Significantly reword bullets to emphasize relevant skills' :
            '→ Completely rewrite bullets to maximize JD alignment'}

3. SKILLS SECTION (${percentage}% morph):
   - Keep ${keepOriginal}% of original skills in their original order
   - Reorder/add ${alignToJD}% to prioritize JD-relevant skills
   ${percentage <= 30 ? '→ Keep original order, maybe add 1 relevant skill' :
        percentage <= 50 ? '→ Move top JD skills higher, add 2-3 relevant skills' :
          percentage <= 70 ? '→ Reorganize to lead with JD skills, add several relevant ones' :
            '→ Fully reorganize around JD requirements, add all applicable skills'}

4. OVERALL KEYWORD DENSITY:
   - Target: Insert JD keywords into ${Math.round(percentage / 10)} out of every 10 sentences
   ${percentage <= 30 ? '→ Very light keyword insertion (1-2 per section)' :
        percentage <= 50 ? '→ Moderate keyword insertion (3-4 per section)' :
          percentage <= 70 ? '→ Heavy keyword insertion (5-6 per section)' :
            '→ Maximum keyword density while staying natural'}

✓ NEVER fabricate companies, dates, degrees, or job titles
✓ NEVER add skills the candidate couldn't reasonably have
✓ NEVER change factual information (numbers, metrics, dates)
✓ CRITICAL: Write as HUMANLY as possible. Avoid "robot" words like "leveraged", "utilized", "synergized" unless present in original.
✓ Keep professional tone but maintain the candidate's authentic voice.


EXAMPLE at ${percentage}%:
Original bullet: "Managed a team of 5 engineers to deliver projects on time"
${percentage <= 30 ? 'Morphed: "Managed a team of 5 engineers to deliver projects on time" (minimal change, maybe add 1 keyword)' :
        percentage <= 50 ? 'Morphed: "Led a cross-functional team of 5 engineers to deliver [JD-relevant] projects on schedule"' :
          percentage <= 70 ? 'Morphed: "Spearheaded a team of 5 engineers, driving [JD-specific outcomes] and ensuring on-time delivery"' :
            'Morphed: "Directed high-performing team of 5 engineers, achieving [JD-aligned metrics] through [JD-methodology]"'}

Return JSON:
{
  "morphedResume": { ...resume with EXACTLY ${percentage}% modification applied... },
  "matchScore": 0-100 (realistic score based on actual alignment achieved),
  "keyChanges": ["Specific change 1", "Specific change 2", ...]
}`;

    const result = await groqJSONCompletion<{ morphedResume: ResumeData; matchScore: number; keyChanges: string[] }>(
      systemPrompt,
      `MORPH PERCENTAGE: ${percentage}% (Keep ${keepOriginal}% original, align ${alignToJD}% to JD)

ORIGINAL RESUME:
${JSON.stringify(resume, null, 2)}

TARGET JOB DESCRIPTION:
${jd}

Apply EXACTLY ${percentage}% morphing as specified above.`,
      { temperature: 0.4, maxTokens: 6000 }
    );
    return { morphed: result.morphedResume, score: result.matchScore };
  };

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
      if (ext === '.pdf') { showToast('Reading PDF...', '📄'); text = await extractFromPDF(file); }
      else if (ext === '.docx' || ext === '.doc') { showToast('Reading Word...', '📘'); text = await extractFromWord(file); }
      else { text = await file.text(); }

      if (!text.trim()) { showToast('Could not extract text', '❌'); return; }

      showToast('Parsing resume with AI...', '🧠');
      const parsed = await parseResumeWithAI(text);
      setOriginalResume(parsed);
      showToast('Resume parsed!', '✅');
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
      const { morphed, score } = await morphResumeToJD(originalResume, jobDescription, morphPercentage);
      setMorphedResume(morphed);
      setMatchScore(score);
      setMorphedResume(morphed);
      setMatchScore(score);
      showToast(`Resume morphed! ${score}% match`, '✅');

      // Extract company name automatically
      if (!applicationData.companyName) {
        const extractedCompany = await extractCompanyFromJD(jobDescription);
        if (extractedCompany) {
          setApplicationData(prev => ({ ...prev, companyName: extractedCompany }));
        }
      }

      // Show application modal instead of going to template
      setStep('template');
    } catch (error) {
      console.error('Morph error:', error);
      showToast('Failed to morph resume', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApplication = async () => {
    if (!applicationData.companyName.trim()) {
      showToast('Please enter a company name', '❌');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createJobApplication({
        companyName: applicationData.companyName,
        jobTitle: applicationData.jobTitle || morphedResume?.title || 'Position',
        jobDescription: jobDescription,
        morphedResumeName: `${applicationData.companyName} - ${morphedResume?.title || 'Resume'}`,
        talentDensityScore: matchScore || undefined,
      });

      if (result.success) {
        showToast('Application created! Redirecting...', '🎉');
        setShowApplicationModal(false);
        // Redirect to applications page after a short delay
        setTimeout(() => {
          router.push('/suite/applications');
        }, 1000);
      } else {
        showToast('Failed to create application', '❌');
      }
    } catch (error) {
      console.error('Application error:', error);
      showToast('Failed to create application', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipApplication = () => {
    setShowApplicationModal(false);
    setStep('template');
  };

  // ============ BUILD FROM SCRATCH FUNCTIONS ============
  const generateSummary = async () => {
    if (!buildResume.title) { showToast('Add your target role first', '❌'); return; }
    setAiSuggesting(true);
    try {
      const prompt = `Write a compelling 2-3 sentence professional summary for someone with this profile:
Name: ${buildResume.name || 'Professional'}
Target Role: ${buildResume.title}
Experience: ${buildResume.experience.map(e => `${e.role} at ${e.company}`).join(', ') || 'Various roles'}
Skills: ${buildResume.skills.flatMap(s => s.items).join(', ') || 'Multiple skills'}

Write in first person, be confident, and highlight value proposition. Return ONLY the summary text.`;

      const summary = await groqCompletion('You are an expert resume writer.', prompt, { temperature: 0.7, maxTokens: 200 });
      setBuildResume({ ...buildResume, summary: summary.trim() });
      showToast('Summary generated!', '✨');
    } catch { showToast('Failed to generate', '❌'); }
    finally { setAiSuggesting(false); }
  };

  const generateAchievements = async (expIndex: number) => {
    const exp = buildResume.experience[expIndex];
    if (!exp.role || !exp.company) { showToast('Add role and company first', '❌'); return; }
    setAiSuggesting(true);
    try {
      const prompt = `Generate 3-4 impactful achievement bullet points for this role:
Role: ${exp.role}
Company: ${exp.company}
Duration: ${exp.duration || 'Not specified'}

Write bullet points that:
- Start with strong action verbs
- Include metrics and quantifiable results where possible
- Highlight impact and value delivered
- Are ATS-friendly with relevant keywords

Return a JSON array of strings: ["Achievement 1", "Achievement 2", ...]`;

      const achievements = await groqJSONCompletion<string[]>('You are an expert resume writer.', prompt, { temperature: 0.7, maxTokens: 500 });
      const newExperience = [...buildResume.experience];
      newExperience[expIndex].achievements = achievements;
      setBuildResume({ ...buildResume, experience: newExperience });
      showToast('Achievements generated!', '✨');
    } catch { showToast('Failed to generate', '❌'); }
    finally { setAiSuggesting(false); }
  };

  const suggestSkills = async () => {
    if (!buildResume.title) { showToast('Add your target role first', '❌'); return; }
    setAiSuggesting(true);
    try {
      const prompt = `Suggest relevant skills for this profile:
Target Role: ${buildResume.title}
Experience: ${buildResume.experience.map(e => e.role).join(', ') || 'Not specified'}

Return a JSON object with categorized skills:
{
  "Technical": ["skill1", "skill2"],
  "Tools & Platforms": ["tool1", "tool2"],
  "Soft Skills": ["skill1", "skill2"]
}`;

      const skills = await groqJSONCompletion<Record<string, string[]>>('You are a career expert.', prompt, { temperature: 0.7, maxTokens: 500 });
      const skillCategories = Object.entries(skills).map(([category, items]) => ({ category, items }));
      setBuildResume({ ...buildResume, skills: skillCategories });
      showToast('Skills suggested!', '✨');
    } catch { showToast('Failed to suggest', '❌'); }
    finally { setAiSuggesting(false); }
  };

  // ============ SHARED FUNCTIONS ============
  const downloadPDF = async () => {
    if (!resumeRef.current) return;
    setIsLoading(true);
    showToast('Generating PDF...', '📄');
    try {
      const canvas = await html2canvas(resumeRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const resumeName = morphedResume?.name || buildResume?.name || 'resume';
      pdf.save(`${resumeName}_resume.pdf`);
      showToast('PDF downloaded!', '✅');
    } catch (error) {
      console.error('PDF error:', error);
      showToast('Failed to generate PDF', '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const resumeToSave = morphedResume || (buildResume.name ? buildResume : null);
    if (!resumeToSave) return;
    const name = prompt('Enter version name:', `${resumeToSave.title || 'My Resume'}`);
    if (!name) return;
    try {
      const result = await saveResumeVersion(name, resumeToSave as any, { matchScore, template: selectedTemplate.id, morphPercentage }, 'technical');
      if (result.success) { showToast('Saved!', '✅'); loadVersions(); }
    } catch { showToast('Save failed', '❌'); }
  };

  const handleDeleteVersion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const result = await deleteResumeVersion(deleteConfirmId);
      if (result.success) {
        showToast('Version deleted', '🗑️');
        loadVersions();
      } else {
        showToast('Failed to delete', '❌');
      }
    } catch {
      showToast('Error deleting version', '❌');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
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

  // Get current display resume
  const displayResume = morphedResume || (buildResume.name ? buildResume : null);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-12 text-center max-w-md">
        <span className="text-6xl mb-4 block">🔒</span>
        <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-silver">Please sign in to access the Resume Builder</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] to-cyan-900/20 border border-white/10 p-8 mb-8"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-4">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-medium text-white/80">AI-Powered Resume Builder</span>
            </motion.div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-3">
              <span className="text-gradient">Liquid Resume Architect</span>
            </h1>
            <p className="text-silver text-lg max-w-2xl">
              {mode === 'choose' ? 'Morph your existing resume or build a stunning new one from scratch' :
                mode === 'morph' ? 'Upload → Match to JD → Download tailored resume' :
                  'Build your professional resume step by step with AI assistance'}
            </p>
          </div>
          {mode !== 'choose' && (
            <button onClick={resetAll} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
              ← Start Over
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ============ LANDING: CHOOSE MODE ============ */}
        {mode === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Morph Option */}
              <motion.button
                onClick={() => { setMode('morph'); setStep('upload'); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative p-8 rounded-3xl bg-[#0A0A0A] border border-white/10 hover:border-[#0070F3]/50 text-left transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#0070F3]/5 rounded-full blur-3xl group-hover:bg-[#0070F3]/10 transition-colors" />
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0070F3] to-[#0070F3]/60 flex items-center justify-center mb-6 shadow-lg shadow-[#0070F3]/25">
                    <span className="text-4xl">🔄</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Morph Existing Resume</h2>
                  <p className="text-silver mb-4">Upload your resume and let AI tailor it perfectly to any job description</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#111111] border border-white/10 text-xs text-silver">📄 PDF/Word</span>
                    <span className="px-3 py-1 rounded-full bg-[#111111] border border-white/10 text-xs text-silver">🧠 AI Rewrite</span>
                    <span className="px-3 py-1 rounded-full bg-[#111111] border border-white/10 text-xs text-silver">📊 Match Score</span>
                  </div>
                </div>
              </motion.button>

              {/* Create Option */}
              <motion.button
                onClick={() => { setMode('create'); setStep('build'); setBuildStep(0); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative p-8 rounded-3xl bg-[#0A0A0A] border border-white/10 hover:border-[#0070F3]/50 text-left transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#0070F3]/5 rounded-full blur-3xl group-hover:bg-[#0070F3]/10 transition-colors" />
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0070F3] to-[#0070F3]/60 flex items-center justify-center mb-6 shadow-lg shadow-[#0070F3]/25">
                    <span className="text-4xl">✨</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Build From Scratch</h2>
                  <p className="text-silver mb-4">Create a stunning resume step by step with AI-powered suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#111111] border border-white/10 text-xs text-silver">✏️ Guided Builder</span>
                    <span className="px-3 py-1 rounded-full bg-[#111111] border border-white/10 text-xs text-silver">💡 AI Suggestions</span>
                    <span className="px-3 py-1 rounded-full bg-[#111111] border border-white/10 text-xs text-silver">🎨 5 Templates</span>
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Recent Versions */}
            {/* Recent Versions Redesigned */}
            {versions.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px bg-white/10 flex-1" />
                  <h3 className="text-silver font-medium text-sm tracking-widest uppercase">My Resume Vault</h3>
                  <div className="h-px bg-white/10 flex-1" />

                  {/* Sort Dropdown */}
                  <select
                    value={vaultSortOrder}
                    onChange={(e) => setVaultSortOrder(e.target.value as any)}
                    className="px-3 py-1.5 rounded-lg bg-[#111111] border border-white/10 text-silver text-xs focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                  >
                    <option value="date">📅 By Date</option>
                    <option value="name">📝 By Name</option>
                    <option value="score">📊 By Match %</option>
                  </select>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[600px] overflow-y-auto pr-2">
                  {[...versions].sort((a, b) => {
                    if (vaultSortOrder === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    if (vaultSortOrder === 'name') return a.version_name.localeCompare(b.version_name);
                    if (vaultSortOrder === 'score') return ((b as any).matchScore || 0) - ((a as any).matchScore || 0);
                    return 0;
                  }).map((v) => (
                    <motion.button
                      key={v.id}
                      onClick={() => {
                        setBuildResume(v.content as any);
                        setMode('create');
                        setStep('template');
                      }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="group relative flex flex-col items-start p-5 rounded-2xl bg-[#111111] border border-white/5 hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10 transition-all text-left overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button
                          onClick={(e) => handleDeleteVersion(e, v.id)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete Version"
                        >
                          🗑️
                        </button>
                        <span className="p-2 text-xl">↗</span>
                      </div>

                      {/* Match Score & Morph Badge */}
                      <div className="flex gap-2 mb-3">
                        {v.matchScore && (
                          <div className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold">
                            {v.matchScore}% Match
                          </div>
                        )}
                        {(v.skill_graph as any)?.morphPercentage && (
                          <div className="px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
                            🧬 {(v.skill_graph as any).morphPercentage}% Morph
                          </div>
                        )}
                        {!v.matchScore && !(v.skill_graph as any)?.morphPercentage && (
                          <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-silver text-xs font-bold">
                            Draft
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-white text-lg truncate w-full mb-1 group-hover:text-cyan-400 transition-colors">
                        {v.version_name}
                      </h4>
                      <p className="text-xs text-silver mt-auto flex items-center gap-2">
                        <span>📅 {new Date(v.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{(v.content as any).title || 'Resume'}</span>
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ============ MORPH FLOW ============ */}
        {mode === 'morph' && (
          <motion.div key="morph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                    <motion.button
                      onClick={() => {
                        if (s.id === 'upload') setStep('upload');
                        else if (s.id === 'jd' && originalResume) setStep('jd');
                        else if (s.id === 'template' && morphedResume) setStep('template');
                        else if (s.id === 'preview' && morphedResume) setStep('preview');
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${step === s.id ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' :
                        (s.id === 'upload' || (s.id === 'jd' && originalResume) || ((s.id === 'template' || s.id === 'preview') && morphedResume))
                          ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#111111] text-silver'
                        }`}
                    >
                      <span>{s.icon}</span>
                      <span className="text-sm font-medium hidden md:inline">{s.label}</span>
                    </motion.button>
                    {i < 3 && <div className="w-8 lg:w-16 h-0.5 bg-white/10 mx-2" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Morph Steps Content */}
            <div className="max-w-6xl mx-auto">
              <AnimatePresence mode="wait">
                {/* Upload Step */}
                {step === 'upload' && (
                  <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${dragActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/20 hover:border-white/40 bg-[#111111]'
                          }`}
                      >
                        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} className="hidden" />
                        <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-6">
                          <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">{dragActive ? 'Drop it!' : 'Upload Resume'}</h3>
                        <p className="text-silver mb-6">Drag & drop or click to browse</p>
                        <div className="flex justify-center gap-6 text-sm text-silver">
                          <span>📄 PDF</span><span>📘 Word</span><span>📝 TXT</span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#111111] border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4">✨ How Morphing Works</h3>
                        <div className="space-y-4">
                          {[
                            { step: '1', title: 'Upload', desc: 'Upload your existing resume' },
                            { step: '2', title: 'Paste JD', desc: 'Add the target job description' },
                            { step: '3', title: 'AI Morphs', desc: 'AI rewrites to match the JD' },
                            { step: '4', title: 'Download', desc: 'Get your tailored PDF' },
                          ].map((item) => (
                            <div key={item.step} className="flex items-start gap-4">
                              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-cyan-400">{item.step}</span>
                              </div>
                              <div>
                                <h4 className="font-semibold text-white">{item.title}</h4>
                                <p className="text-sm text-silver">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* JD Step */}
                {step === 'jd' && originalResume && (
                  <motion.div key="jd" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="rounded-2xl bg-[#111111] border border-white/10 overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                          <h3 className="text-lg font-bold text-white">Your Resume ✅</h3>
                        </div>
                        <div className="p-6 max-h-[500px] overflow-y-auto">
                          <h4 className="text-2xl font-bold text-white">{originalResume.name}</h4>
                          <p className="text-cyan-400">{originalResume.title}</p>
                          <p className="text-sm text-silver mt-1">{originalResume.email}</p>
                          <div className="mt-4 p-3 rounded-lg bg-[#111111]">
                            <p className="text-sm text-silver">{originalResume.summary}</p>
                          </div>
                          <div className="mt-4">
                            <p className="text-sm text-silver mb-2">{originalResume.experience?.length} experiences • {originalResume.skills?.flatMap(s => s.items).length} skills</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#0A0A0A] to-blue-900/10 border border-blue-500/20 overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                          <h3 className="text-lg font-bold text-white">Target Job Description</h3>
                        </div>
                        <div className="p-6">
                          <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={10}
                            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-silver focus:border-blue-500/50 focus:outline-none resize-none mb-4"
                            placeholder="Paste the job description here..."
                          />

                          {/* Premium Morph Intensity Meter */}
                          <div className="mb-8 p-6 rounded-2xl bg-[#0F0F0F] border border-white/10 relative overflow-hidden group">
                            {/* Animated Background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 via-transparent to-blue-900/10 opacity-50 pointer-events-none" />

                            <div className="flex items-center justify-between mb-6 relative z-10">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/5">
                                  <span className="text-xl">🧬</span>
                                </div>
                                <div>
                                  <h4 className="font-bold text-white">Morph Intensity</h4>
                                  <p className="text-xs text-silver">Adjust how much AI adapts your resume</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${morphPercentage < 40 ? 'from-green-400 to-emerald-400' :
                                  morphPercentage < 70 ? 'from-cyan-400 to-blue-400' :
                                    'from-orange-400 to-red-400'
                                  }`}>
                                  {morphPercentage}%
                                </span>
                              </div>
                            </div>

                            <div className="relative h-4 bg-black/50 rounded-full mb-8 overflow-visible">
                              {/* Track Background */}
                              <div className="absolute inset-0 rounded-full bg-white/5" />

                              {/* Fill Bar */}
                              <motion.div
                                className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${morphPercentage < 40 ? 'from-green-500 to-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' :
                                  morphPercentage < 70 ? 'from-cyan-500 to-blue-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]' :
                                    'from-orange-500 to-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                                  }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${morphPercentage}%` }}
                                transition={{ type: 'spring', damping: 20 }}
                              />

                              {/* Slider Input (Invisible overlay) */}
                              <input
                                type="range"
                                min="10"
                                max="100"
                                step="5"
                                value={morphPercentage}
                                onChange={(e) => setMorphPercentage(Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                              />

                              {/* Custom Handle */}
                              <motion.div
                                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-4 border-[#0F0F0F] shadow-lg z-10 pointer-events-none flex items-center justify-center transform transition-transform group-hover:scale-110"
                                animate={{ left: `${morphPercentage}%`, x: '-50%' }}
                              >
                                <div className={`w-2 h-2 rounded-full ${morphPercentage < 40 ? 'bg-emerald-500' :
                                  morphPercentage < 70 ? 'bg-cyan-500' :
                                    'bg-red-500'
                                  }`} />
                              </motion.div>
                            </div>

                            {/* Descriptive Labels */}
                            <div className="grid grid-cols-3 text-center gap-2">
                              <div className={`transition-opacity duration-300 ${morphPercentage <= 40 ? 'opacity-100' : 'opacity-30'}`}>
                                <h5 className="text-sm font-bold text-emerald-400">Human Polish</h5>
                                <p className="text-[10px] text-silver mt-1">Refines tone, keeps original structure.</p>
                              </div>
                              <div className={`transition-opacity duration-300 ${morphPercentage > 40 && morphPercentage <= 75 ? 'opacity-100' : 'opacity-30'}`}>
                                <h5 className="text-sm font-bold text-cyan-400">Smart Tailor</h5>
                                <p className="text-[10px] text-silver mt-1">Balances keywords with natural flow.</p>
                              </div>
                              <div className={`transition-opacity duration-300 ${morphPercentage > 75 ? 'opacity-100' : 'opacity-30'}`}>
                                <h5 className="text-sm font-bold text-red-400">Deep Morph</h5>
                                <p className="text-[10px] text-silver mt-1">Aggressive rewrite for max ATS score.</p>
                              </div>
                            </div>
                          </div>

                          <button onClick={handleMorph} disabled={isLoading || !jobDescription.trim()}
                            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-50"
                          >
                            {isLoading ? '🧠 AI is Rewriting...' : '🧠 Morph Resume to Match JD'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Template & Preview Steps (shared with create mode) */}
                {(step === 'template' || step === 'preview') && displayResume && (
                  <TemplateAndPreview
                    step={step}
                    setStep={setStep}
                    resume={displayResume}
                    selectedTemplate={selectedTemplate}
                    setSelectedTemplate={setSelectedTemplate}
                    matchScore={matchScore}
                    isLoading={isLoading}
                    downloadPDF={downloadPDF}
                    handleSave={handleSave}
                    resumeRef={resumeRef}
                    templates={TEMPLATES}
                    setShowApplicationModal={setShowApplicationModal}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ============ CREATE FROM SCRATCH ============ */}
        {mode === 'create' && (
          <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Builder Progress */}
            {step === 'build' && (
              <div className="max-w-4xl mx-auto mb-6">
                <div className="flex items-center justify-between p-1 rounded-xl bg-[#111111] border border-white/10">
                  {['Personal', 'Experience', 'Education', 'Skills', 'Summary'].map((label, i) => (
                    <button key={i} onClick={() => setBuildStep(i)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${buildStep === i ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' :
                        buildStep > i ? 'bg-white/10 text-white' : 'text-silver'
                        }`}
                    >
                      {buildStep > i ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-w-6xl mx-auto">
              <AnimatePresence mode="wait">
                {step === 'build' && (
                  <motion.div key="builder" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Builder Form */}
                      <div className="lg:col-span-2">
                        <div className="rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20 overflow-hidden">
                          <div className="p-6 border-b border-white/10">
                            <h3 className="text-xl font-bold text-white">
                              {['👤 Personal Info', '💼 Experience', '🎓 Education', '⚡ Skills', '✍️ Summary'][buildStep]}
                            </h3>
                          </div>
                          <div className="p-6">
                            {/* Step 0: Personal Info */}
                            {buildStep === 0 && (
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <input type="text" placeholder="Full Name *" value={buildResume.name}
                                    onChange={(e) => setBuildResume({ ...buildResume, name: e.target.value })}
                                    className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                  />
                                  <input type="text" placeholder="Target Job Title *" value={buildResume.title}
                                    onChange={(e) => setBuildResume({ ...buildResume, title: e.target.value })}
                                    className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                  />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                  <input type="email" placeholder="Email *" value={buildResume.email}
                                    onChange={(e) => setBuildResume({ ...buildResume, email: e.target.value })}
                                    className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                  />
                                  <input type="tel" placeholder="Phone *" value={buildResume.phone}
                                    onChange={(e) => setBuildResume({ ...buildResume, phone: e.target.value })}
                                    className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                  />
                                </div>
                                <input type="text" placeholder="Location (City, State)" value={buildResume.location}
                                  onChange={(e) => setBuildResume({ ...buildResume, location: e.target.value })}
                                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                />
                                <div className="grid md:grid-cols-2 gap-4">
                                  <input type="url" placeholder="LinkedIn URL (optional)" value={buildResume.linkedin || ''}
                                    onChange={(e) => setBuildResume({ ...buildResume, linkedin: e.target.value })}
                                    className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                  />
                                  <input type="url" placeholder="Website (optional)" value={buildResume.website || ''}
                                    onChange={(e) => setBuildResume({ ...buildResume, website: e.target.value })}
                                    className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Step 1: Experience */}
                            {buildStep === 1 && (
                              <div className="space-y-4">
                                {buildResume.experience.map((exp, i) => (
                                  <div key={i} className="p-4 rounded-xl bg-[#111111] border border-white/10 space-y-3">
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-semibold text-cyan-400">Experience {i + 1}</span>
                                      <button onClick={() => {
                                        const newExp = buildResume.experience.filter((_, idx) => idx !== i);
                                        setBuildResume({ ...buildResume, experience: newExp });
                                      }} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-3">
                                      <input placeholder="Job Title *" value={exp.role}
                                        onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].role = e.target.value; setBuildResume({ ...buildResume, experience: newExp }); }}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                      />
                                      <input placeholder="Company *" value={exp.company}
                                        onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].company = e.target.value; setBuildResume({ ...buildResume, experience: newExp }); }}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                      />
                                    </div>
                                    <input placeholder="Duration (e.g., Jan 2020 - Present)" value={exp.duration}
                                      onChange={(e) => { const newExp = [...buildResume.experience]; newExp[i].duration = e.target.value; setBuildResume({ ...buildResume, experience: newExp }); }}
                                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                    />
                                    <div>
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-silver">Achievements</span>
                                        <button onClick={() => generateAchievements(i)} disabled={aiSuggesting}
                                          className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50"
                                        >{aiSuggesting ? '...' : '✨ AI Generate'}</button>
                                      </div>
                                      {exp.achievements.map((ach, j) => (
                                        <div key={j} className="flex gap-2 mb-2">
                                          <input value={ach} onChange={(e) => {
                                            const newExp = [...buildResume.experience];
                                            newExp[i].achievements[j] = e.target.value;
                                            setBuildResume({ ...buildResume, experience: newExp });
                                          }} className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none" placeholder="Achievement..." />
                                          <button onClick={() => {
                                            const newExp = [...buildResume.experience];
                                            newExp[i].achievements = newExp[i].achievements.filter((_, idx) => idx !== j);
                                            setBuildResume({ ...buildResume, experience: newExp });
                                          }} className="text-red-400 text-xs">✕</button>
                                        </div>
                                      ))}
                                      <button onClick={() => {
                                        const newExp = [...buildResume.experience];
                                        newExp[i].achievements.push('');
                                        setBuildResume({ ...buildResume, experience: newExp });
                                      }} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add Achievement</button>
                                    </div>
                                  </div>
                                ))}
                                <button onClick={() => setBuildResume({ ...buildResume, experience: [...buildResume.experience, { role: '', company: '', duration: '', achievements: [''] }] })}
                                  className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-silver hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                                >+ Add Experience</button>
                              </div>
                            )}

                            {/* Step 2: Education */}
                            {buildStep === 2 && (
                              <div className="space-y-4">
                                {buildResume.education.map((edu, i) => (
                                  <div key={i} className="p-4 rounded-xl bg-[#111111] border border-white/10 space-y-3">
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-semibold text-cyan-400">Education {i + 1}</span>
                                      <button onClick={() => {
                                        const newEdu = buildResume.education.filter((_, idx) => idx !== i);
                                        setBuildResume({ ...buildResume, education: newEdu });
                                      }} className="text-red-400 text-xs">Remove</button>
                                    </div>
                                    <input placeholder="Degree (e.g., Bachelor of Science in Computer Science)" value={edu.degree}
                                      onChange={(e) => { const newEdu = [...buildResume.education]; newEdu[i].degree = e.target.value; setBuildResume({ ...buildResume, education: newEdu }); }}
                                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                    />
                                    <div className="grid md:grid-cols-2 gap-3">
                                      <input placeholder="Institution" value={edu.institution}
                                        onChange={(e) => { const newEdu = [...buildResume.education]; newEdu[i].institution = e.target.value; setBuildResume({ ...buildResume, education: newEdu }); }}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                      />
                                      <input placeholder="Year (e.g., 2020)" value={edu.year}
                                        onChange={(e) => { const newEdu = [...buildResume.education]; newEdu[i].year = e.target.value; setBuildResume({ ...buildResume, education: newEdu }); }}
                                        className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                      />
                                    </div>
                                    <input placeholder="Additional details (GPA, honors, etc.)" value={edu.details || ''}
                                      onChange={(e) => { const newEdu = [...buildResume.education]; newEdu[i].details = e.target.value; setBuildResume({ ...buildResume, education: newEdu }); }}
                                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
                                    />
                                  </div>
                                ))}
                                <button onClick={() => setBuildResume({ ...buildResume, education: [...buildResume.education, { degree: '', institution: '', year: '', details: '' }] })}
                                  className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-silver hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                                >+ Add Education</button>
                              </div>
                            )}

                            {/* Step 3: Skills */}
                            {buildStep === 3 && (
                              <div className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm text-silver">Add skills by category</span>
                                  <button onClick={suggestSkills} disabled={aiSuggesting}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 disabled:opacity-50"
                                  >{aiSuggesting ? 'Suggesting...' : '✨ AI Suggest Skills'}</button>
                                </div>
                                {buildResume.skills.map((cat, i) => (
                                  <div key={i} className="p-4 rounded-xl bg-[#111111] border border-white/10">
                                    <div className="flex justify-between items-center mb-3">
                                      <select value={cat.category} onChange={(e) => {
                                        const newSkills = [...buildResume.skills];
                                        newSkills[i].category = e.target.value;
                                        setBuildResume({ ...buildResume, skills: newSkills });
                                      }} className="bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
                                        {SKILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                      <button onClick={() => {
                                        const newSkills = buildResume.skills.filter((_, idx) => idx !== i);
                                        setBuildResume({ ...buildResume, skills: newSkills });
                                      }} className="text-red-400 text-xs">Remove</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {cat.items.map((skill, j) => (
                                        <span key={j} className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 text-sm flex items-center gap-2">
                                          {skill}
                                          <button onClick={() => {
                                            const newSkills = [...buildResume.skills];
                                            newSkills[i].items = newSkills[i].items.filter((_, idx) => idx !== j);
                                            setBuildResume({ ...buildResume, skills: newSkills });
                                          }} className="text-cyan-400 hover:text-white">✕</button>
                                        </span>
                                      ))}
                                      <button onClick={() => {
                                        const skill = prompt('Enter skill:');
                                        if (skill) {
                                          const newSkills = [...buildResume.skills];
                                          newSkills[i].items.push(skill);
                                          setBuildResume({ ...buildResume, skills: newSkills });
                                        }
                                      }} className="px-3 py-1.5 rounded-full border border-dashed border-white/20 text-silver text-sm hover:border-cyan-500/50">+ Add</button>
                                    </div>
                                  </div>
                                ))}
                                <button onClick={() => setBuildResume({ ...buildResume, skills: [...buildResume.skills, { category: 'Technical', items: [] }] })}
                                  className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-silver hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                                >+ Add Skill Category</button>
                              </div>
                            )}

                            {/* Step 4: Summary */}
                            {buildStep === 4 && (
                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-silver">Professional summary (2-3 sentences)</span>
                                  <button onClick={generateSummary} disabled={aiSuggesting}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 disabled:opacity-50"
                                  >{aiSuggesting ? 'Generating...' : '✨ AI Generate'}</button>
                                </div>
                                <textarea rows={5} value={buildResume.summary} onChange={(e) => setBuildResume({ ...buildResume, summary: e.target.value })}
                                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none resize-none"
                                  placeholder="Write a compelling summary that highlights your value proposition..."
                                />
                              </div>
                            )}

                            {/* Navigation */}
                            <div className="flex justify-between mt-6 pt-6 border-t border-white/10">
                              <button onClick={() => setBuildStep(Math.max(0, buildStep - 1))} disabled={buildStep === 0}
                                className="px-6 py-3 rounded-xl bg-white/10 text-white disabled:opacity-30"
                              >← Previous</button>
                              {buildStep < 4 ? (
                                <button onClick={() => setBuildStep(buildStep + 1)}
                                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold"
                                >Next →</button>
                              ) : (
                                <button onClick={() => setStep('template')} disabled={!buildResume.name}
                                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-cyan-500 text-white font-semibold disabled:opacity-50"
                                >Choose Template →</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Preview Card */}
                      <div className="rounded-2xl bg-[#111111] border border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                          <h4 className="font-semibold text-white">Live Preview</h4>
                        </div>
                        <div className="p-4 max-h-[600px] overflow-y-auto">
                          <div className="bg-white rounded-xl p-4 text-slate-900 text-xs">
                            <h2 className="text-lg font-bold text-slate-800">{buildResume.name || 'Your Name'}</h2>
                            <p className="text-cyan-600">{buildResume.title || 'Your Title'}</p>
                            <p className="text-silver text-[10px] mt-1">{[buildResume.email, buildResume.phone, buildResume.location].filter(Boolean).join(' • ') || 'Contact info'}</p>
                            {buildResume.summary && <p className="mt-3 text-slate-600">{buildResume.summary}</p>}
                            {buildResume.experience.length > 0 && (
                              <div className="mt-3">
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Experience</h3>
                                {buildResume.experience.slice(0, 2).map((exp, i) => (
                                  <div key={i} className="mt-2">
                                    <p className="font-semibold">{exp.role || 'Role'}</p>
                                    <p className="text-silver">{exp.company} {exp.duration && `• ${exp.duration}`}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {buildResume.skills.length > 0 && (
                              <div className="mt-3">
                                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Skills</h3>
                                <p className="text-slate-600">{buildResume.skills.flatMap(s => s.items).slice(0, 8).join(', ')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Template & Preview (shared) */}
                {(step === 'template' || step === 'preview') && (
                  <TemplateAndPreview
                    step={step}
                    setStep={setStep}
                    resume={buildResume}
                    selectedTemplate={selectedTemplate}
                    setSelectedTemplate={setSelectedTemplate}
                    matchScore={null}
                    isLoading={isLoading}
                    downloadPDF={downloadPDF}
                    handleSave={handleSave}
                    resumeRef={resumeRef}
                    templates={TEMPLATES}
                    setShowApplicationModal={setShowApplicationModal}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && step !== 'jd' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Processing...</h3>
              <p className="text-silver">AI is working on your resume</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            >
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-3xl">🗑️</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Delete Resume?</h3>
                  <p className="text-silver text-sm mb-6">
                    This action cannot be undone. The resume version will be permanently removed from your vault.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-silver hover:bg-white/10 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Application Creation Modal */}
      <AnimatePresence>
        {showApplicationModal && (morphedResume || buildResume.name) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApplicationModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 overflow-hidden"
              >
                {/* Success Header */}
                <div className="relative p-8 text-center border-b border-white/10">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-cyan-500/10" />
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-green-500/25"
                    >
                      <span className="text-4xl">🎉</span>
                    </motion.div>
                    <h2 className="text-2xl font-bold text-white mb-2">Resume Morphed Successfully!</h2>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                      <span className="text-green-400 font-bold text-lg">{matchScore}%</span>
                      <span className="text-green-300 text-sm">Match Score</span>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                  <p className="text-silver text-center mb-4">
                    Track this application to monitor your job search progress
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-silver mb-2">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={applicationData.companyName}
                      onChange={(e) => setApplicationData({ ...applicationData, companyName: e.target.value })}
                      placeholder="e.g., Google, Microsoft, Startup Inc."
                      className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-silver mb-2">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={applicationData.jobTitle}
                      onChange={(e) => setApplicationData({ ...applicationData, jobTitle: e.target.value })}
                      placeholder={morphedResume?.title || 'e.g., Senior Software Engineer'}
                      className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-silver mb-2">
                      Notes (optional)
                    </label>
                    <textarea
                      value={applicationData.notes}
                      onChange={(e) => setApplicationData({ ...applicationData, notes: e.target.value })}
                      placeholder="Add any notes about this application..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                    />
                  </div>

                  {/* Quick Status Selection */}
                  <div>
                    <label className="block text-sm font-medium text-silver mb-2">
                      Initial Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'not_applied', label: 'Not Applied', icon: '📝', color: 'slate' },
                        { id: 'applied', label: 'Applied', icon: '🚀', color: 'blue' },
                        { id: 'screening', label: 'Screening', icon: '👀', color: 'cyan' },
                      ].map((status) => (
                        <button
                          key={status.id}
                          type="button"
                          className={`p-3 rounded-xl border text-center transition-all hover:scale-105 ${status.color === 'slate' ? 'bg-slate-500/20 border-slate-500/30 text-silver' :
                            status.color === 'blue' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' :
                              'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                            }`}
                        >
                          <span className="text-xl block mb-1">{status.icon}</span>
                          <span className="text-xs font-medium">{status.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                  <button
                    onClick={handleSkipApplication}
                    className="flex-1 px-4 py-3 rounded-xl bg-[#111111] text-silver hover:bg-white/10 transition-colors font-medium"
                  >
                    Skip & Preview Resume
                  </button>
                  <button
                    onClick={handleCreateApplication}
                    disabled={isLoading || !applicationData.companyName.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-cyan-500 text-white font-bold hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Creating...' : '🎯 Track Application'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ SHARED TEMPLATE & PREVIEW COMPONENT ============
function TemplateAndPreview({
  step, setStep, resume, selectedTemplate, setSelectedTemplate, matchScore, isLoading, downloadPDF, handleSave, resumeRef, templates, setShowApplicationModal
}: {
  step: string;
  setStep: (s: any) => void;
  resume: ResumeData;
  selectedTemplate: typeof TEMPLATES[0];
  setSelectedTemplate: (t: typeof TEMPLATES[0]) => void;
  matchScore: number | null;
  isLoading: boolean;
  downloadPDF: () => void;
  handleSave: () => void;
  resumeRef: React.RefObject<HTMLDivElement>;
  templates: typeof TEMPLATES;
  setShowApplicationModal: (show: boolean) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      {step === 'template' && (
        <motion.div key="template" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
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
                <button onClick={() => setStep('preview')} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
                  Preview & Download →
                </button>
              </div>
            </div>
          )}
          <h3 className="text-xl font-bold text-white mb-4">Choose a Professional Template</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {templates.map((template) => (
              <motion.button key={template.id} onClick={() => setSelectedTemplate(template)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${selectedTemplate.id === template.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-[#111111] hover:border-white/30'}`}
              >
                <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${template.colors.primary}40, ${template.colors.accent}40)` }}>
                  {template.preview}
                </div>
                <h4 className="font-bold text-white">{template.name}</h4>
                <p className="text-xs text-silver">{template.description}</p>
              </motion.button>
            ))}
          </div>
          <div className="rounded-2xl bg-[#111111] border border-white/10 p-6">
            <div className="flex justify-between mb-4">
              <h4 className="font-bold text-white">Preview</h4>
              <button onClick={() => setStep('preview')} className="text-sm text-cyan-400">Full Size →</button>
            </div>
            <div className="bg-white rounded-xl p-6 text-slate-900 max-h-64 overflow-hidden relative">
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
              <h2 className="text-xl font-bold" style={{ color: selectedTemplate.colors.primary }}>{resume.name}</h2>
              <p className="text-sm" style={{ color: selectedTemplate.colors.accent }}>{resume.title}</p>
              <p className="text-xs text-gray-500 mb-3">{[resume.email, resume.phone, resume.location].filter(Boolean).join(' • ')}</p>
              <p className="text-xs text-gray-700">{resume.summary}</p>
            </div>
          </div>
          {!matchScore && (
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep('preview')} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                Preview & Download →
              </button>
            </div>
          )}
        </motion.div>
      )}

      {step === 'preview' && (
        <motion.div key="preview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="font-bold text-white mb-4">Actions</h3>
                <div className="space-y-3">
                  <button onClick={downloadPDF} disabled={isLoading}
                    className="w-full py-4 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >{isLoading ? '⏳ Generating...' : '⬇️ Download PDF'}</button>

                  <button onClick={() => setShowApplicationModal(true)}
                    className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-green-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-green-500/25 transition-all"
                  >🎯 Track Application</button>

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
                  <ResumeTemplate resume={resume} template={selectedTemplate} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
