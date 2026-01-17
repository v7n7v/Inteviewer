'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { groqCompletion } from '@/lib/ai/groq-client';
import { showToast } from '@/components/Toast';

const TECH_KEYWORDS = [
  'python', 'javascript', 'typescript', 'react', 'node', 'api', 'database', 
  'sql', 'mongodb', 'aws', 'docker', 'kubernetes', 'ci/cd', 'testing',
  'machine learning', 'ai', 'data', 'algorithm', 'architecture', 'design pattern',
  'microservices', 'rest', 'graphql', 'frontend', 'backend', 'fullstack'
];

type CaptureMode = 'mic-only' | 'meeting';

export default function CoPilotTab() {
  const { currentCandidate, setCurrentCandidate, questionData, setQuestionData, getQuestionData } = useStore();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [recordingQuestionIndex, setRecordingQuestionIndex] = useState<number | null>(null);
  const [generatingNudgeIndex, setGeneratingNudgeIndex] = useState<number | null>(null);
  
  // Dual capture state
  const [captureMode, setCaptureMode] = useState<CaptureMode>('mic-only');
  const [micActive, setMicActive] = useState(false);
  const [systemAudioActive, setSystemAudioActive] = useState(false);
  const [showCaptureGuide, setShowCaptureGuide] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const mergedStreamRef = useRef<MediaStream | null>(null);

  const hasSpeechRecognition = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!hasSpeechRecognition) return;
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript + ' ';
        else interim += transcript;
      }
      if (final) {
        const newTranscript = transcriptRef.current + final;
        transcriptRef.current = newTranscript;
        setCurrentTranscript(newTranscript);
        if (activeQuestionIndex !== null) {
          const qData = getQuestionData(activeQuestionIndex);
          const keywords = detectKeywords(final);
          setQuestionData(activeQuestionIndex, {
            transcript: qData.transcript + final,
            keywords: [...new Set([...qData.keywords, ...keywords])],
            status: 'in-progress',
          });
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        showToast('Microphone permission denied', '❌');
        setIsTranscribing(false);
        setMicActive(false);
      }
    };

    recognition.onend = () => { if (isTranscribing) recognition.start(); };
    recognitionRef.current = recognition;
    return () => { recognitionRef.current?.stop(); cleanupStreams(); };
  }, [hasSpeechRecognition, isTranscribing, activeQuestionIndex, getQuestionData, setQuestionData]);

  const detectKeywords = (text: string): string[] => {
    const lower = text.toLowerCase();
    return TECH_KEYWORDS.filter(k => lower.includes(k.toLowerCase()));
  };

  // Cleanup all streams
  const cleanupStreams = () => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    systemStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    micStreamRef.current = null;
    systemStreamRef.current = null;
    mergedStreamRef.current = null;
    audioContextRef.current = null;
    setMicActive(false);
    setSystemAudioActive(false);
  };

  // Start Dual Capture (Mic + System Audio from Meeting Apps)
  const startDualCapture = async (): Promise<MediaStream> => {
    // 1. Get Microphone
    showToast('Requesting microphone...', '🎤');
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = micStream;
    setMicActive(true);

    // 2. Get Tab/System Audio (User must check "Share Audio" in the popup)
    showToast('Share your meeting tab and CHECK "Share audio"!', '🔊');
    const systemStream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // Required by API to get audio
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as any
    });
    systemStreamRef.current = systemStream;
    
    // Check if system audio was actually shared
    const audioTracks = systemStream.getAudioTracks();
    if (audioTracks.length > 0) {
      setSystemAudioActive(true);
      showToast('Meeting audio captured!', '✅');
    } else {
      showToast('No audio shared - only mic will record', '⚠️');
    }

    // Stop video track since we only need audio
    systemStream.getVideoTracks().forEach(t => t.stop());

    // 3. Create AudioContext and merge streams
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const dest = audioContext.createMediaStreamDestination();

    // Connect microphone
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(dest);

    // Connect system audio if available
    if (audioTracks.length > 0) {
      const systemSource = audioContext.createMediaStreamSource(systemStream);
      systemSource.connect(dest);
    }

    // Handle system stream ending (user stops sharing)
    systemStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      setSystemAudioActive(false);
      showToast('Screen share ended', '📺');
    });

    mergedStreamRef.current = dest.stream;
    return dest.stream;
  };

  // Start transcription (either mic-only or meeting mode)
  const startTranscription = async () => {
    if (!hasSpeechRecognition) return showToast('Speech recognition not supported', '❌');
    
    try {
      if (captureMode === 'meeting') {
        // Dual capture mode for meeting apps
        await startDualCapture();
      } else {
        // Mic-only mode
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicActive(true);
      }
      
      transcriptRef.current = '';
      setCurrentTranscript('');
      setIsTranscribing(true);
      recognitionRef.current?.start();
      showToast('Transcription started!', '🎤');
    } catch (err: any) {
      console.error('Capture error:', err);
      if (err.name === 'NotAllowedError') {
        showToast('Permission denied', '❌');
      } else {
        showToast('Could not start capture', '❌');
      }
      cleanupStreams();
    }
  };

  const stopTranscription = () => {
    setIsTranscribing(false);
    recognitionRef.current?.stop();
    cleanupStreams();
    showToast('Transcription stopped', '⏹️');
  };

  const selectQuestion = (index: number) => {
    if (activeQuestionIndex === index) setActiveQuestionIndex(null);
    else {
      setActiveQuestionIndex(index);
      if (getQuestionData(index).status === 'not-started') setQuestionData(index, { status: 'in-progress' });
    }
  };

  const startRecording = async (idx: number) => {
    try {
      let stream: MediaStream;
      
      if (captureMode === 'meeting' && mergedStreamRef.current) {
        // Use merged stream if in meeting mode
        stream = mergedStreamRef.current;
      } else {
        // Get mic only
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setQuestionData(idx, { 
          audioUrl: URL.createObjectURL(blob), 
          timestamp: new Date().toISOString(),
          captureMode: captureMode 
        });
        showToast(`Audio saved for Q${idx + 1}`, '💾');
        if (captureMode === 'mic-only') stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingQuestionIndex(idx);
      showToast(`Recording Q${idx + 1}${captureMode === 'meeting' ? ' (Meeting Mode)' : ''}`, '🔴');
    } catch { showToast('Could not start recording', '❌'); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecordingQuestionIndex(null);
  };

  const generateAiNudge = async (idx: number) => {
    const q = currentCandidate.questions[idx];
    const qData = getQuestionData(idx);
    if (!qData.transcript && !currentTranscript) return showToast('No transcript available', '❌');
    setGeneratingNudgeIndex(idx);
    try {
      const response = await groqCompletion(
        `You are the Shadow Interviewer at Hirely.ai. Provide 2 strategic follow-up questions.`,
        `Question: "${q.question}"\nPurpose: ${q.purpose}\nResponse: ${(qData.transcript || currentTranscript).slice(-800)}\n\nProvide 2 deep-dive follow-ups (numbered list, under 100 words).`,
        { temperature: 0.7, maxTokens: 256 }
      );
      setQuestionData(idx, { aiNudge: response });
      showToast('AI nudge generated!', '🧠');
    } catch { showToast('Error generating nudge', '❌'); }
    finally { setGeneratingNudgeIndex(null); }
  };

  const markComplete = (idx: number) => {
    setQuestionData(idx, { status: 'completed' });
    showToast(`Question ${idx + 1} completed`, '✅');
  };

  const playAudio = (url: string) => new Audio(url).play();

  const hasQuestions = currentCandidate.questions.length > 0;
  const completedCount = Object.values(questionData).filter(q => q.status === 'completed').length;
  const progressPercent = hasQuestions ? (completedCount / currentCandidate.questions.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] to-green-900/20 border border-white/10 p-8"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 mb-4"
            >
              <div className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-xs font-medium text-green-400">Phase 2 • Live Interview Assistant</span>
            </motion.div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-3"><span className="text-gradient">Co-Pilot</span></h1>
            <p className="text-silver text-lg max-w-xl">Real-time transcription with meeting app support - capture both sides of the conversation</p>
          </div>

          {/* Live Status */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <div className={`relative w-20 h-20 rounded-2xl ${isTranscribing ? 'bg-red-500/20 border-red-500/50' : 'bg-slate-800/50 border-white/10'} border flex items-center justify-center transition-all`}>
              <span className="text-4xl">{isTranscribing ? '🎙️' : '🎤'}</span>
              {isTranscribing && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <div className="text-left">
              <p className={`font-bold ${isTranscribing ? 'text-red-400' : 'text-silver'}`}>{isTranscribing ? 'LIVE' : 'STANDBY'}</p>
              <p className="text-xs text-silver">{hasQuestions ? `${completedCount}/${currentCandidate.questions.length} done` : 'No questions'}</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Browser Warning */}
      {!hasSpeechRecognition && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-4"
        >
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-yellow-400">Browser Not Supported</h3>
            <p className="text-sm text-silver">Use Google Chrome for speech recognition.</p>
          </div>
        </motion.div>
      )}

      {/* No Questions Warning */}
      {!hasQuestions && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20 text-center"
        >
          <span className="text-6xl mb-4 block">💡</span>
          <h3 className="text-xl font-bold text-white mb-2">No Questions Available</h3>
          <p className="text-silver mb-4">Generate questions in the <span className="text-cyan-400 font-semibold">Detective</span> tab first.</p>
        </motion.div>
      )}

      {hasQuestions && (
        <>
          {/* Capture Mode Selector */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Audio Capture Mode</h3>
                <p className="text-sm text-silver">Select based on your interview setup</p>
              </div>
              <button onClick={() => setShowCaptureGuide(!showCaptureGuide)}
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >{showCaptureGuide ? 'Hide Guide' : '❓ How it works'}</button>
            </div>

            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => setCaptureMode('mic-only')} disabled={isTranscribing}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  captureMode === 'mic-only' 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                } ${isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🎤</span>
                  <span className="font-bold text-white">Microphone Only</span>
                </div>
                <p className="text-xs text-silver">In-person interviews or when you're the only speaker</p>
              </button>

              <button onClick={() => setCaptureMode('meeting')} disabled={isTranscribing}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  captureMode === 'meeting' 
                    ? 'border-cyan-500 bg-cyan-500/10' 
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                } ${isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📺</span>
                  <span className="font-bold text-white">Meeting Mode</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">NEW</span>
                </div>
                <p className="text-xs text-silver">Zoom, Meet, Teams, Webex - captures both speakers</p>
              </button>
            </div>

            {/* Active Sources Indicator */}
            {isTranscribing && (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-black/30">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${micActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-sm text-silver">Your Mic</span>
                </div>
                {captureMode === 'meeting' && (
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${systemAudioActive ? 'bg-cyan-500 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-sm text-silver">Meeting Audio</span>
                  </div>
                )}
              </div>
            )}

            {/* Capture Guide */}
            <AnimatePresence>
              {showCaptureGuide && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20"
                >
                  <h4 className="font-bold text-cyan-400 mb-3">📺 Meeting Mode Guide</h4>
                  <ol className="space-y-2 text-sm text-silver">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">1</span>
                      Click "Start" - a screen share dialog will appear
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">2</span>
                      Select the <span className="text-cyan-400 font-semibold">Chrome Tab</span> with your meeting (Zoom, Meet, etc.)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">3</span>
                      <span className="text-yellow-400 font-semibold">IMPORTANT:</span> Check the <span className="text-yellow-400">"Share audio"</span> checkbox at the bottom!
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">4</span>
                      Click "Share" - both your mic AND the meeting audio will be captured
                    </li>
                  </ol>
                  <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-400">
                      💡 <strong>Tip:</strong> Open your meeting in a Chrome tab (not the desktop app) for best results
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-silver">✅ Google Meet</span>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-silver">✅ Zoom Web</span>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-silver">✅ Microsoft Teams</span>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-silver">✅ Webex</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Progress Bar */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-slate-900/50 border border-white/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-white">Interview Progress</span>
              <span className="text-sm text-silver">{completedCount} / {currentCandidate.questions.length}</span>
            </div>
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
              />
            </div>
          </motion.div>

          {/* Transcription Control */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${isTranscribing ? 'bg-red-500/20' : captureMode === 'meeting' ? 'bg-cyan-500/20' : 'bg-green-500/20'} flex items-center justify-center`}>
                  <span className="text-3xl">{isTranscribing ? '🔴' : captureMode === 'meeting' ? '📺' : '🎙️'}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {captureMode === 'meeting' ? 'Meeting Capture' : 'Transcription'}
                  </h3>
                  <p className="text-sm text-silver">
                    {isTranscribing 
                      ? activeQuestionIndex !== null 
                        ? `Recording → Q${activeQuestionIndex + 1}` 
                        : 'Select a question below'
                      : captureMode === 'meeting' 
                        ? 'Share your meeting tab to capture both speakers' 
                        : 'Start transcribing to begin'
                    }
                  </p>
                </div>
              </div>
              <button onClick={isTranscribing ? stopTranscription : startTranscription} disabled={!hasSpeechRecognition}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${
                  isTranscribing 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : captureMode === 'meeting'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                      : 'bg-gradient-to-r from-green-500 to-cyan-500 text-white hover:shadow-lg'
                } disabled:opacity-50`}
              >
                {isTranscribing ? '⏹️ Stop' : captureMode === 'meeting' ? '📺 Start Meeting Capture' : '🎤 Start'}
              </button>
            </div>

            <AnimatePresence>
              {isTranscribing && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 rounded-xl bg-black/30 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-silver flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Live Transcript
                      {captureMode === 'meeting' && systemAudioActive && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px]">+ Meeting Audio</span>
                      )}
                    </span>
                    {activeQuestionIndex !== null && <span className="text-xs text-cyan-400">→ Q{activeQuestionIndex + 1}</span>}
                  </div>
                  <div className="text-sm text-silver max-h-32 overflow-y-auto font-mono">
                    {currentTranscript || interimTranscript || <span className="text-silver italic">Listening...</span>}
                    {interimTranscript && <span className="text-silver italic"> {interimTranscript}</span>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Questions List */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white px-1">Interview Questions</h3>
            {currentCandidate.questions.map((q, idx) => {
              const qData = getQuestionData(idx);
              const isActive = activeQuestionIndex === idx;
              const isRecording = recordingQuestionIndex === idx;
              const isGenerating = generatingNudgeIndex === idx;

              return (
                <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive 
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10' 
                      : 'bg-slate-900/50 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                      qData.status === 'completed' ? 'bg-green-500/20 text-green-400'
                      : qData.status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-slate-800 text-silver'
                    }`}>
                      {qData.status === 'completed' ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-semibold mb-1">{q.question}</h4>
                      <p className="text-sm text-silver"><span className="text-cyan-400">Purpose:</span> {q.purpose}</p>
                    </div>
                    <button onClick={() => selectQuestion(idx)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        isActive ? 'bg-cyan-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white'
                      }`}
                    >
                      {isActive ? 'Selected' : 'Select'}
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => isRecording ? stopRecording() : startRecording(idx)}
                      className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                        isRecording ? 'bg-red-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                      }`}
                    >
                      {isRecording ? '⏹️ Stop Recording' : '🔴 Record'}
                    </button>
                    <button onClick={() => generateAiNudge(idx)} disabled={isGenerating || (!qData.transcript && !currentTranscript)}
                      className="flex-1 min-w-[120px] px-4 py-3 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50 transition-all"
                    >
                      {isGenerating ? '⏳ Generating...' : '🧠 AI Nudge'}
                    </button>
                    {qData.status !== 'completed' && (
                      <button onClick={() => markComplete(idx)}
                        className="px-4 py-3 rounded-xl font-semibold text-sm bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 transition-all"
                      >
                        ✓ Complete
                      </button>
                    )}
                  </div>

                  {/* Question Data */}
                  {(qData.transcript || qData.aiNudge || qData.audioUrl || qData.keywords.length > 0) && (
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      {qData.transcript && (
                        <div className="p-3 rounded-xl bg-black/30">
                          <span className="text-xs font-semibold text-silver mb-1 block">TRANSCRIPT</span>
                          <p className="text-sm text-silver max-h-20 overflow-y-auto">{qData.transcript}</p>
                        </div>
                      )}
                      {qData.aiNudge && (
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <span className="text-xs font-semibold text-blue-400 mb-1 block">AI FOLLOW-UPS</span>
                          <p className="text-sm text-silver whitespace-pre-wrap">{qData.aiNudge}</p>
                        </div>
                      )}
                      {qData.audioUrl && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                          <span className="text-xl">🎵</span>
                          <div className="flex-1">
                            <p className="text-sm text-white">Audio recorded {qData.captureMode === 'meeting' && <span className="text-cyan-400">(Meeting Mode)</span>}</p>
                            {qData.timestamp && <p className="text-xs text-silver">{new Date(qData.timestamp).toLocaleString()}</p>}
                          </div>
                          <button onClick={() => playAudio(qData.audioUrl!)} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm text-white hover:bg-white/20 transition-colors">▶ Play</button>
                        </div>
                      )}
                      {qData.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {qData.keywords.map(k => <span key={k} className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">{k}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
