'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { groqCompletion, groqJSONCompletion } from '@/lib/ai/groq-client';
import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker for v4.x
if (typeof window !== 'undefined') {
  // For pdfjs-dist v4.x, use the legacy build worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

// Persona definitions
const PERSONAS = [
  {
    id: 'ceo',
    name: 'The Visionary CEO',
    icon: '👔',
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'purple',
    description: 'Culture, strategy, leadership vision',
    focus: 'long-term strategy, cultural fit, leadership potential, and soft skills',
    style: 'thoughtful, strategic, occasionally philosophical',
  },
  {
    id: 'tech-lead',
    name: 'The Skeptical Tech Lead',
    icon: '🔬',
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'cyan',
    description: 'Deep technical, architecture, edge cases',
    focus: 'technical depth, system design, edge cases, and "Why X over Y?" decisions',
    style: 'direct, challenging, technically rigorous, sometimes interrupts',
  },
  {
    id: 'recruiter',
    name: 'The Gritty Recruiter',
    icon: '📋',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'green',
    description: 'Logistics, salary, immediate impact',
    focus: 'immediate value, compensation expectations, availability, and cultural logistics',
    style: 'pragmatic, fast-paced, focused on specifics and timelines',
  },
];

// ElevenLabs Voice Configuration (maps persona to voice)
const PERSONA_VOICES = {
  ceo: { id: 'jqcCZkN6Knx8BJ5TBdYR', name: 'Sona' }, // Female: empathetic for CEO
  'tech-lead': { id: 'DMyrgzQFny3JI1Y1paM5', name: 'Orion' }, // Male: direct for tech
  recruiter: { id: 'jqcCZkN6Knx8BJ5TBdYR', name: 'Sona' }, // Female: practical for recruiter
};

// Difficulty levels
const DIFFICULTY_LEVELS = {
  coaching: { name: 'Coaching', color: 'green', description: 'Supportive and educational' },
  standard: { name: 'Standard', color: 'blue', description: 'Professional interview' },
  'high-stress': { name: 'High-Stress', color: 'red', description: 'Challenging and intense' },
};

// Message type
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  feedback?: {
    score: number;
    refinement: string;
    trap: string;
  };
  persona?: string;
  timestamp: Date;
}

// Tips type
interface Tip {
  title: string;
  content: string;
  category: 'behavioral' | 'technical' | 'negotiation' | 'general';
}

export default function ShadowInterviewPage() {
  const { user } = useStore();
  const [step, setStep] = useState<'setup' | 'modality' | 'interview' | 'summary'>('setup');

  // Setup state
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[1]); // Tech Lead default
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modality Selection State
  const [modality, setModality] = useState<'text' | 'voice' | null>(null);
  const [voiceProfile, setVoiceProfile] = useState<'male' | 'female' | null>(null);

  // Interview state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'coaching' | 'standard' | 'high-stress'>('standard');
  const [questionCount, setQuestionCount] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [sphereState, setSphereState] = useState<'idle' | 'listening' | 'thinking' | 'stress'>('idle');

  // Tips state
  const [showTips, setShowTips] = useState(false);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loadingTips, setLoadingTips] = useState(false);

  // Voice input state (Deepgram-based)
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, startRecording, stopRecording, getVisualizerData } = useAudioRecorder();

  // Voice output state (TTS)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { playAudio, stopAudio, isPlaying } = useAudioPlayer();

  // Request microphone permission
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      // getUserMedia will block until the user responds to the permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Permission was granted - update state first
      setMicPermission('granted');
      showToast('Microphone access granted!', '✅');

      // Keep the stream briefly to prevent permission dialog issues, then stop
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 500);

      return true;
    } catch (error: any) {
      console.error('Mic permission error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermission('denied');
        showToast('Microphone access denied. Please enable in browser settings.', '❌');
      } else {
        showToast('Could not access microphone', '❌');
      }
      return false;
    }
  };

  // Check microphone permission on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        setMicPermission(result.state as 'prompt' | 'granted' | 'denied');
        result.onchange = () => {
          setMicPermission(result.state as 'prompt' | 'granted' | 'denied');
        };
      }).catch(() => {
        // Permissions API not supported
      });
    }
  }, []);

  // Helper: Speak AI response using ElevenLabs
  const speakResponse = async (text: string, forceSpeak: boolean = false) => {
    // Use forceSpeak to bypass voiceOutputEnabled check during initial message
    if (!voiceOutputEnabled && !forceSpeak) {
      console.log('TTS skipped: voiceOutputEnabled=', voiceOutputEnabled, 'forceSpeak=', forceSpeak);
      return;
    }

    // Use user-selected voice profile
    const voiceId = voiceProfile === 'male'
      ? 'DMyrgzQFny3JI1Y1paM5' // Orion
      : 'jqcCZkN6Knx8BJ5TBdYR'; // Sona (default)

    console.log('TTS: Speaking with voice', voiceId);

    try {
      setIsSpeaking(true);
      setSphereState('thinking');

      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('TTS API error:', res.status, errorText);
        throw new Error('TTS failed');
      }

      const audioBlob = await res.blob();
      console.log('TTS: Received audio blob, size:', audioBlob.size);

      await playAudio(audioBlob, () => {
        setIsSpeaking(false);
        setSphereState('idle');
      });
    } catch (error) {
      console.error('Speech error:', error);
      showToast('Voice output failed', '❌');
      setIsSpeaking(false);
      setSphereState('idle');
    }
  };

  // Transcribe audio using Deepgram
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    setIsTranscribing(true);
    console.log('STT: Transcribing audio, size:', audioBlob.size, 'type:', audioBlob.type);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('STT API error:', res.status, errorText);
        throw new Error('Transcription failed');
      }

      const data = await res.json();
      console.log('STT: Transcription result:', data);
      return data.text || '';
    } catch (error) {
      console.error('Transcription error:', error);
      showToast('Transcription failed', '❌');
      return '';
    } finally {
      setIsTranscribing(false);
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // File processing
  const processFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isWord = fileType.includes('wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc');
    const isText = fileType === 'text/plain' || fileName.endsWith('.txt');

    if (!isPDF && !isWord && !isText) {
      showToast('Upload PDF, Word, or TXT', '❌');
      return;
    }

    showToast('Processing file...', '⏳');

    try {
      let text = '';
      if (isPDF) {
        console.log('Processing PDF:', fileName, 'Type:', fileType);
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        console.log('PDF loaded, pages:', pdf.numPages);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        console.log('PDF text extracted, length:', text.length);
      } else if (isWord) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }

      if (text.trim()) {
        setResumeText(text.trim());
        showToast('Resume loaded!', '✅');
      } else {
        showToast('No text found in file', '⚠️');
      }
    } catch (error: any) {
      console.error('File processing error:', error);
      showToast(`Error: ${error.message || 'Failed to process file'}`, '❌');
    }
  };

  // Generate system prompt for persona
  const getSystemPrompt = useCallback(() => {
    return `You are the "Polymath Shadow," an elite interview simulator for Hirely.ai. You are currently playing the role of: ${selectedPersona.name}.

YOUR PERSONA:
- Name: ${selectedPersona.name}
- Icon: ${selectedPersona.icon}
- Focus Areas: ${selectedPersona.focus}
- Communication Style: ${selectedPersona.style}

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}

CURRENT DIFFICULTY: ${difficulty.toUpperCase()}
- Coaching: Be supportive, provide hints, build confidence
- Standard: Professional interview, balanced challenge
- High-Stress: Push back, interrupt occasionally, test composure

SIMULATION RULES:
1. NEVER ask generic questions. Use specific details from the resume (projects, experiences, skills).
2. Stay in character as ${selectedPersona.name} throughout.
3. ${difficulty === 'high-stress' ? 'Occasionally push back or express skepticism to test composure.' : ''}
4. After each user response, you MUST provide feedback in this EXACT JSON format at the end of your message:

<feedback>
{
  "score": [1-10 hireability score],
  "refinement": "[A better way to phrase their answer]",
  "trap": "[What the interviewer was really looking for behind the question]"
}
</feedback>

5. Then ask your next question naturally.
6. Adapt difficulty based on performance - if they score above 7 twice, increase challenge. Below 5 twice, offer more support.

START by acknowledging the candidate's background briefly, then ask your FIRST contextual question based on their resume and the job requirements.`;
  }, [selectedPersona, resumeText, jdText, difficulty]);

  // Start interview - accepts voiceMode to avoid async state issues
  const startInterview = async (enableVoice: boolean = false) => {
    if (!resumeText.trim() || !jdText.trim()) {
      showToast('Please provide both resume and JD', '❌');
      return;
    }

    // Set voice state synchronously via parameter
    setVoiceOutputEnabled(enableVoice);
    console.log('Starting interview, voice mode:', enableVoice);

    setStep('interview');
    setIsThinking(true);
    setSphereState('thinking');

    try {
      const response = await groqCompletion(
        getSystemPrompt(),
        'Begin the interview. Acknowledge the candidate briefly and ask your first question.',
        { temperature: 0.7, maxTokens: 1000 }
      );

      const { message, feedback } = parseResponse(response);

      setMessages([{
        role: 'assistant',
        content: message,
        feedback,
        persona: selectedPersona.id,
        timestamp: new Date(),
      }]);
      setQuestionCount(1);

      // Speak the AI's first message using direct parameter (not state)
      if (enableVoice) {
        console.log('Voice mode enabled, speaking first message');
        // Use forceSpeak=true to bypass state check
        speakResponse(message, true);
      }
    } catch (error) {
      console.error('Interview start error:', error);
      showToast('Error starting interview', '❌');
      setStep('setup');
    } finally {
      setIsThinking(false);
      setSphereState('idle');
    }
  };

  // Parse AI response to extract feedback
  const parseResponse = (response: string): { message: string; feedback?: Message['feedback'] } => {
    const feedbackMatch = response.match(/<feedback>([\s\S]*?)<\/feedback>/);
    let message = response.replace(/<feedback>[\s\S]*?<\/feedback>/, '').trim();
    let feedback: Message['feedback'] | undefined;

    if (feedbackMatch) {
      try {
        const parsed = JSON.parse(feedbackMatch[1]);
        feedback = {
          score: parsed.score || 5,
          refinement: parsed.refinement || '',
          trap: parsed.trap || '',
        };
      } catch (e) {
        // Couldn't parse feedback
      }
    }

    return { message, feedback };
  };

  // Send user response
  const sendResponse = async () => {
    if (!currentInput.trim() || isThinking) return;

    // Check for /tips command
    if (currentInput.trim().toLowerCase() === '/tips') {
      setCurrentInput('');
      generateTips();
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsThinking(true);
    setSphereState(difficulty === 'high-stress' ? 'stress' : 'thinking');

    try {
      // Build conversation history
      const history = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await groqCompletion(
        getSystemPrompt(),
        [...history, { role: 'user' as const, content: currentInput }]
          .map(m => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n\n') + '\n\nProvide feedback on the user\'s response and ask your next question.',
        { temperature: 0.7, maxTokens: 1000 }
      );

      const { message, feedback } = parseResponse(response);

      // Update total score if feedback exists
      if (feedback) {
        setTotalScore(prev => prev + feedback.score);
        setQuestionCount(prev => prev + 1);

        // Adjust difficulty based on performance
        if (feedback.score >= 8 && difficulty !== 'high-stress') {
          setDifficulty('high-stress');
          showToast('Difficulty increased! 🔥', '⚡');
        } else if (feedback.score <= 4 && difficulty !== 'coaching') {
          setDifficulty('coaching');
          showToast('Switching to coaching mode 💪', '🎯');
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: message,
        feedback,
        persona: selectedPersona.id,
        timestamp: new Date(),
      }]);

      // Speak the AI's response
      if (voiceOutputEnabled) {
        speakResponse(message);
      }
    } catch (error) {
      showToast('Error processing response', '❌');
    } finally {
      setIsThinking(false);
      setSphereState('idle');
    }
  };

  // Generate tips
  const generateTips = async () => {
    setShowTips(true);
    setLoadingTips(true);

    try {
      const response = await groqJSONCompletion<{ tips: Tip[] }>(
        `You are an expert career coach. Generate 10 highly specific "Unfair Advantage" interview tips based on this resume and job description.`,
        `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jdText}\n\nGenerate tips in JSON format:
{
  "tips": [
    {
      "title": "Short title",
      "content": "Detailed actionable tip",
      "category": "behavioral|technical|negotiation|general"
    }
  ]
}

Make tips SPECIFIC to this candidate's background - reference their actual projects, skills, and experiences.`,
        { temperature: 0.2, maxTokens: 2000 }
      );

      setTips(response.tips || []);
    } catch (error) {
      showToast('Error generating tips', '❌');
    } finally {
      setLoadingTips(false);
    }
  };

  // Toggle voice input (Deepgram-based)
  const toggleVoice = async () => {
    if (isRecording) {
      // Stop recording and transcribe
      setSphereState('thinking');
      showToast('Processing...', '⏳');

      try {
        const audioBlob = await stopRecording();
        console.log('Recording stopped, blob:', audioBlob?.size, audioBlob?.type);

        if (audioBlob && audioBlob.size > 0) {
          const transcript = await transcribeAudio(audioBlob);
          if (transcript) {
            setCurrentInput(prev => prev + (prev ? ' ' : '') + transcript);
            showToast('Transcribed!', '✅');
          } else {
            showToast('No speech detected', '⚠️');
          }
        } else {
          showToast('No audio recorded', '⚠️');
        }
      } catch (error) {
        console.error('Recording/transcription error:', error);
        showToast('Recording failed', '❌');
      }

      setSphereState('idle');
    } else {
      // Start recording
      try {
        await startRecording();
        setSphereState('listening');
        showToast('Listening... Click again to stop', '🎤');
      } catch (error) {
        console.error('Failed to start recording:', error);
        showToast('Microphone access denied', '❌');
      }
    }
  };

  // End interview
  const endInterview = () => {
    setStep('summary');
  };

  // Switch persona mid-interview
  const switchPersona = (persona: typeof PERSONAS[0]) => {
    setSelectedPersona(persona);
    showToast(`Now speaking with ${persona.name}`, persona.icon);
  };

  // Calculate average score
  const avgScore = questionCount > 0 ? (totalScore / questionCount).toFixed(1) : '0';

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-card p-12 text-center max-w-md">
          <span className="text-6xl mb-4 block">🔒</span>
          <h2 className="text-2xl font-bold text-white mb-3">Sign In Required</h2>
          <p className="text-silver">Please sign in to access Shadow Interview</p>
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
              className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] to-cyan-900/30 border border-white/10 p-8 mb-8"
            >
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/30 rounded-full blur-3xl" />
              </div>
              <div className="relative z-10">
                <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-medium text-cyan-400">Polymath Shadow™ Interview Simulator</span>
                </motion.div>
                <h1 className="text-4xl lg:text-5xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Shadow Interview
                  </span>
                </h1>
                <p className="text-silver text-lg max-w-2xl">
                  AI-powered 1:1 interview simulation with adaptive difficulty, real-time coaching, and persona switching
                </p>
              </div>
            </motion.div>

            <div className="max-w-5xl mx-auto space-y-8">
              {/* Persona Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20 p-6"
              >
                <h3 className="text-xl font-bold text-white mb-4">Choose Your Interviewer</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {PERSONAS.map((persona) => (
                    <motion.button
                      key={persona.id}
                      onClick={() => setSelectedPersona(persona)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden ${selectedPersona.id === persona.id
                        ? `border-${persona.bgColor}-400 bg-${persona.bgColor}-500/10`
                        : 'border-white/10 hover:border-white/30 bg-[#111111]'
                        }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${persona.color} opacity-5`} />
                      <div className="relative">
                        <span className="text-4xl block mb-3">{persona.icon}</span>
                        <h4 className="font-bold text-white mb-1">{persona.name}</h4>
                        <p className="text-sm text-silver">{persona.description}</p>
                        {selectedPersona.id === persona.id && (
                          <motion.div
                            layoutId="persona-indicator"
                            className={`absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r ${persona.color} flex items-center justify-center`}
                          >
                            <span className="text-xs">✓</span>
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Resume & JD Input */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Resume Upload */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl bg-[#111111] border border-white/10 p-6"
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
                      className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${dragActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/20 hover:border-white/40'
                        }`}
                    >
                      <span className="text-4xl block mb-3">📤</span>
                      <p className="text-white font-medium">Drop resume or click to upload</p>
                      <p className="text-sm text-silver mt-1">PDF, Word, or TXT</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-green-400 font-medium">✓ Resume loaded</span>
                          <button
                            onClick={() => setResumeText('')}
                            className="text-xs text-red-400 hover:text-red-300"
                          >Clear</button>
                        </div>
                        <p className="text-xs text-silver mt-1">{resumeText.length.toLocaleString()} characters</p>
                      </div>
                      <textarea
                        rows={6}
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        className="w-full rounded-xl p-3 text-sm bg-black/30 border border-white/10 text-silver focus:outline-none resize-none"
                        placeholder="Or paste resume text..."
                      />
                    </div>
                  )}
                </motion.div>

                {/* JD Input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-[#111111] border border-white/10 p-6"
                >
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <span>💼</span> Target Job Description
                  </h3>
                  <textarea
                    rows={10}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    className="w-full rounded-xl p-4 text-sm bg-black/30 border border-white/10 text-silver focus:outline-none resize-none"
                    placeholder="Paste the job description you're preparing for..."
                  />
                </motion.div>
              </div>

              {/* Continue to Modality Selection Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center"
              >
                <button
                  onClick={() => {
                    if (!resumeText.trim() || !jdText.trim()) {
                      showToast('Please provide both resume and JD', '❌');
                      return;
                    }
                    setStep('modality');
                  }}
                  disabled={!resumeText.trim() || !jdText.trim()}
                  className="group relative px-12 py-5 rounded-2xl font-bold text-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${selectedPersona.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <span className="relative flex items-center gap-3 text-white">
                    <span className="text-2xl">{selectedPersona.icon}</span>
                    Continue with {selectedPersona.name.split(' ').pop()}
                  </span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* MODALITY SELECTION STEP */}
        {step === 'modality' && (
          <motion.div
            key="modality"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 lg:p-8"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] border border-white/10 p-8 mb-8"
            >
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl" />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <button
                    onClick={() => { setStep('setup'); setModality(null); setVoiceProfile(null); }}
                    className="text-silver hover:text-white mb-4 flex items-center gap-2 text-sm"
                  >
                    ← Back to Setup
                  </button>
                  <h1 className="text-3xl lg:text-4xl font-bold mb-2">
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      Choose Your Interview Mode
                    </span>
                  </h1>
                  <p className="text-silver">
                    How would you like to practice with <span className="text-cyan-400 font-medium">{selectedPersona.name}</span>?
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-4xl">{selectedPersona.icon}</span>
                  <div>
                    <p className="font-bold text-white">{selectedPersona.name}</p>
                    <p className="text-xs text-silver">{selectedPersona.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="max-w-4xl mx-auto space-y-8">
              {/* Modality Options */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid md:grid-cols-2 gap-6"
              >
                {/* Text Interview Option */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setModality('text'); setVoiceProfile(null); }}
                  className={`group relative p-8 rounded-3xl border-2 text-left transition-all overflow-hidden ${modality === 'text'
                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                    : 'border-white/10 bg-[#0A0A0A] hover:border-white/30'
                    }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 transition-opacity ${modality === 'text' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />

                  <div className="relative">
                    {/* Icon */}
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all ${modality === 'text'
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-500'
                      : 'bg-white/10 group-hover:bg-white/20'
                      }`}>
                      <span className="text-4xl">💬</span>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">Text Interview</h3>
                    <p className="text-silver mb-4">
                      Type your responses in a chat-style interface. Perfect for practicing articulation and reviewing your answers.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {['⌨️ Type Responses', '📝 Review Answers', '📱 Mobile Friendly'].map((tag) => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-silver">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {modality === 'text' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center"
                      >
                        <span className="text-white text-sm">✓</span>
                      </motion.div>
                    )}
                  </div>
                </motion.button>

                {/* Voice Interview Option */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    setModality('voice');
                    // Request microphone permission when voice mode is selected
                    if (micPermission !== 'granted') {
                      await requestMicPermission();
                    }
                  }}
                  className={`group relative p-8 rounded-3xl border-2 text-left transition-all overflow-hidden ${modality === 'voice'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                    : 'border-white/10 bg-[#0A0A0A] hover:border-white/30'
                    }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 transition-opacity ${modality === 'voice' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />

                  <div className="relative">
                    {/* Icon */}
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all ${modality === 'voice'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                      : 'bg-white/10 group-hover:bg-white/20'
                      }`}>
                      <span className="text-4xl">🎙️</span>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">Voice Interview</h3>
                    <p className="text-silver mb-4">
                      Speak your answers naturally. The AI interviewer responds with voice too — feels like the real thing.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {['🎤 Speak Naturally', '🔊 AI Voice Output', '⚡ Real-time'].map((tag) => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-silver">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Mic permission status indicator */}
                    {modality === 'voice' && (
                      <div className={`mt-4 px-3 py-2 rounded-lg text-xs font-medium ${micPermission === 'granted' ? 'bg-green-500/20 text-green-400' :
                          micPermission === 'denied' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {micPermission === 'granted' && '✅ Microphone ready'}
                            {micPermission === 'denied' && '❌ Microphone blocked'}
                            {micPermission === 'prompt' && '🎤 Click to enable microphone'}
                          </span>
                          {micPermission !== 'granted' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await requestMicPermission();
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${micPermission === 'denied'
                                  ? 'bg-red-500 hover:bg-red-400 text-white'
                                  : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                }`}
                            >
                              {micPermission === 'denied' ? 'Retry' : 'Allow Microphone'}
                            </button>
                          )}
                        </div>
                        {micPermission === 'denied' && (
                          <p className="mt-1 text-[10px] opacity-70">
                            If blocked, click the 🔒 icon in your browser's address bar to allow microphone.
                          </p>
                        )}
                      </div>
                    )}

                    {modality === 'voice' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center"
                      >
                        <span className="text-white text-sm">✓</span>
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              </motion.div>

              {/* Voice Profile Selection (Conditional) */}
              <AnimatePresence>
                {modality === 'voice' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl bg-[#0A0A0A] border border-emerald-500/30 p-6 overflow-hidden"
                  >
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <span className="text-xl">🔊</span> Choose Interview Voice
                    </h3>
                    <p className="text-silver text-sm mb-6">
                      Select the voice profile for your AI interviewer
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Male Voice */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setVoiceProfile('male')}
                        className={`p-5 rounded-2xl border-2 transition-all text-left ${voiceProfile === 'male'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 bg-[#111111] hover:border-white/30'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${voiceProfile === 'male' ? 'bg-blue-500' : 'bg-white/10'
                            }`}>
                            <span className="text-2xl">👨‍💼</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-white">Orion</h4>
                            <p className="text-sm text-silver">Direct & Analytical</p>
                          </div>
                          {voiceProfile === 'male' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center"
                            >
                              <span className="text-white text-xs">✓</span>
                            </motion.div>
                          )}
                        </div>
                      </motion.button>

                      {/* Female Voice */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setVoiceProfile('female')}
                        className={`p-5 rounded-2xl border-2 transition-all text-left ${voiceProfile === 'female'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-white/10 bg-[#111111] hover:border-white/30'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${voiceProfile === 'female' ? 'bg-cyan-500' : 'bg-white/10'
                            }`}>
                            <span className="text-2xl">👩‍💼</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-white">Sona</h4>
                            <p className="text-sm text-silver">Professional & Empathetic</p>
                          </div>
                          {voiceProfile === 'female' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center"
                            >
                              <span className="text-white text-xs">✓</span>
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Start Interview Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center pt-4"
              >
                <button
                  onClick={() => {
                    // Pass voice mode directly to startInterview (avoids async state issues)
                    startInterview(modality === 'voice');
                  }}
                  disabled={!modality || (modality === 'voice' && !voiceProfile)}
                  className={`group relative px-16 py-6 rounded-2xl font-bold text-xl overflow-hidden transition-all ${modality && (modality === 'text' || voiceProfile)
                    ? 'cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                    }`}
                >
                  <div className={`absolute inset-0 transition-opacity ${modality === 'voice'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    } ${modality ? 'opacity-80 group-hover:opacity-100' : 'opacity-40'}`} />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <span className="relative flex items-center gap-3 text-white">
                    <span className="text-2xl">{modality === 'voice' ? '🎙️' : '💬'}</span>
                    {modality
                      ? `Start ${modality === 'voice' ? 'Voice' : 'Text'} Interview`
                      : 'Select a Mode to Continue'
                    }
                  </span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* INTERVIEW STEP */}
        {step === 'interview' && (
          <motion.div
            key="interview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex flex-col"
          >
            {/* Top Bar */}
            <div className="flex-shrink-0 border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  {/* Persona Switcher */}
                  <div className="flex gap-2">
                    {PERSONAS.map((persona) => (
                      <button
                        key={persona.id}
                        onClick={() => switchPersona(persona)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedPersona.id === persona.id
                          ? `bg-gradient-to-r ${persona.color} shadow-lg`
                          : 'bg-[#111111] hover:bg-white/10'
                          }`}
                        title={persona.name}
                      >
                        <span className="text-xl">{persona.icon}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-white">{selectedPersona.name}</p>
                    <p className="text-xs text-silver">{selectedPersona.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Difficulty Indicator */}
                  <div className={`px-4 py-2 rounded-xl border ${difficulty === 'high-stress' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                    difficulty === 'coaching' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                      'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                    <p className="text-xs font-semibold uppercase">{DIFFICULTY_LEVELS[difficulty].name}</p>
                  </div>

                  {/* Score */}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{avgScore}</p>
                    <p className="text-xs text-silver">Avg Score</p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${voiceOutputEnabled
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'bg-[#111111] hover:bg-white/10 text-white'
                      }`}
                  >
                    {voiceOutputEnabled ? '🔊' : '🔇'} Voice {voiceOutputEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => setShowTips(true)}
                    className="px-4 py-2 rounded-xl bg-[#111111] hover:bg-white/10 text-white text-sm font-medium"
                  >💡 Tips</button>
                  <button
                    onClick={endInterview}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium"
                  >End</button>
                </div>
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-3xl ${msg.role === 'user' ? 'order-2' : ''}`}>
                      {/* Message */}
                      <div className={`p-5 rounded-2xl ${msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30'
                        : `bg-gradient-to-r from-${selectedPersona.bgColor}-500/10 to-slate-800/50 border border-white/10`
                        }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">{selectedPersona.icon}</span>
                            <span className="text-sm font-semibold text-silver">{selectedPersona.name}</span>
                          </div>
                        )}
                        <p className="text-slate-200 whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Feedback Card */}
                      {msg.feedback && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20"
                        >
                          <div className="flex items-center gap-4 mb-3">
                            <div className="text-center">
                              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold ${msg.feedback.score >= 8 ? 'bg-green-500/20 text-green-400' :
                                msg.feedback.score >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                {msg.feedback.score}
                              </div>
                              <p className="text-xs text-silver mt-1">Score</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-cyan-400 uppercase mb-1">Shadow Insight</p>
                              <p className="text-sm text-silver">{msg.feedback.trap}</p>
                            </div>
                          </div>
                          {msg.feedback.refinement && (
                            <div className="pt-3 border-t border-white/10">
                              <p className="text-xs font-semibold text-cyan-400 uppercase mb-1">💎 Better Way to Say It</p>
                              <p className="text-sm text-silver italic">"{msg.feedback.refinement}"</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Thinking Indicator */}
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="p-5 rounded-2xl bg-[#111111]/50 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-silver">
                          {selectedPersona.name} is {difficulty === 'high-stress' ? 'evaluating critically' : 'thinking'}...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Neural Sphere */}
              <div className="w-48 flex-shrink-0 flex items-center justify-center bg-[#0A0A0A]/50 border-l border-white/10">
                <div className="text-center">
                  <motion.div
                    animate={{
                      scale: sphereState === 'thinking' ? [1, 1.1, 1] : sphereState === 'stress' ? [1, 1.2, 1] : 1,
                      boxShadow: sphereState === 'listening'
                        ? '0 0 60px rgba(34, 197, 94, 0.5)'
                        : sphereState === 'thinking'
                          ? '0 0 60px rgba(6, 182, 212, 0.5)'
                          : sphereState === 'stress'
                            ? '0 0 60px rgba(239, 68, 68, 0.5)'
                            : '0 0 30px rgba(168, 85, 247, 0.3)',
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={`w-24 h-24 mx-auto rounded-full ${sphereState === 'listening' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                      sphereState === 'thinking' ? 'bg-gradient-to-br from-cyan-500 to-blue-500' :
                        sphereState === 'stress' ? 'bg-gradient-to-br from-red-500 to-orange-500' :
                          'bg-gradient-to-br from-cyan-500 to-blue-500'
                      }`}
                  />
                  <p className="text-xs text-silver mt-4">
                    {sphereState === 'listening' ? '🎤 Listening' :
                      sphereState === 'thinking' ? '🧠 Processing' :
                        sphereState === 'stress' ? '⚡ Stress Test' :
                          '💭 Ready'}
                  </p>
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl p-4">
              <div className="max-w-4xl mx-auto flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendResponse(); } }}
                    rows={2}
                    className="w-full px-5 py-4 pr-24 rounded-2xl bg-[#111111] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none resize-none"
                    placeholder="Type your response... (Shift+Enter for new line, /tips for help)"
                    disabled={isThinking}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    <button
                      onClick={toggleVoice}
                      disabled={isThinking || isSpeaking || isTranscribing}
                      className={`p-2 rounded-xl transition-all disabled:opacity-50 ${isRecording ? 'bg-red-500 text-white animate-pulse' :
                        isTranscribing ? 'bg-yellow-500 text-white' :
                          'bg-white/10 text-silver hover:text-white hover:bg-white/20'
                        }`}
                      title={isRecording ? 'Click to stop' : 'Click to speak'}
                    >
                      {isTranscribing ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={sendResponse}
                  disabled={isThinking || !currentInput.trim()}
                  className={`px-6 py-4 rounded-2xl font-bold bg-gradient-to-r ${selectedPersona.color} text-white disabled:opacity-50 transition-all hover:shadow-lg`}
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* SUMMARY STEP */}
        {step === 'summary' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen p-6 lg:p-8"
          >
            <div className="max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-[#0A0A0A] to-cyan-900/30 border border-white/10 p-8 text-center"
              >
                <span className="text-6xl block mb-6">🎉</span>
                <h1 className="text-4xl font-bold text-white mb-4">Interview Complete!</h1>

                <div className="grid grid-cols-3 gap-4 my-8">
                  <div className="p-4 rounded-xl bg-[#111111]">
                    <p className="text-3xl font-bold text-cyan-400">{questionCount}</p>
                    <p className="text-sm text-silver">Questions</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111111]">
                    <p className={`text-3xl font-bold ${parseFloat(avgScore) >= 7 ? 'text-green-400' :
                      parseFloat(avgScore) >= 5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{avgScore}</p>
                    <p className="text-sm text-silver">Avg Score</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111111]">
                    <p className="text-3xl font-bold text-cyan-400">{selectedPersona.icon}</p>
                    <p className="text-sm text-silver">{selectedPersona.name.split(' ').pop()}</p>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => { setStep('setup'); setMessages([]); setQuestionCount(0); setTotalScore(0); }}
                    className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                  >
                    Practice Again
                  </button>
                  <button
                    onClick={() => setShowTips(true)}
                    className="px-6 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20"
                  >
                    View Tips
                  </button>
                </div>
              </motion.div>

              {/* Message History */}
              <div className="mt-8 space-y-4">
                <h3 className="text-xl font-bold text-white">Interview Recap</h3>
                {messages.filter(m => m.feedback).map((msg, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#111111] border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-silver">Q{idx + 1}</span>
                      <span className={`text-lg font-bold ${(msg.feedback?.score || 0) >= 7 ? 'text-green-400' :
                        (msg.feedback?.score || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{msg.feedback?.score}/10</span>
                    </div>
                    {msg.feedback?.trap && (
                      <p className="text-sm text-silver">{msg.feedback.trap}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips Sidebar */}
      <AnimatePresence>
        {showTips && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowTips(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0A0A0A] border-l border-white/10 z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">💡 Unfair Advantage Tips</h3>
                  <button onClick={() => setShowTips(false)} className="p-2 rounded-lg hover:bg-white/10">
                    <svg className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {tips.length === 0 && !loadingTips && (
                  <button
                    onClick={generateTips}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-silver hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                  >
                    Click to generate personalized tips
                  </button>
                )}

                {loadingTips && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  </div>
                )}

                <div className="space-y-4">
                  {tips.map((tip, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-xl bg-[#111111] border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tip.category === 'behavioral' ? 'bg-cyan-500/20 text-cyan-400' :
                          tip.category === 'technical' ? 'bg-cyan-500/20 text-cyan-400' :
                            tip.category === 'negotiation' ? 'bg-green-500/20 text-green-400' :
                              'bg-slate-500/20 text-silver'
                          }`}>{tip.category}</span>
                      </div>
                      <h4 className="font-semibold text-white mb-1">{tip.title}</h4>
                      <p className="text-sm text-silver">{tip.content}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
