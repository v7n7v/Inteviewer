'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { authFetch } from '@/lib/auth-fetch';
import PageHelp from '@/components/PageHelp';
import { useAuthGate } from '@/hooks/useAuthGate';
import FileUploadDropzone from '@/components/FileUploadDropzone';
import { type ResumeVersion } from '@/lib/database-suite';
import ResumeLibraryPicker from '@/components/ResumeLibraryPicker';
import dynamic from 'next/dynamic';

const DebriefJournal = dynamic(() => import('@/app/suite/interview-debrief/page').then(m => ({ default: m.DebriefContent })), {
  loading: () => <div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />,
});

// ============================================
// TYPES
// ============================================
interface GauntletQuestion {
    id: string;
    text: string;
    type: 'behavioral' | 'technical' | 'system-design' | 'situational' | 'leadership';
    context: string; // why this question matters for the JD
    difficulty: 'standard' | 'advanced' | 'killer';
}

interface StarBreakdown {
    present: boolean;
    feedback: string;
}

interface GradingResult {
    overall_score: number;
    star_method: {
        situation: StarBreakdown;
        task: StarBreakdown;
        action: StarBreakdown;
        result: StarBreakdown;
    };
    strengths: string[];
    improvements: string[];
    filler_analysis: {
        weak_phrases: string[];
        feedback: string;
    };
    follow_up_question: string;
    coaching_tip: string;
    rewritten_answer: string;
}

interface QuestionResult {
    question: GauntletQuestion;
    answer: string;
    grading: GradingResult;
    timeSpent: number; // seconds
}

interface Flashcard {
    question: string;
    answer: string;
    category: 'technical' | 'behavioral' | 'domain' | 'company';
    difficulty: 'basic' | 'intermediate' | 'advanced';
}

type ViewMode = 'setup' | 'gauntlet' | 'scorecard' | 'debrief' | 'flashcards' | 'journal';
type InterviewType = 'mock-interview' | 'quick-drill' | 'study-cards';
type DrillCategory = 'behavioral' | 'technical' | 'system-design' | 'leadership';
type InterviewStyle = 'friendly' | 'tough';
type InterviewerPersona = 'faang-lead' | 'friendly-hr' | 'startup-cto' | 'vp-engineering' | 'consulting-partner' | 'behavioral-specialist';

const PERSONA_OPTIONS: { id: InterviewerPersona; icon: string; label: string; subtitle: string; colorClass: string; activeClass: string }[] = [
    { id: 'faang-lead', icon: 'psychology', label: 'FAANG Tech Lead', subtitle: 'Surgical. Probing.', colorClass: 'bg-red-500/10 text-red-500 border-red-500/20', activeClass: 'border-red-500/50 bg-red-500/10 shadow-lg shadow-red-500/10' },
    { id: 'friendly-hr', icon: 'sentiment_satisfied', label: 'Friendly HR', subtitle: 'Warm but thorough.', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', activeClass: 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10' },
    { id: 'startup-cto', icon: 'rocket_launch', label: 'Startup CTO', subtitle: 'Ship it. Be scrappy.', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20', activeClass: 'border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/10' },
    { id: 'vp-engineering', icon: 'bar_chart', label: 'VP of Engineering', subtitle: 'Strategic. Big-picture.', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20', activeClass: 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10' },
    { id: 'consulting-partner', icon: 'work', label: 'Consulting Partner', subtitle: 'Structured. MECE.', colorClass: 'bg-violet-500/10 text-violet-500 border-violet-500/20', activeClass: 'border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-500/10' },
    { id: 'behavioral-specialist', icon: 'science', label: 'STAR Specialist', subtitle: 'Deep behavioral probing.', colorClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', activeClass: 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' },
];

const QUESTION_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    behavioral: { icon: <span className="material-symbols-rounded text-[14px]">psychology</span>, label: 'Behavioral', color: 'from-blue-500/20 to-cyan-500/20' },
    technical: { icon: <span className="material-symbols-rounded text-[14px]">settings</span>, label: 'Technical', color: 'from-emerald-500/20 to-teal-500/20' },
    'system-design': { icon: <span className="material-symbols-rounded text-[14px]">architecture</span>, label: 'System Design', color: 'from-amber-500/20 to-orange-500/20' },
    situational: { icon: <span className="material-symbols-rounded text-[14px]">theater_comedy</span>, label: 'Situational', color: 'from-violet-500/20 to-purple-500/20' },
    leadership: { icon: <span className="material-symbols-rounded text-[14px]">stars</span>, label: 'Leadership', color: 'from-rose-500/20 to-pink-500/20' },
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function GauntletPage() {
    const { user } = useStore();
    const router = useRouter();
    const { handleApiError, renderAuthModal } = useAuthGate();

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('setup');

    // Setup state
    const [interviewType, setInterviewType] = useState<InterviewType>('mock-interview');
    const [drillCategory, setDrillCategory] = useState<DrillCategory>('behavioral');
    const [drillRole, setDrillRole] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [resumeText, setResumeText] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('tough');
    const [selectedPersona, setSelectedPersona] = useState<InterviewerPersona>('faang-lead');

    // Resume upload state
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [isUploadingResume, setIsUploadingResume] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Saved Resumes integration
    const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
    const [selectedResumeName, setSelectedResumeName] = useState('');

    // ── Restore setup state from sessionStorage on mount ──
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('tc_interview_setup');
            if (saved) {
                const s = JSON.parse(saved);
                if (s.jobDescription) setJobDescription(s.jobDescription);
                if (s.resumeText) setResumeText(s.resumeText);
                if (s.uploadedFileName) setUploadedFileName(s.uploadedFileName);
                if (s.interviewType) setInterviewType(s.interviewType);
                if (s.drillCategory) setDrillCategory(s.drillCategory);
                if (s.drillRole) setDrillRole(s.drillRole);
                if (s.questionCount) setQuestionCount(s.questionCount);
                if (s.interviewStyle) setInterviewStyle(s.interviewStyle);
                if (s.selectedPersona) setSelectedPersona(s.selectedPersona);
            }

            // Check if morphed resume context was passed from Resume Studio
            const morphedJD = sessionStorage.getItem('tc_morphed_jd');
            const morphedResume = sessionStorage.getItem('tc_morphed_resume');
            if (morphedJD) {
                setJobDescription(morphedJD);
                sessionStorage.removeItem('tc_morphed_jd');
            }
            if (morphedResume) {
                setResumeText(morphedResume);
                setUploadedFileName('Morphed Resume');
                sessionStorage.removeItem('tc_morphed_resume');
            }
        } catch {}

        // Fallback: read Skill Bridge practice skill from localStorage
        try {
            const bridgeSkill = localStorage.getItem('tc_gauntlet_skill');
            if (bridgeSkill) {
                setDrillRole(bridgeSkill);
                setInterviewType('quick-drill');
                localStorage.removeItem('tc_gauntlet_skill');
            }
        } catch {}
    }, []);

    // ── Persist setup state to sessionStorage on change ──
    useEffect(() => {
        if (viewMode !== 'setup') return; // Only persist while on setup screen
        try {
            sessionStorage.setItem('tc_interview_setup', JSON.stringify({
                jobDescription, resumeText, uploadedFileName,
                interviewType, drillCategory, drillRole,
                questionCount, interviewStyle, selectedPersona,
            }));
        } catch {}
    }, [jobDescription, resumeText, uploadedFileName, interviewType, drillCategory, drillRole, questionCount, interviewStyle, selectedPersona, viewMode]);

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
            content.education.forEach((e: any) => parts.push(`${e.degree} from ${e.school} (${e.date || ''})`) );
        }
        if (content.projects?.length) {
            parts.push('Projects:');
            content.projects.forEach((p: any) => { parts.push(p.name); if (p.description) parts.push(p.description); });
        }
        return parts.join('\n\n');
    };

    const handleSelectResume = (rv: ResumeVersion) => {
        const text = formatResumeToText(rv.content);
        setResumeText(text);
        setUploadedFileName(rv.version_name || (rv.content as any)?.name || 'Saved Resume');
        setSelectedResumeId(rv.id);
        setSelectedResumeName(rv.version_name);
    };

    // Audio mode state
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [liveMode, setLiveMode] = useState(false);
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const { isRecording, startRecording, stopRecording, getVisualizerData } = useAudioRecorder();
    const { isPlaying, playAudio, stopAudio } = useAudioPlayer();
    const geminiLive = useGeminiLive();

    // Sync live voice transcript → answer textarea in real-time
    useEffect(() => {
        if (liveMode && geminiLive.userTranscript) {
            setUserAnswer(geminiLive.userTranscript);
        }
    }, [liveMode, geminiLive.userTranscript]);
    const [visualizerData, setVisualizerData] = useState<number[]>([]);
    const animFrameRef = useRef<number | null>(null);

    // Flashcard state
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [flashcardIndex, setFlashcardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [flashcardRatings, setFlashcardRatings] = useState<Record<number, 'got-it' | 'needs-work'>>({});

    // Gauntlet state
    const [questions, setQuestions] = useState<GauntletQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGrading, setIsGrading] = useState(false);

    // Results state
    const [currentGrading, setCurrentGrading] = useState<GradingResult | null>(null);
    const [results, setResults] = useState<QuestionResult[]>([]);
    const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
    const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());

    // Timer
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Answer textarea ref
    const answerRef = useRef<HTMLTextAreaElement>(null);

    // Timer effect
    useEffect(() => {
        if (viewMode === 'gauntlet' && !currentGrading && !isGrading) {
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - questionStartTime) / 1000));
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [viewMode, currentGrading, isGrading, questionStartTime]);

    // Format timer
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };



    // ============================================
    // FLASHCARD GENERATION
    // ============================================
    const generateFlashcards = async () => {
        setIsGenerating(true);
        try {
            const res = await authFetch('/api/gauntlet/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'flashcards',
                    jobDescription: jobDescription || undefined,
                    resumeText: resumeText || undefined,
                    questionCount,
                }),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                if (handleApiError(errBody)) { setIsGenerating(false); return; }
                throw new Error(errBody.error || 'Failed to generate flashcards');
            }
            const data = await res.json();
            const cards: Flashcard[] = (data.flashcards || []).map((c: any) => ({
                question: c.question, answer: c.answer,
                category: c.category || 'technical',
                difficulty: c.difficulty || 'intermediate',
            }));
            if (cards.length === 0) { showToast('No flashcards generated', 'cancel'); setIsGenerating(false); return; }
            setFlashcards(cards);
            setFlashcardIndex(0);
            setIsFlipped(false);
            setFlashcardRatings({});
            setViewMode('flashcards');
            showToast(`${cards.length} study cards ready`, 'library_books');
        } catch (error) {
            console.error('Flashcard generation error:', error);
            showToast('Failed to generate flashcards', 'cancel');
        } finally {
            setIsGenerating(false);
        }
    };

    // ============================================
    // STUDY VAULT — Generate Study Notes
    // ============================================
    const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
    
    const handleGenerateVaultNotes = async (type: 'flashcards' | 'interview') => {
        setIsGeneratingNotes(true);
        let itemsToSave = [];
        
        if (type === 'flashcards') {
            itemsToSave = flashcards.filter((f, i) => flashcardRatings[i] === 'needs-work');
            if (itemsToSave.length === 0) {
                showToast('No cards marked "Needs Work" to summarize! You aced it.', 'check_circle');
                setIsGeneratingNotes(false);
                return;
            }
        } else {
            itemsToSave = results.map(r => ({ question: r.question.text, userAnswer: r.answer, feedback: r.grading.coaching_tip || r.grading.rewritten_answer })) || [];
            if (itemsToSave.length === 0) {
                showToast('No interview data to save.', 'cancel');
                setIsGeneratingNotes(false);
                return;
            }
        }

        try {
            showToast('Generating Study Notes & saving to Vault...', 'library_books');
            const res = await authFetch('/api/vault/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, topic: jobDescription ? jobDescription.substring(0, 100) + '...' : 'General Practice', items: itemsToSave })
            });
            
            if (!res.ok) throw new Error('Failed to generate vault notes');
            showToast('Saved to your Study Vault!', 'check_circle');
            router.push('/suite/vault');
        } catch (e: any) {
            console.error('Vault error:', e);
            showToast(e.message || 'Failed to save to Vault', 'cancel');
        } finally {
            setIsGeneratingNotes(false);
        }
    };

    // ============================================
    // TTS — Speak Question Aloud
    // ============================================
    const speakQuestion = async (text: string) => {
        setIsSpeakingQuestion(true);
        try {
            // Send the persona name so the backend can map it to a CosyVoice voice
            const voiceHint = selectedPersona || voiceGender;
            const res = await authFetch('/api/voice/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceId: voiceHint }),
            });
            if (!res.ok) throw new Error('TTS failed');
            const audioBlob = await res.blob();
            await playAudio(audioBlob, () => setIsSpeakingQuestion(false));
        } catch (error) {
            console.error('TTS error:', error);
            setIsSpeakingQuestion(false);
        }
    };

    // ============================================
    // STT — Record & Transcribe Answer
    // ============================================
    const handleVoiceAnswer = async () => {
        if (isRecording) {
            const blob = await stopRecording();
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            if (!blob) return;
            setIsTranscribing(true);
            try {
                const formData = new FormData();
                formData.append('file', blob, 'answer.webm');
                const res = await authFetch('/api/voice/transcribe', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Transcription failed');
                const { text } = await res.json();
                setUserAnswer(prev => prev ? prev + ' ' + text : text);
                showToast('Answer transcribed', 'mic');
            } catch (error) {
                console.error('Transcription error:', error);
                showToast('Failed to transcribe', 'cancel');
            } finally {
                setIsTranscribing(false);
            }
        } else {
            startRecording();
            // Start visualizer animation
            const updateVisualizer = () => {
                setVisualizerData(getVisualizerData());
                animFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            animFrameRef.current = requestAnimationFrame(updateVisualizer);
        }
    };

    // ============================================
    // GENERATE QUESTIONS
    // ============================================
    const startGauntlet = async () => {
        setIsGenerating(true);
        try {
            if (interviewType === 'mock-interview' && !jobDescription.trim()) {
                showToast('Paste a job description to start', 'cancel');
                setIsGenerating(false);
                return;
            }

            const res = await authFetch('/api/gauntlet/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobDescription: jobDescription || undefined,
                    resumeText: resumeText || undefined,
                    interviewStyle,
                    persona: selectedPersona,
                    questionCount,
                    interviewType,
                    drillCategory,
                    drillRole: drillRole || undefined,
                }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                if (handleApiError(errBody)) { setIsGenerating(false); return; }
                throw new Error(errBody.error || 'Failed to generate questions');
            }
            const response = await res.json();

            const generated: GauntletQuestion[] = (response.questions || []).map((q: any, i: number) => ({
                id: `q-${i}-${Date.now()}`,
                text: q.text,
                type: (q.type as GauntletQuestion['type']) || 'behavioral',
                context: q.context,
                difficulty: (q.difficulty as GauntletQuestion['difficulty']) || 'standard',
            }));

            if (generated.length === 0) {
                showToast('Failed to generate questions. Try again.', 'cancel');
                setIsGenerating(false);
                return;
            }

            setQuestions(generated);
            setCurrentIndex(0);
            setResults([]);
            setCurrentGrading(null);
            setUserAnswer('');
            setSessionStartTime(Date.now());
            setQuestionStartTime(Date.now());
            setElapsed(0);
            setViewMode('gauntlet');
            showToast(`${generated.length} questions locked and loaded`, 'swords');
        } catch (error) {
            console.error('Failed to generate questions:', error);
            showToast('Failed to generate questions', 'cancel');
        } finally {
            setIsGenerating(false);
        }
    };

    // ============================================
    // GRADE ANSWER
    // ============================================
    const submitAnswer = async () => {
        if (!userAnswer.trim()) {
            showToast('Type your answer first', 'edit');
            return;
        }

        setIsGrading(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

        try {
            const res = await authFetch('/api/gauntlet/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questions[currentIndex].text,
                    answer: userAnswer,
                    jobDescription: jobDescription || undefined,
                    resumeText: resumeText || undefined,
                    questionType: questions[currentIndex].type,
                    persona: selectedPersona,
                }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                if (handleApiError(errBody)) { setIsGrading(false); return; }
                throw new Error(errBody.error || 'Grading failed');
            }

            const grading: GradingResult = await res.json();
            setCurrentGrading(grading);

            setResults(prev => [...prev, {
                question: questions[currentIndex],
                answer: userAnswer,
                grading,
                timeSpent,
            }]);

            setViewMode('scorecard');
        } catch (error) {
            console.error('Grading error:', error);
            showToast('Failed to grade answer. Try again.', 'cancel');
        } finally {
            setIsGrading(false);
        }
    };

    // ============================================
    // NEXT QUESTION / FINISH
    // ============================================
    const nextQuestion = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setCurrentGrading(null);
            setUserAnswer('');
            setQuestionStartTime(Date.now());
            setElapsed(0);
            setViewMode('gauntlet');
            setTimeout(() => answerRef.current?.focus(), 100);
        } else {
            setViewMode('debrief');
        }
    };

    // Score color helper
    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-400';
        if (score >= 70) return 'text-cyan-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 90) return 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30';
        if (score >= 70) return 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30';
        if (score >= 50) return 'from-amber-500/20 to-orange-500/20 border-amber-500/30';
        return 'from-red-500/20 to-rose-500/20 border-red-500/30';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 90) return 'Exceptional';
        if (score >= 70) return 'Strong';
        if (score >= 50) return 'Needs Work';
        if (score >= 30) return 'Weak';
        return 'Critical';
    };


    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* ============================================ */}
            {/* HEADER */}
            {/* ============================================ */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto relative overflow-hidden rounded-2xl glass-card p-6 mb-6"
            >
                <div className="absolute inset-0 overflow-hidden">
                    <motion.div
                        animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute top-0 right-0 w-96 h-96 bg-red-500/15 rounded-full blur-3xl"
                    />
                    <motion.div
                        animate={{ x: [0, -30, 0], y: [0, 50, 0] }}
                        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl"
                    />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4"
                        >
                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-cyan-500" />
                            <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">AI Interview Simulator</span>
                        </motion.div>
                        <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                            <span className="text-[var(--text-primary)]">
                                Interview Simulator
                            </span>
                        </h1>
                        <p className="text-[var(--text-secondary)] text-sm max-w-xl">
                            {viewMode === 'setup' && 'Train like you fight. AI-powered interview simulation with real-time grading.'}
                            {viewMode === 'gauntlet' && `Question ${currentIndex + 1} of ${questions.length}`}
                            {viewMode === 'scorecard' && 'Answer graded. Review your performance.'}
                            {viewMode === 'debrief' && 'Session complete. Here\'s your performance breakdown.'}
                            {viewMode === 'flashcards' && `Study Card ${flashcardIndex + 1} of ${flashcards.length}`}
                            {viewMode === 'journal' && 'Log and review your real interviews.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                    {viewMode !== 'setup' && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setViewMode('setup');
                                setQuestions([]);
                                setResults([]);
                                setCurrentGrading(null);
                                setUserAnswer('');
                            }}
                            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
                        >
                            ← New Session
                        </motion.button>
                    )}

                    {/* Debrief Journal Tab */}
                    {viewMode === 'setup' && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setViewMode('journal')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: 'rgba(139,92,246,0.08)',
                          border: '1px solid rgba(139,92,246,0.2)',
                          color: '#8b5cf6',
                        }}
                      >
                        <span className="material-symbols-rounded text-base">rate_review</span>
                        Debrief Journal
                      </motion.button>
                    )}
                    <PageHelp toolId="flashcards" />
                    </div>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* ============================================ */}
                {/* JOURNAL VIEW — Real Interview Debrief Log */}
                {/* ============================================ */}
                {viewMode === 'journal' && (
                    <motion.div key="journal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <DebriefJournal />
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* SETUP VIEW */}
                {/* ============================================ */}
                {viewMode === 'setup' && (
                    <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto">
                        {/* Interview Type Selection */}
                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                            <motion.button
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setInterviewType('mock-interview')}
                                className={`group relative p-5 rounded-2xl glass-card text-left transition-all overflow-hidden ${interviewType === 'mock-interview' ? 'border-red-500/50 shadow-lg shadow-red-500/10' : 'border-white/10 hover:border-white/20'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br from-red-500/10 to-orange-500/10 ${interviewType === 'mock-interview' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'} transition-opacity`} />
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3 shadow-inner">
                                        <span className="text-lg text-rose-500"><span className="material-symbols-rounded text-inherit align-middle">my_location</span></span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1">Mock Interview</h3>
                                    <p className="text-silver text-xs leading-relaxed">Paste a JD + resume. AI generates targeted questions against the role's requirements.</p>
                                    {interviewType === 'mock-interview' && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                            <span className="text-white text-xs">✓</span>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setInterviewType('quick-drill')}
                                className={`group relative p-5 rounded-2xl glass-card text-left transition-all overflow-hidden ${interviewType === 'quick-drill' ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-white/10 hover:border-white/20'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 ${interviewType === 'quick-drill' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'} transition-opacity`} />
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 shadow-inner">
                                        <span className="text-lg text-amber-500"><span className="material-symbols-rounded text-inherit align-middle">bolt</span></span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1">Quick Drill</h3>
                                    <p className="text-silver text-xs leading-relaxed">Pick a category and practice. Rapid-fire questions to sharpen specific skills.</p>
                                    {interviewType === 'quick-drill' && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                            <span className="text-white text-xs">✓</span>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setInterviewType('study-cards')}
                                className={`group relative p-5 rounded-2xl glass-card text-left transition-all overflow-hidden ${interviewType === 'study-cards' ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'border-white/10 hover:border-white/20'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 ${interviewType === 'study-cards' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'} transition-opacity`} />
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 shadow-inner">
                                        <span className="text-lg text-cyan-500"><span className="material-symbols-rounded text-inherit align-middle">library_books</span></span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1">Study Cards</h3>
                                    <p className="text-silver text-xs leading-relaxed">AI flashcards from your JD + resume. Flip, rate yourself, and drill key concepts.</p>
                                    {interviewType === 'study-cards' && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                                            <span className="text-white text-xs">✓</span>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.button>
                        </div>

                        {/* Configuration Panel */}
                        <div className="rounded-2xl glass-card p-5">
                            {interviewType === 'study-cards' ? (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-white font-medium mb-2">Job Description <span className="text-cyan-400">*</span></label>
                                        <textarea
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                            placeholder="Paste the JD to generate role-specific study cards..."
                                            rows={4}
                                            className="w-full p-4 rounded-xl bg-[#111] border border-white/10 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-white placeholder-silver/50 resize-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                                            <label className="flex items-center gap-2 text-white font-medium">
                                                Your Resume <span className="text-silver text-xs font-normal">(optional — makes cards more targeted)</span>
                                            </label>
                                            <ResumeLibraryPicker
                                                onSelect={handleSelectResume}
                                                selectedId={selectedResumeId}
                                                selectedName={selectedResumeName}
                                                compact
                                            />
                                        </div>
                                        <div className="relative">
                                            <FileUploadDropzone 
                                                variant="compact"
                                                value={resumeText}
                                                onChange={(val) => { setResumeText(val); setUploadedFileName(''); }}
                                                placeholder="Paste your resume or drop a Word doc..."
                                                rows={3}
                                                isUploading={isUploadingResume}
                                                setIsUploading={setIsUploadingResume}
                                                onUploadSuccess={(text, fileName) => {
                                                    setResumeText(text);
                                                    setUploadedFileName(fileName);
                                                    showToast(`Resume loaded: ${fileName}`, 'description');
                                                }}
                                                className="w-full"
                                            />
                                        </div>
                                        {uploadedFileName && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                                                <span><span className="material-symbols-rounded text-inherit align-middle">description</span> {uploadedFileName}</span>
                                                <button onClick={() => { setUploadedFileName(''); setResumeText(''); }} className="text-silver hover:text-red-400 transition-colors"><span className="material-symbols-rounded">close</span></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : interviewType === 'mock-interview' ? (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-white font-medium mb-2">Job Description <span className="text-red-400">*</span></label>
                                        <textarea
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                            placeholder="Paste the full job description here. The more detail, the sharper the questions..."
                                            rows={6}
                                            className="w-full p-4 rounded-xl bg-[#111] border border-white/10 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 text-white placeholder-silver/50 resize-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                                            <label className="flex items-center gap-2 text-white font-medium">
                                                Your Resume <span className="text-silver text-xs font-normal">(optional — enables gap analysis)</span>
                                            </label>
                                            <ResumeLibraryPicker
                                                onSelect={handleSelectResume}
                                                selectedId={selectedResumeId}
                                                selectedName={selectedResumeName}
                                                compact
                                            />
                                        </div>
                                        <div className="relative">
                                            <FileUploadDropzone 
                                                variant="compact"
                                                value={resumeText}
                                                onChange={(val) => { setResumeText(val); setUploadedFileName(''); }}
                                                placeholder="Paste your resume text or drop a Word doc..."
                                                rows={4}
                                                isUploading={isUploadingResume}
                                                setIsUploading={setIsUploadingResume}
                                                onUploadSuccess={(text, fileName) => {
                                                    setResumeText(text);
                                                    setUploadedFileName(fileName);
                                                    showToast(`Resume loaded: ${fileName}`, 'description');
                                                }}
                                                className="w-full"
                                            />
                                        </div>
                                        {uploadedFileName && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                                                <span><span className="material-symbols-rounded text-inherit align-middle">description</span> {uploadedFileName}</span>
                                                <button onClick={() => { setUploadedFileName(''); setResumeText(''); }} className="text-silver hover:text-red-400 transition-colors"><span className="material-symbols-rounded">close</span></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Target Role / Field */}
                                    <div>
                                        <label className="block text-white font-medium mb-3">Your Target Role / Field *</label>
                                        <input
                                            type="text"
                                            value={drillRole}
                                            onChange={(e) => setDrillRole(e.target.value)}
                                            placeholder="e.g. Senior Software Engineer, Product Manager, Data Scientist..."
                                            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-colors text-sm"
                                        />
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {['Software Engineer', 'Product Manager', 'Data Scientist', 'DevOps Engineer', 'UX Designer', 'Engineering Manager'].map((role) => (
                                                <button
                                                    key={role}
                                                    onClick={() => setDrillRole(role)}
                                                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                                        drillRole === role
                                                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                                            : 'bg-white/5 border-white/10 text-silver hover:text-white hover:bg-white/10'
                                                    }`}
                                                >
                                                    {role}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Category Selection */}
                                    <div>
                                        <label className="block text-white font-medium mb-3">Choose Category</label>
                                        <div className="flex gap-2">
                                            {/* Left side categories */}
                                            <div className="flex-1 flex flex-col gap-2">
                                                {[
                                                    { id: 'behavioral', icon: <span className="material-symbols-rounded text-sm">psychology</span>, label: 'Behavioral' },
                                                    { id: 'technical', icon: <span className="material-symbols-rounded text-sm">settings</span>, label: 'Technical' },
                                                ].map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setDrillCategory(t.id as any)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${drillCategory === t.id
                                                            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                                                            {t.icon}
                                                        </div>
                                                        <span className="font-semibold text-white">{t.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Right side categories */}
                                            <div className="flex-1 flex flex-col gap-2">
                                                {[
                                                    { id: 'leadership', icon: <span className="material-symbols-rounded text-sm">stars</span>, label: 'Leadership' },
                                                    { id: 'situational', icon: <span className="material-symbols-rounded text-sm">theater_comedy</span>, label: 'Situational' }
                                                ].map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setDrillCategory(t.id as any)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${drillCategory === t.id
                                                            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                                                            {t.icon}
                                                        </div>
                                                        <span className="font-semibold text-white">{t.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resume Upload for Quick Drill */}
                                    <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                                            <label className="block text-white font-medium">
                                                Your Resume <span className="text-silver text-xs font-normal">(optional — personalizes questions to your background)</span>
                                            </label>
                                            <ResumeLibraryPicker
                                                onSelect={handleSelectResume}
                                                selectedId={selectedResumeId}
                                                selectedName={selectedResumeName}
                                                compact
                                            />
                                        </div>
                                        <div className="relative">
                                            <FileUploadDropzone 
                                                variant="compact"
                                                value={resumeText}
                                                onChange={(val) => { setResumeText(val); setUploadedFileName(''); }}
                                                placeholder="Paste your resume or drop a file..."
                                                rows={3}
                                                isUploading={isUploadingResume}
                                                setIsUploading={setIsUploadingResume}
                                                onUploadSuccess={(text, fileName) => {
                                                    setResumeText(text);
                                                    setUploadedFileName(fileName);
                                                    showToast(`Resume loaded: ${fileName}`, 'description');
                                                }}
                                                className="w-full"
                                            />
                                        </div>
                                        {uploadedFileName && (
                                            <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400">
                                                <span><span className="material-symbols-rounded text-inherit align-middle">description</span> {uploadedFileName}</span>
                                                <button onClick={() => { setUploadedFileName(''); setResumeText(''); }} className="text-silver hover:text-red-400 transition-colors"><span className="material-symbols-rounded">close</span></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Settings Row */}
                            <div className="mt-8 grid md:grid-cols-3 gap-6 p-6 rounded-2xl bg-white/5 border border-white/5">
                                {/* Question Count */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Questions: <span className="text-red-400 font-bold">{questionCount}</span>
                                    </label>
                                    <input
                                        type="range" min={3} max={15} value={questionCount}
                                        onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                        className="w-full accent-red-500"
                                    />
                                    <div className="flex justify-between text-xs text-silver mt-1">
                                        <span>3 (Quick)</span><span>15 (Full)</span>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Choose Your Interviewer</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {PERSONA_OPTIONS.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedPersona(p.id)}
                                                className={`p-3 rounded-xl border text-left transition-all flex flex-col group ${
                                                    selectedPersona === p.id
                                                        ? p.activeClass
                                                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--text-secondary)] hover:shadow-md'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner ${p.colorClass}`}>
                                                        <span className="material-symbols-rounded text-[20px] text-inherit">{p.icon}</span>
                                                    </div>
                                                    <span className={`text-xs font-bold text-[var(--text-primary)]`}>{p.label}</span>
                                                </div>
                                                <p className={`text-[10.5px] leading-snug text-[var(--text-muted)]`}>{p.subtitle}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Voice Mode Toggle */}
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Voice Mode</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setVoiceEnabled(!voiceEnabled); if (liveMode) setLiveMode(false); }}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${voiceEnabled && !liveMode ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]'}`}
                                        >
                                            <span className="material-symbols-rounded">{voiceEnabled && !liveMode ? 'mic' : 'mic_off'}</span>
                                            Voice
                                        </button>
                                        <button
                                            onClick={() => { setLiveMode(!liveMode); if (!liveMode) setVoiceEnabled(true); }}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${liveMode ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]'}`}
                                        >
                                            <span className="material-symbols-rounded">stream</span>
                                            Live ✨
                                        </button>
                                    </div>
                                    {liveMode && (
                                        <p className="text-[10px] text-emerald-500 text-center mt-1">Real-time conversation with Gemini — no delay</p>
                                    )}
                                    {voiceEnabled && !liveMode && (
                                        <p className="text-[10px] text-[var(--text-muted)] text-center mt-1">Voice matches your interviewer persona</p>
                                    )}
                                </div>
                            </div>

                            {/* Launch Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    if (interviewType === 'study-cards') {
                                        generateFlashcards();
                                    } else if (liveMode) {
                                        // Generate visible questions AND start live voice in parallel
                                        startGauntlet();
                                        geminiLive.connect({
                                            persona: selectedPersona,
                                            jobDescription,
                                            interviewStyle,
                                        });
                                    } else {
                                        startGauntlet();
                                    }
                                }}
                                disabled={isGenerating || geminiLive.isConnecting}
                                className={`w-full mt-6 py-3.5 rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${interviewType === 'study-cards' ? 'bg-indigo-500/10 border border-indigo-500/30 text-[var(--text-primary)] hover:border-indigo-500/50 shadow-indigo-500/10' : 'bg-cyan-500/10 border border-cyan-500/30 text-[var(--text-primary)] hover:border-cyan-500/50 shadow-cyan-500/10'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full" />
                                        {interviewType === 'study-cards' ? 'Generating Cards...' : 'Spinning Up Simulator...'}
                                    </>
                                ) : liveMode ? (
                                    <><span className="material-symbols-rounded text-[20px] text-emerald-500">stream</span> Start Live Interview ✨</>
                                ) : (
                                    <>{interviewType === 'study-cards' ? <><span className="material-symbols-rounded text-[20px] text-indigo-500">style</span> Generate Study Cards</> : <><span className="material-symbols-rounded text-[20px] text-cyan-500">play_arrow</span> Start Simulator</>}</>
                                )}
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* LIVE VOICE STATUS BAR — sits above questions */}
                {/* ============================================ */}
                {viewMode === 'gauntlet' && liveMode && (geminiLive.isConnected || geminiLive.isConnecting || geminiLive.error) && (
                    <motion.div key="live-status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto mb-4">
                        {geminiLive.isConnecting && (
                            <div className="rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-3">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                                <span className="text-xs font-medium text-emerald-400">Connecting live voice...</span>
                            </div>
                        )}

                        {geminiLive.error && !geminiLive.isConnecting && (
                            <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                                <span className="text-xs text-red-400 flex items-center gap-2">
                                    <span className="material-symbols-rounded text-[14px]">error</span>
                                    Voice: {geminiLive.error}
                                </span>
                                <button onClick={() => geminiLive.connect({ persona: selectedPersona, jobDescription, interviewStyle })} className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors">Retry</button>
                            </div>
                        )}

                        {geminiLive.isConnected && (
                            <div className="rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                                    <span className="text-xs font-bold text-emerald-400">Live Voice Active</span>
                                    {/* Mini visualizer */}
                                    <div className="flex items-center gap-0.5 h-4">
                                        {Array.from({ length: 8 }).map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    height: geminiLive.isSpeaking ? [3, Math.random() * 14 + 3, 3] : geminiLive.isListening ? [2, Math.random() * 8 + 2, 2] : 2,
                                                }}
                                                transition={{ duration: geminiLive.isSpeaking ? 0.3 : 0.6, repeat: Infinity, delay: i * 0.06 }}
                                                className={`w-1 rounded-full ${geminiLive.isSpeaking ? 'bg-emerald-400' : geminiLive.isListening ? 'bg-amber-400' : 'bg-white/20'}`}
                                            />
                                        ))}
                                    </div>
                                    {geminiLive.isSpeaking && <span className="text-[10px] text-cyan-400">Speaking...</span>}
                                    {geminiLive.isListening && !geminiLive.isSpeaking && <span className="text-[10px] text-amber-400">Listening...</span>}
                                </div>
                                <button onClick={() => {
                                    // Save transcript to debrief before disconnecting
                                    if (geminiLive.aiTranscript || geminiLive.userTranscript) {
                                        authFetch('/api/agent/debriefs', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                company: 'AI Mock Interview',
                                                role: jobDescription ? jobDescription.substring(0, 80) : 'Practice Session',
                                                roundType: interviewStyle || 'behavioral',
                                                date: new Date().toISOString().split('T')[0],
                                                questions: questions.slice(0, currentIndex + 1).map((q, i) => ({
                                                    text: q.text,
                                                    confidence: results[i]?.grading?.overall_score || 50,
                                                    category: q.type || 'Behavioral',
                                                })),
                                                overallFeeling: 3,
                                                strengths: `Live voice session with ${selectedPersona || 'AI'} interviewer`,
                                                weaknesses: '',
                                                surprises: '',
                                                wouldChange: '',
                                                interviewerVibe: 'neutral',
                                                followUpSent: false,
                                                outcome: 'pending',
                                                liveTranscript: {
                                                    ai: geminiLive.aiTranscript,
                                                    user: geminiLive.userTranscript,
                                                },
                                            }),
                                        }).catch(console.error);
                                        showToast('Live session saved to Debrief Journal', 'rate_review');
                                    }
                                    geminiLive.disconnect();
                                }} className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors">End Voice</button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* GAUNTLET VIEW — Answer Questions */}
                {/* ============================================ */}
                {viewMode === 'gauntlet' && questions.length > 0 && (
                    <motion.div key="gauntlet" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-4xl mx-auto">
                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between text-sm text-silver mb-2">
                                <span>Question {currentIndex + 1} of {questions.length}</span>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-white">{formatTime(elapsed)}</span>
                                    {results.length > 0 && (
                                        <span className="px-2 py-1 rounded-lg bg-white/5 text-xs">
                                            Avg: {Math.round(results.reduce((s, r) => s + r.grading.overall_score, 0) / results.length)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                                    className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                                />
                            </div>
                        </div>

                        {/* Question Card */}
                        <motion.div
                            key={questions[currentIndex].id}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-2xl glass-card overflow-hidden mb-6"
                        >
                            {/* Question Type Badge */}
                            <div className={`px-6 py-3 bg-gradient-to-r ${QUESTION_TYPE_CONFIG[questions[currentIndex].type]?.color || 'from-white/5 to-white/5'} border-b border-white/10 flex items-center justify-between`}>
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/20 shadow-lg backdrop-blur-md">
                                        <span>{QUESTION_TYPE_CONFIG[questions[currentIndex].type]?.icon || <span className="material-symbols-rounded text-[14px]">help</span>}</span>
                                        {QUESTION_TYPE_CONFIG[questions[currentIndex].type]?.label || questions[currentIndex].type}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-lg backdrop-blur-md ${questions[currentIndex].difficulty === 'killer' ? 'bg-red-500/20 text-red-400 border-red-500/20' : questions[currentIndex].difficulty === 'advanced' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-white/10 text-silver border-white/10'}`}>
                                        {questions[currentIndex].difficulty}
                                    </span>
                                </div>
                            </div>

                            {/* Question Text */}
                            <div className="p-8">
                                <p className="text-xl text-white leading-relaxed font-medium">
                                    {questions[currentIndex].text}
                                </p>
                                <div className="mt-4 flex items-center justify-between">
                                    <p className="text-xs text-silver/60 italic">
                                        <span className="material-symbols-rounded align-middle mr-1">chat</span> {questions[currentIndex].context}
                                    </p>
                                    {voiceEnabled && (
                                        <button
                                            onClick={() => speakQuestion(questions[currentIndex].text)}
                                            disabled={isSpeakingQuestion || isPlaying}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${isSpeakingQuestion || isPlaying ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 animate-pulse' : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'}`}
                                        >
                                            {isSpeakingQuestion || isPlaying ? <><span className="material-symbols-rounded text-[14px] align-middle">volume_up</span> Speaking...</> : <><span className="material-symbols-rounded text-[14px] align-middle">volume_up</span> Listen</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>

                        {/* Answer Area */}
                        <div className="rounded-2xl glass-card p-6">
                            <label className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-white">Your Answer</span>
                                <span className="text-xs text-silver">{userAnswer.length} characters</span>
                            </label>
                            <textarea
                                ref={answerRef}
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder="Type your answer as if you were speaking to the interviewer. Use the STAR method for behavioral questions: Situation → Task → Action → Result..."
                                rows={8}
                                className="w-full p-4 rounded-xl bg-[#111] border border-white/10 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 text-white placeholder-silver/40 resize-none transition-all text-base leading-relaxed"
                                autoFocus
                            />

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-3">
                                    <p className="text-xs text-silver">
                                        <span className="material-symbols-rounded align-middle mr-1">lightbulb</span> Tip: Be specific. Use numbers, metrics, and concrete outcomes.
                                    </p>
                                    {voiceEnabled && (
                                        <button
                                            onClick={handleVoiceAnswer}
                                            disabled={isTranscribing}
                                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${isRecording ? 'bg-red-500/30 border border-red-500/50 text-red-400 animate-pulse' : isTranscribing ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400' : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'}`}
                                        >
                                            {isRecording ? <><span className="material-symbols-rounded align-middle mr-1">stop</span> Stop Recording</> : isTranscribing ? <><span className="material-symbols-rounded align-middle mr-1">history</span> Transcribing...</> : <><span className="material-symbols-rounded text-[14px] align-middle">mic</span> Speak Answer</>}
                                        </button>
                                    )}
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={submitAnswer}
                                    disabled={isGrading || !userAnswer.trim()}
                                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isGrading ? (
                                        <>
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                            Grading...
                                        </>
                                    ) : (
                                        <>Submit Answer →</>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* FLASHCARD VIEW */}
                {/* ============================================ */}
                {viewMode === 'flashcards' && flashcards.length > 0 && (
                    <motion.div key="flashcards" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto">
                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between text-sm text-silver mb-2">
                                <span>Card {flashcardIndex + 1} of {flashcards.length}</span>
                                <span className="text-xs">
                                    <span className="material-symbols-rounded align-middle mr-1">check_circle</span> {Object.values(flashcardRatings).filter(r => r === 'got-it').length} Got It &nbsp;•&nbsp;
                                    <span className="material-symbols-rounded align-middle mr-1">edit_document</span> {Object.values(flashcardRatings).filter(r => r === 'needs-work').length} Needs Work
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${((flashcardIndex + 1) / flashcards.length) * 100}%` }} className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                            </div>
                        </div>

                        {/* Flashcard */}
                        <motion.div
                            key={flashcardIndex}
                            initial={{ opacity: 0, rotateY: -90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            transition={{ duration: 0.4 }}
                            onClick={() => setIsFlipped(!isFlipped)}
                            className="cursor-pointer"
                        >
                            <div className={`min-h-[320px] rounded-3xl border overflow-hidden transition-all duration-300 ${isFlipped ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-500/30' : 'bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/30'}`}>
                                <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${flashcards[flashcardIndex].category === 'technical' ? 'bg-emerald-500/20 text-emerald-400' : flashcards[flashcardIndex].category === 'behavioral' ? 'bg-blue-500/20 text-blue-400' : flashcards[flashcardIndex].category === 'domain' ? 'bg-amber-500/20 text-amber-400' : 'bg-pink-500/20 text-pink-400'}`}>
                                            {flashcards[flashcardIndex].category}
                                        </span>
                                        <span className="text-xs text-silver">{flashcards[flashcardIndex].difficulty}</span>
                                    </div>
                                    <span className="text-xs text-silver">Click to {isFlipped ? 'see question' : 'reveal answer'}</span>
                                </div>
                                <div className="p-10 flex items-center justify-center min-h-[260px]">
                                    <AnimatePresence mode="wait">
                                        <motion.div key={isFlipped ? 'answer' : 'question'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                            {!isFlipped ? (
                                                <div className="text-center">
                                                    <span className="text-4xl mb-4 block"><span className="material-symbols-rounded text-inherit align-middle">help</span></span>
                                                    <p className="text-xl text-white font-medium leading-relaxed">
                                                        {flashcards[flashcardIndex].question}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <span className="text-4xl mb-4 block"><span className="material-symbols-rounded text-inherit align-middle">check_circle</span></span>
                                                    <p className="text-lg text-emerald-200 leading-relaxed">
                                                        {flashcards[flashcardIndex].answer}
                                                    </p>
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>

                        {/* Rating & Navigation */}
                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setFlashcardRatings(prev => ({ ...prev, [flashcardIndex]: 'needs-work' })); if (flashcardIndex < flashcards.length - 1) { setFlashcardIndex(i => i + 1); setIsFlipped(false); } }}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${flashcardRatings[flashcardIndex] === 'needs-work' ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400' : 'bg-white/5 border border-white/10 text-silver hover:text-white'}`}
                                >
                                    <span className="material-symbols-rounded align-middle mr-1">edit_document</span> Needs Work
                                </button>
                                <button
                                    onClick={() => { setFlashcardRatings(prev => ({ ...prev, [flashcardIndex]: 'got-it' })); if (flashcardIndex < flashcards.length - 1) { setFlashcardIndex(i => i + 1); setIsFlipped(false); } }}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${flashcardRatings[flashcardIndex] === 'got-it' ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : 'bg-white/5 border border-white/10 text-silver hover:text-white'}`}
                                >
                                    <span className="material-symbols-rounded align-middle mr-1">check_circle</span> Got It
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setFlashcardIndex(i => Math.max(0, i - 1)); setIsFlipped(false); }}
                                    disabled={flashcardIndex === 0}
                                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-silver text-sm hover:text-white transition-all disabled:opacity-30"
                                >
                                    ← Prev
                                </button>
                                {flashcardIndex < flashcards.length - 1 ? (
                                    <button
                                        onClick={() => { setFlashcardIndex(i => i + 1); setIsFlipped(false); }}
                                        className="px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-all"
                                    >
                                        Next →
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { setViewMode('setup'); setFlashcards([]); }}
                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium transition-all"
                                    >
                                        <span className="material-symbols-rounded align-middle mr-1">check_circle</span> Done
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* SCORECARD VIEW — Grading Results */}
                {/* ============================================ */}
                {viewMode === 'scorecard' && currentGrading && (
                    <motion.div key="scorecard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto space-y-6">
                        {/* Score Header */}
                        <div className={`rounded-2xl bg-gradient-to-r ${getScoreBg(currentGrading.overall_score)} border p-8 flex items-center gap-8`}>
                            <div className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                    className={`text-6xl font-black ${getScoreColor(currentGrading.overall_score)}`}
                                >
                                    {currentGrading.overall_score}
                                </motion.div>
                                <p className="text-sm text-silver mt-1">{getScoreLabel(currentGrading.overall_score)}</p>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-2">Question {currentIndex + 1} Result</h3>
                                <p className="text-sm text-silver line-clamp-2">{questions[currentIndex].text}</p>
                            </div>
                        </div>

                        {/* STAR Method Breakdown */}
                        <div className="rounded-2xl glass-card p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">star</span> STAR Method Analysis</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {(['situation', 'task', 'action', 'result'] as const).map((key) => {
                                    const item = currentGrading.star_method[key];
                                    return (
                                        <motion.div
                                            key={key}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`p-4 rounded-xl border ${item.present ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-white capitalize flex items-center gap-2">
                                                        {key}
                                                        {item.present ? 
                                                            <span className="material-symbols-rounded text-green-400 text-sm">check_circle</span> : 
                                                            <span className="material-symbols-rounded text-red-400 text-sm">cancel</span>
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-silver">{item.feedback}</p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Strengths & Improvements */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="rounded-2xl glass-card p-6">
                                <h3 className="text-base font-bold text-emerald-400 mb-3 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">fitness_center</span> Strengths</h3>
                                <ul className="space-y-2">
                                    {currentGrading.strengths.map((s, i) => (
                                        <li key={i} className="text-sm text-silver flex items-start gap-2">
                                            <span className="text-emerald-400 mt-0.5">•</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-2xl glass-card p-6">
                                <h3 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">trending_up</span> Improvements</h3>
                                <ul className="space-y-2">
                                    {currentGrading.improvements.map((s, i) => (
                                        <li key={i} className="text-sm text-silver flex items-start gap-2">
                                            <span className="text-amber-400 mt-0.5">•</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Filler Analysis */}
                        {currentGrading.filler_analysis?.weak_phrases?.length > 0 && (
                            <div className="rounded-2xl glass-card p-6">
                                <h3 className="text-base font-bold text-rose-400 mb-3 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">block</span> Weak Phrases Detected</h3>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {currentGrading.filler_analysis.weak_phrases.map((w, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                                            "{w}"
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-silver">{currentGrading.filler_analysis.feedback}</p>
                            </div>
                        )}

                        {/* Coaching Tip */}
                        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6">
                            <h3 className="text-base font-bold text-amber-400 mb-2 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">my_location</span> Coaching Tip</h3>
                            <p className="text-silver">{currentGrading.coaching_tip}</p>
                        </div>

                        {/* Model Answer */}
                        <div className="rounded-2xl glass-card p-6">
                            <h3 className="text-base font-bold text-cyan-400 mb-3 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">auto_awesome</span> Model Answer</h3>
                            <p className="text-silver leading-relaxed italic">&quot;{currentGrading.rewritten_answer}&quot;</p>
                        </div>

                        {/* Follow-Up Question */}
                        <div className="rounded-2xl glass-card p-6">
                            <h3 className="text-base font-bold text-violet-400 mb-2 flex items-center gap-2"><span className="material-symbols-rounded text-inherit align-middle">sync</span> Follow-Up Question</h3>
                            <p className="text-white font-medium">&quot;{currentGrading.follow_up_question}&quot;</p>
                            <p className="text-xs text-silver mt-2">A real interviewer would ask this next. Practice your answer mentally.</p>
                        </div>

                        {/* Next Button */}
                        <div className="flex justify-end">
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={nextQuestion}
                                className="px-8 py-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-red-500/25 transition-all flex items-center gap-2"
                            >
                                {currentIndex < questions.length - 1 ? (
                                    <>Next Question →</>
                                ) : (
                                    <>View Debrief →</>
                                )}
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ============================================ */}
                {/* DEBRIEF VIEW — Session Summary */}
                {/* ============================================ */}
                {viewMode === 'debrief' && results.length > 0 && (
                    <motion.div key="debrief" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto space-y-6">
                        {/* Summary Stats */}
                        <div className="rounded-3xl glass-card p-8 relative overflow-hidden">
                            <div className="absolute inset-0 overflow-hidden">
                                {[...Array(12)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ y: '100%', x: `${Math.random() * 100}%`, opacity: 1 }}
                                        animate={{ y: '-100%', opacity: [1, 1, 0], rotate: Math.random() * 360 }}
                                        transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity }}
                                        className="absolute text-lg"
                                    >
                                        <span className="material-symbols-rounded text-6xl">emoji_events</span>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="relative text-center mb-8">
                                <h2 className="text-3xl font-bold text-white mb-2">Gauntlet Complete</h2>
                                <p className="text-silver">Here&apos;s how you performed across {results.length} questions</p>
                            </div>

                            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    {
                                        label: 'Avg Score',
                                        value: Math.round(results.reduce((s, r) => s + r.grading.overall_score, 0) / results.length),
                                        suffix: '',
                                        color: getScoreColor(Math.round(results.reduce((s, r) => s + r.grading.overall_score, 0) / results.length)),
                                    },
                                    {
                                        label: 'Best Score',
                                        value: Math.max(...results.map(r => r.grading.overall_score)),
                                        suffix: '',
                                        color: 'text-emerald-400',
                                    },
                                    {
                                        label: 'Questions',
                                        value: results.length,
                                        suffix: '',
                                        color: 'text-white',
                                    },
                                    {
                                        label: 'Total Time',
                                        value: formatTime(Math.floor((Date.now() - sessionStartTime) / 1000)),
                                        suffix: '',
                                        color: 'text-cyan-400',
                                        isString: true,
                                    },
                                ].map((stat, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center"
                                    >
                                        <div className={`text-3xl font-black ${stat.color}`}>
                                            {stat.isString ? stat.value : stat.value}{stat.suffix}
                                        </div>
                                        <div className="text-silver text-sm mt-1">{stat.label}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Per-Question Breakdown */}
                        <div className="rounded-2xl glass-card p-6">
                            <h3 className="text-lg font-bold text-white mb-4"><span className="material-symbols-rounded text-inherit align-middle">content_paste</span> Question Breakdown</h3>
                            <div className="space-y-3">
                                {results.map((r, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5"
                                    >
                                        <div className={`text-2xl font-black w-12 text-center ${getScoreColor(r.grading.overall_score)}`}>
                                            {r.grading.overall_score}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs">{QUESTION_TYPE_CONFIG[r.question.type]?.icon}</span>
                                                <span className="text-xs text-silver">{QUESTION_TYPE_CONFIG[r.question.type]?.label}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${r.question.difficulty === 'killer' ? 'bg-red-500/20 text-red-400' : r.question.difficulty === 'advanced' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-silver'}`}>
                                                    {r.question.difficulty}
                                                </span>
                                            </div>
                                            <p className="text-sm text-white truncate">{r.question.text}</p>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-silver">
                                            <span className="font-mono">{formatTime(r.timeSpent)}</span>
                                            <div className="flex gap-1">
                                                {(['situation', 'task', 'action', 'result'] as const).map((k) => (
                                                    <span key={k} className={`w-2 h-2 rounded-full ${r.grading.star_method[k].present ? 'bg-emerald-400' : 'bg-red-400/40'}`} title={`${k}: ${r.grading.star_method[k].present ? 'Present' : 'Missing'}`} />
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Weak Areas */}
                        {(() => {
                            const weakResults = results.filter(r => r.grading.overall_score < 60);
                            if (weakResults.length === 0) return null;
                            return (
                                <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6">
                                    <h3 className="text-lg font-bold text-red-400 mb-3"><span className="material-symbols-rounded text-inherit align-middle">warning</span> Areas Needing Work</h3>
                                    <div className="space-y-3">
                                        {weakResults.map((r, i) => (
                                            <div key={i} className="p-3 rounded-xl bg-red-500/5 text-sm">
                                                <p className="text-white font-medium mb-1">Q{results.indexOf(r) + 1}: {r.question.text.substring(0, 80)}...</p>
                                                <p className="text-silver text-xs">{r.grading.coaching_tip}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Action Buttons */}
                        <div className="grid md:grid-cols-3 gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setViewMode('setup');
                                    setQuestions([]);
                                    setResults([]);
                                    setCurrentGrading(null);
                                    setUserAnswer('');
                                }}
                                className="p-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 text-left transition-all"
                            >
                                <span className="text-3xl mb-2 block"><span className="material-symbols-rounded text-inherit align-middle">sync</span></span>
                                <h4 className="text-lg font-bold text-white">New Session</h4>
                                <p className="text-silver text-sm">Start a fresh gauntlet with different questions</p>
                            </motion.button>

                            {results.some(r => r.grading.overall_score < 60) && (
                                <motion.button
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        const weakQuestions = results.filter(r => r.grading.overall_score < 60).map(r => r.question);
                                        setQuestions(weakQuestions);
                                        setCurrentIndex(0);
                                        setResults([]);
                                        setCurrentGrading(null);
                                        setUserAnswer('');
                                        setSessionStartTime(Date.now());
                                        setQuestionStartTime(Date.now());
                                        setElapsed(0);
                                        setViewMode('gauntlet');
                                        showToast(`Retrying ${weakQuestions.length} weak questions`, 'swords');
                                    }}
                                    className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 text-left transition-all"
                                >
                                    <span className="text-3xl mb-2 block"><span className="material-symbols-rounded text-inherit align-middle">my_location</span></span>
                                    <h4 className="text-lg font-bold text-white">Retry Weak Areas</h4>
                                    <p className="text-silver text-sm">Redo questions you scored &lt;60 on</p>
                                </motion.button>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setCurrentIndex(0);
                                    setResults([]);
                                    setCurrentGrading(null);
                                    setUserAnswer('');
                                    setSessionStartTime(Date.now());
                                    setQuestionStartTime(Date.now());
                                    setElapsed(0);
                                    setViewMode('gauntlet');
                                    showToast('Same questions, fresh start', 'sync');
                                }}
                                className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-left transition-all"
                            >
                                <span className="text-3xl mb-2 block"><span className="material-symbols-rounded text-[32px] align-middle">replay</span></span>
                                <h4 className="text-lg font-bold text-white">Redo Same Questions</h4>
                                <p className="text-silver text-sm">Practice the exact same questions again</p>
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleGenerateVaultNotes('interview')}
                                disabled={isGeneratingNotes}
                                className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-left transition-all disabled:opacity-50"
                            >
                                <span className="text-3xl mb-2 block"><span className="material-symbols-rounded text-inherit align-middle">library_books</span></span>
                                <h4 className="text-lg font-bold text-white">{isGeneratingNotes ? 'Saving...' : 'Save Study Notes'}</h4>
                                <p className="text-silver text-sm">Save a summarized study guide of your mistakes</p>
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {renderAuthModal()}
        </div>
    );
}
