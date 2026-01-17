'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { database } from '@/lib/database';
import { showToast } from '@/components/Toast';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import type { Question } from '@/types';
import { celebrateSuccess } from '@/components/Confetti';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default function DetectiveTab() {
  const { currentCandidate, setCurrentCandidate } = useStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvPreview, setCvPreview] = useState('');
  const [scanning, setScanning] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newQuestion, setNewQuestion] = useState<Question>({
    question: '',
    purpose: '',
    expectedAnswer: '',
    isCustom: true,
  });

  // Calculate progress
  const progress = {
    cv: currentCandidate.cvText ? 100 : 0,
    jd: currentCandidate.jdText ? 100 : 0,
    name: currentCandidate.name ? 100 : 0,
    generated: currentCandidate.questions.length > 0 ? 100 : 0,
  };
  const totalProgress = (progress.cv + progress.jd + progress.name) / 3;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    // Check supported file types
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isWord = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileName.endsWith('.docx') || fileName.endsWith('.doc');
    const isText = fileType === 'text/plain' || fileName.endsWith('.txt');

    if (!isPDF && !isWord && !isText) {
      showToast('Please upload PDF, Word (.docx), or TXT file', '❌');
      return;
    }

    try {
      setScanning(true);
      let text = '';

      if (isPDF) {
        showToast('Scanning PDF...', '📄');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else if (isWord) {
        showToast('Scanning Word document...', '📘');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (isText) {
        showToast('Reading text file...', '📝');
        text = await file.text();
      }

      if (!text.trim()) {
        throw new Error('Could not extract text from file');
      }

      setCvPreview(text.trim());
      setCurrentCandidate({ cvText: text.trim() });
      showToast('CV processed successfully!', '✅');
    } catch (error) {
      console.error('File processing error:', error);
      showToast('Error processing file. Please try another format.', '❌');
    } finally {
      setScanning(false);
    }
  };

  const generateBattlePlan = async () => {
    if (!currentCandidate.cvText || !currentCandidate.jdText) {
      showToast('Please provide both CV and Job Description', '❌');
      return;
    }

    if (!currentCandidate.name) {
      showToast('Please enter candidate name', '❌');
      return;
    }

    setLoading(true);
    try {
      const systemPrompt = `You are an expert technical interviewer and talent assessor at Hirely.ai. Your role is to analyze candidate CVs against job descriptions and create comprehensive interview battle-plans. You identify skill gaps, generate strategic questions, and create trap questions to validate claimed expertise.`;

      const userPrompt = `Analyze this candidate CV against the Job Description and generate a comprehensive interview battle-plan.

CANDIDATE NAME: ${currentCandidate.name}

JOB DESCRIPTION:
${currentCandidate.jdText}

CANDIDATE CV:
${currentCandidate.cvText}

Provide your analysis in JSON format with the following structure:
{
  "riskFactors": [
    {
      "level": "high|medium|low",
      "description": "Detailed explanation of the risk factor or skill gap"
    }
  ],
  "coreQuestions": [
    {
      "question": "The interview question to ask",
      "purpose": "Why this question is important and what it tests",
      "expectedAnswer": "What a good answer should include or demonstrate"
    }
  ],
  "trapQuestions": [
    {
      "question": "A trap question designed to test deep expertise",
      "trap": "What makes this a trap question and what to watch for",
      "goodAnswer": "What a strong candidate should answer"
    }
  ]
}

Requirements:
- Generate 3-5 risk factors (prioritize high and medium risks)
- Generate exactly 10 core questions that test claimed expertise
- Generate exactly 3 trap questions to validate deep knowledge
- Be specific and actionable - questions should be tailored to this specific candidate and role
- Risk factors should identify actual skill gaps or concerns, not generic statements`;

      const data = await groqJSONCompletion<{
        riskFactors: Array<{ level: 'high' | 'medium' | 'low'; description: string }>;
        coreQuestions: Array<{ question: string; purpose: string; expectedAnswer: string }>;
        trapQuestions: Array<{ question: string; trap: string; goodAnswer: string }>;
      }>(systemPrompt, userPrompt, {
        temperature: 0.7,
        maxTokens: 4096,
      });

      if (data && (data.riskFactors || data.coreQuestions || data.trapQuestions)) {
        const normalizedRiskFactors = (data.riskFactors || []).map(rf => ({
          ...rf,
          level: (rf.level.toLowerCase() === 'high' || rf.level.toLowerCase() === 'medium' || rf.level.toLowerCase() === 'low')
            ? rf.level.toLowerCase() as 'high' | 'medium' | 'low'
            : 'medium' as const
        }));

        setCurrentCandidate({
          riskFactors: normalizedRiskFactors,
          questions: data.coreQuestions || [],
          trapQuestions: data.trapQuestions || [],
        });
        showToast('Battle plan generated successfully!', '🎯');
        celebrateSuccess();
      } else {
        throw new Error('Invalid response format from AI');
      }
    } catch (error: any) {
      console.error('Battle plan generation error:', error);
      showToast(
        error.message?.includes('403')
          ? 'Model access denied. Please enable GPT-OSS 120B in Groq console.'
          : error.message?.includes('401')
            ? 'Invalid API key. Please check your configuration.'
            : 'Error generating battle plan. Please try again.',
        '❌'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveBattlePlan = async () => {
    if (!currentCandidate.name || !currentCandidate.cvText || !currentCandidate.jdText) {
      showToast('Please complete all required fields', '❌');
      return;
    }

    setSaving(true);
    try {
      await database.saveCandidate({
        name: currentCandidate.name,
        cvText: currentCandidate.cvText,
        jdText: currentCandidate.jdText,
        questions: currentCandidate.questions,
        trapQuestions: currentCandidate.trapQuestions,
        riskFactors: currentCandidate.riskFactors,
        transcript: currentCandidate.transcript || '',
        humanGrades: currentCandidate.humanGrades,
        aiGrades: currentCandidate.aiGrades,
        notes: currentCandidate.notes || '',
        timestamp: new Date().toISOString(),
      });
      showToast('Battle plan saved successfully!', '✅');
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(error.message || 'Error saving battle plan', '❌');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (index: number) => setEditingIndex(index);
  const cancelEdit = () => setEditingIndex(null);

  const saveEdit = (index: number, updatedQuestion: Question) => {
    const updatedQuestions = [...currentCandidate.questions];
    updatedQuestions[index] = updatedQuestion;
    setCurrentCandidate({ questions: updatedQuestions });
    setEditingIndex(null);
    showToast('Question updated', '✅');
  };

  const deleteQuestion = (index: number) => {
    if (confirm('Are you sure you want to delete this question?')) {
      const updatedQuestions = currentCandidate.questions.filter((_, i) => i !== index);
      setCurrentCandidate({ questions: updatedQuestions });
      showToast('Question deleted', '🗑️');
    }
  };

  const addCustomQuestion = () => {
    if (!newQuestion.question.trim() || !newQuestion.purpose.trim()) {
      showToast('Please fill in question and purpose', '❌');
      return;
    }

    const updatedQuestions = [
      ...currentCandidate.questions,
      { ...newQuestion, isCustom: true },
    ];

    setCurrentCandidate({ questions: updatedQuestions });
    setNewQuestion({ question: '', purpose: '', expectedAnswer: '', isCustom: true });
    setShowAddQuestion(false);
    showToast('Custom question added', '✅');
  };

  return (
    <div className="space-y-8">
      {/* Hero Header with Progress */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-800/50 to-cyan-900/30 border border-white/10 p-8"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyber-cyan/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 mb-4"
              >
                <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
                <span className="text-xs font-medium text-cyber-cyan">Phase 1 • Pre-Interview Intelligence</span>
              </motion.div>

              <h1 className="text-4xl lg:text-5xl font-bold mb-3">
                <span className="text-gradient">Detective</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-xl">
                AI-powered CV analysis generating personalized battle plans with strategic questions
              </p>
            </div>

            {/* Progress Ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-6"
            >
              <div className="relative">
                <svg className="w-24 h-24 -rotate-90">
                  <circle
                    cx="48" cy="48" r="40"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48" cy="48" r="40"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${totalProgress * 2.51} 251`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00f5ff" />
                      <stop offset="100%" stopColor="#0099ff" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{Math.round(totalProgress)}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${progress.cv ? 'bg-green-400' : 'bg-white/20'}`} />
                  <span className="text-sm text-slate-400">CV Uploaded</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${progress.jd ? 'bg-green-400' : 'bg-white/20'}`} />
                  <span className="text-sm text-slate-400">Job Description</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${progress.name ? 'bg-green-400' : 'bg-white/20'}`} />
                  <span className="text-sm text-slate-400">Candidate Name</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Upload Section - Bento Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* CV Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 hover:border-cyan-500/30 transition-all duration-500"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                  <span className="text-3xl">📄</span>
                </div>
                {progress.cv > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">CV Intelligence</h3>
                <p className="text-sm text-slate-400">Upload resume for AI analysis</p>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`
                relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer
                transition-all duration-300
                ${dragActive
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                }
              `}
            >
              {scanning ? (
                <div className="space-y-4">
                  <div className="relative mx-auto w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white">Analyzing CV...</p>
                    <p className="text-sm text-slate-400">Extracting skills and experience</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <motion.div
                    animate={{ y: dragActive ? -5 : 0 }}
                    className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center"
                  >
                    <svg className={`w-8 h-8 ${dragActive ? 'text-cyan-400' : 'text-cyber-cyan'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </motion.div>
                  <div>
                    <p className="text-lg font-medium text-white">
                      {dragActive ? 'Drop file here' : 'Drag & drop CV'}
                    </p>
                    <p className="text-sm text-slate-400">or click to browse files</p>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <span>📄 PDF</span>
                    <span>📘 Word</span>
                    <span>📝 TXT</span>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <AnimatePresence>
              {cvPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="rounded-xl bg-black/30 border border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          ✓ Extracted
                        </span>
                        <span className="text-xs text-slate-500">{cvPreview.length.toLocaleString()} chars</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCvPreview(''); setCurrentCandidate({ cvText: '' }); }}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="font-mono text-xs text-slate-400 max-h-32 overflow-y-auto scrollbar-thin">
                      {cvPreview.substring(0, 500)}...
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Job Description Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-white/10 hover:border-blue-500/30 transition-all duration-500"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <span className="text-3xl">💼</span>
                </div>
                {progress.jd > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Job Requirements</h3>
                <p className="text-sm text-slate-400">Define the role specifications</p>
              </div>
            </div>

            <textarea
              rows={8}
              className="w-full rounded-xl p-4 text-sm bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-blue-400/50 focus:outline-none transition-colors resize-none mb-4"
              placeholder="Paste the Job Description here...

Example: Senior Software Engineer with 5+ years of Python, machine learning, and cloud infrastructure experience..."
              value={currentCandidate.jdText}
              onChange={(e) => setCurrentCandidate({ jdText: e.target.value })}
            />

            <div className="relative">
              <input
                type="text"
                className="w-full rounded-xl pl-12 pr-4 py-3.5 text-sm bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-blue-400/50 focus:outline-none transition-colors"
                placeholder="Candidate Name"
                value={currentCandidate.name}
                onChange={(e) => setCurrentCandidate({ name: e.target.value })}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <span className="text-xl">👤</span>
              </div>
              {progress.name > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center"
      >
        <button
          onClick={generateBattlePlan}
          disabled={loading || !currentCandidate.cvText || !currentCandidate.jdText || !currentCandidate.name}
          className="group relative px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-500 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan via-blue-500 to-cyber-cyan bg-[length:200%_100%] animate-gradient-x opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-white/20 to-cyan-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <span className="relative flex items-center gap-3 text-white">
            {loading ? (
              <>
                <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Analyzing & Generating...
              </>
            ) : (
              <>
                <span className="text-2xl">🧠</span>
                Generate Interview Battle-Plan
              </>
            )}
          </span>
        </button>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence>
        {currentCandidate.riskFactors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="space-y-8"
          >
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-white">Battle Plan Ready</p>
                  <p className="text-sm text-slate-400">
                    {currentCandidate.questions.length} questions • {currentCandidate.riskFactors.length} risks • {currentCandidate.trapQuestions.length} traps
                  </p>
                </div>
              </div>
              <button
                onClick={saveBattlePlan}
                disabled={saving}
                className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : '💾 Save Battle Plan'}
              </button>
            </div>

            {/* Risk Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-orange-900/10 border border-orange-500/20 overflow-hidden"
            >
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Gap Analysis</h3>
                    <p className="text-sm text-slate-400">{currentCandidate.riskFactors.length} risk factors identified</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {currentCandidate.riskFactors.map((rf, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-4 rounded-xl border transition-colors ${rf.level === 'high'
                        ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                        : rf.level === 'medium'
                          ? 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                          : 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl">
                        {rf.level === 'high' ? '🔴' : rf.level === 'medium' ? '🟡' : '🟢'}
                      </span>
                      <div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${rf.level === 'high' ? 'bg-red-500/20 text-red-400'
                            : rf.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                          {rf.level.toUpperCase()}
                        </span>
                        <p className="text-slate-300 mt-2">{rf.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Core Questions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-cyan-900/10 border border-cyan-500/20 overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <span className="text-3xl">🎯</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Core Questions</h3>
                    <p className="text-sm text-slate-400">{currentCandidate.questions.length} strategic questions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddQuestion(true)}
                  className="px-4 py-2 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 text-white transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>➕</span> Add Custom
                  </span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {currentCandidate.questions.map((q, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative p-5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.07] transition-all"
                  >
                    {editingIndex === i ? (
                      <div className="space-y-4">
                        <textarea
                          rows={2}
                          className="w-full rounded-lg p-3 text-sm bg-black/50 border border-white/20 text-white focus:border-cyan-400/50 focus:outline-none"
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...currentCandidate.questions];
                            updated[i] = { ...updated[i], question: e.target.value };
                            setCurrentCandidate({ questions: updated });
                          }}
                        />
                        <textarea
                          rows={2}
                          className="w-full rounded-lg p-3 text-sm bg-black/50 border border-white/20 text-white focus:border-cyan-400/50 focus:outline-none"
                          value={q.purpose}
                          placeholder="Purpose..."
                          onChange={(e) => {
                            const updated = [...currentCandidate.questions];
                            updated[i] = { ...updated[i], purpose: e.target.value };
                            setCurrentCandidate({ questions: updated });
                          }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(i, q)} className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-semibold">Save</button>
                          <button onClick={cancelEdit} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center font-bold text-cyan-400 flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium mb-2">{q.question}</p>
                          <p className="text-sm text-slate-400">
                            <span className="text-cyan-400 font-medium">Purpose:</span> {q.purpose}
                          </p>
                          {q.expectedAnswer && (
                            <p className="text-sm text-slate-500 mt-1">
                              <span className="text-purple-400 font-medium">Look for:</span> {q.expectedAnswer}
                            </p>
                          )}
                          {q.isCustom && (
                            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Custom</span>
                          )}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => startEditing(i)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => deleteQuestion(i)} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Trap Questions */}
            {currentCandidate.trapQuestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-purple-900/10 border border-purple-500/20 overflow-hidden"
              >
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <span className="text-3xl">🪤</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Expert Validation</h3>
                      <p className="text-sm text-slate-400">Trap questions to validate expertise</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {currentCandidate.trapQuestions.map((q, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                    >
                      <div className="flex gap-4">
                        <span className="text-2xl">🪤</span>
                        <div>
                          <p className="text-white font-medium mb-3">{q.question}</p>
                          <div className="space-y-2 text-sm">
                            <p className="text-slate-400">
                              <span className="text-purple-400 font-medium">Trap:</span> {q.trap}
                            </p>
                            <p className="text-slate-500">
                              <span className="text-green-400 font-medium">Good answer:</span> {q.goodAnswer}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Question Modal */}
      <AnimatePresence>
        {showAddQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddQuestion(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <span className="text-xl">➕</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Add Custom Question</h3>
                </div>
                <button
                  onClick={() => setShowAddQuestion(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Question *</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl p-4 text-sm bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    placeholder="Enter your interview question..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Purpose *</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-xl p-4 text-sm bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
                    value={newQuestion.purpose}
                    onChange={(e) => setNewQuestion({ ...newQuestion, purpose: e.target.value })}
                    placeholder="Why is this question important?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Expected Answer (Optional)</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-xl p-4 text-sm bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
                    value={newQuestion.expectedAnswer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, expectedAnswer: e.target.value })}
                    placeholder="What should a good answer include?"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex gap-3">
                <button
                  onClick={addCustomQuestion}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg transition-all"
                >
                  Add Question
                </button>
                <button
                  onClick={() => setShowAddQuestion(false)}
                  className="px-6 py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
