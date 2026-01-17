'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { groqJSONCompletion, groqCompletion } from '@/lib/ai/groq-client';
import { database } from '@/lib/database';
import { showToast } from '@/components/Toast';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { Grades } from '@/types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const GRADE_LABELS = ['Communication', 'Technical', 'Problem Solving', 'Culture Fit', 'Leadership', 'Energy'];
const GRADE_KEYS: (keyof Grades)[] = ['communication', 'technical', 'problemSolving', 'cultureFit', 'leadership', 'energy'];

export default function CalibrationTab() {
  const { currentCandidate, setCurrentCandidate, questionData } = useStore();
  const [generatingAI, setGeneratingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const getCombinedTranscript = () => {
    const questionTranscripts = Object.values(questionData).map(q => q.transcript).filter(t => t?.trim());
    return questionTranscripts.length > 0 ? questionTranscripts.join('\n\n') : currentCandidate.transcript || '';
  };

  const combinedTranscript = getCombinedTranscript();
  const hasTranscript = combinedTranscript.trim().length > 0;
  const hasQuestions = currentCandidate.questions.length > 0;

  const updateHumanGrade = (key: keyof Grades, value: number) => {
    setCurrentCandidate({ humanGrades: { ...currentCandidate.humanGrades, [key]: value } });
  };

  const calcAvg = (grades: Grades) => Object.values(grades).reduce((a, b) => a + b, 0) / 6;

  const generateAIAssessment = async () => {
    if (combinedTranscript.trim().length < 50) return showToast('Transcript too short', '❌');
    setGeneratingAI(true);
    try {
      const data = await groqJSONCompletion<{ grades: Grades }>(
        `You are an expert interviewer at Hirely.ai. Analyze transcripts and provide objective assessments.`,
        `Analyze this interview and provide grades (0-10) for: communication, technical, problemSolving, cultureFit, leadership, energy.
        
CANDIDATE: ${currentCandidate.name || 'Unknown'}
JD: ${currentCandidate.jdText.substring(0, 500)}...
TRANSCRIPT: ${combinedTranscript.substring(0, 3000)}...

Return JSON: { "grades": { "communication": X, "technical": X, "problemSolving": X, "cultureFit": X, "leadership": X, "energy": X } }`,
        { temperature: 0.5, maxTokens: 1024 }
      );
      if (data?.grades) {
        setCurrentCandidate({ aiGrades: data.grades });
        showToast('AI assessment generated!', '✅');
      }
    } catch { showToast('Error generating assessment', '❌'); }
    finally { setGeneratingAI(false); }
  };

  const generateAutoSummary = async () => {
    if (combinedTranscript.trim().length < 50) return showToast('Transcript too short', '❌');
    setGeneratingSummary(true);
    try {
      const summary = await groqCompletion(
        `You are a professional interviewer. Create concise interview summaries.`,
        `Create a 3-4 sentence summary for: ${currentCandidate.name || 'Unknown'}\nTranscript: ${combinedTranscript.substring(0, 2000)}`,
        { temperature: 0.7, maxTokens: 256 }
      );
      setCurrentCandidate({ notes: summary.trim() });
      showToast('Summary generated!', '✅');
    } catch { showToast('Error generating summary', '❌'); }
    finally { setGeneratingSummary(false); }
  };

  const saveCandidate = async () => {
    if (!currentCandidate.name) return showToast('Enter candidate name', '❌');
    setSaving(true);
    try {
      await database.saveCandidate({
        ...currentCandidate,
        transcript: combinedTranscript,
        timestamp: new Date().toISOString(),
      });
      showToast('Candidate saved!', '✅');
    } catch (e: any) { showToast(e.message || 'Error saving', '❌'); }
    finally { setSaving(false); }
  };

  const radarData = {
    labels: GRADE_LABELS,
    datasets: [
      {
        label: 'Human',
        data: GRADE_KEYS.map(k => currentCandidate.humanGrades[k]),
        backgroundColor: 'rgba(0, 245, 255, 0.15)',
        borderColor: 'rgba(0, 245, 255, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0, 245, 255, 1)',
        pointRadius: 5,
      },
      {
        label: 'AI',
        data: GRADE_KEYS.map(k => currentCandidate.aiGrades[k]),
        backgroundColor: 'rgba(0, 153, 255, 0.15)',
        borderColor: 'rgba(0, 153, 255, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0, 153, 255, 1)',
        pointRadius: 5,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0, max: 10,
        ticks: { stepSize: 2, color: 'rgba(255,255,255,0.4)', backdropColor: 'transparent' },
        grid: { color: 'rgba(0,245,255,0.1)' },
        angleLines: { color: 'rgba(0,245,255,0.1)' },
        pointLabels: { color: 'rgba(255,255,255,0.8)', font: { size: 12, weight: 'bold' as const } },
      },
    },
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: 'rgba(255,255,255,0.8)', usePointStyle: true } },
    },
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] to-cyan-900/20 border border-white/10 p-8"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-medium text-cyan-400">Phase 3 • Hybrid Assessment</span>
            </motion.div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-3"><span className="text-gradient">Calibration</span></h1>
            <p className="text-silver text-lg max-w-xl">Human intuition meets AI logic — compare assessments side by side</p>
          </div>

          {/* Score Comparison */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="flex items-center gap-6"
          >
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-cyan-400">{calcAvg(currentCandidate.humanGrades).toFixed(1)}</span>
              </div>
              <span className="text-xs text-silver">Human</span>
            </div>
            <div className="text-slate-600 text-2xl">vs</div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-blue-400">{calcAvg(currentCandidate.aiGrades).toFixed(1)}</span>
              </div>
              <span className="text-xs text-silver">AI</span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Warnings */}
      {!hasQuestions && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-4"
        >
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-semibold text-yellow-400">No Interview Data</h3>
            <p className="text-sm text-silver">Complete Detective and Co-Pilot phases first.</p>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Human Grading */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20 overflow-hidden"
        >
          <div className="p-6 border-b border-white/5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Human Assessment</h3>
              <p className="text-sm text-silver">Your intuitive evaluation</p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {GRADE_KEYS.map((key, i) => (
              <div key={key} className="group">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-silver group-hover:text-white transition-colors">
                    {GRADE_LABELS[i]}
                  </label>
                  <span className="text-lg font-bold text-cyan-400">{currentCandidate.humanGrades[key].toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="10" step="0.1"
                  value={currentCandidate.humanGrades[key]}
                  onChange={(e) => updateHumanGrade(key, parseFloat(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-grab active:cursor-grabbing slider-enhanced"
                  style={{
                    background: `linear-gradient(to right, rgba(0,245,255,0.6) 0%, rgba(0,245,255,0.6) ${currentCandidate.humanGrades[key] * 10}%, rgba(255,255,255,0.1) ${currentCandidate.humanGrades[key] * 10}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />
              </div>
            ))}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-silver">Average</span>
              <span className="text-2xl font-bold text-gradient">{calcAvg(currentCandidate.humanGrades).toFixed(1)}</span>
            </div>
          </div>
        </motion.div>

        {/* AI Assessment */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-[#0A0A0A] to-blue-900/10 border border-blue-500/20 overflow-hidden"
        >
          <div className="p-6 border-b border-white/5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <span className="text-3xl">🤖</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">AI Assessment</h3>
              <p className="text-sm text-silver">GPT-OSS 120B analysis</p>
            </div>
          </div>
          <div className="p-6">
            {hasTranscript ? (
              <>
                <button onClick={generateAIAssessment} disabled={generatingAI}
                  className="w-full px-6 py-4 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 mb-6"
                >
                  {generatingAI ? '⏳ Analyzing Transcript...' : '🧠 Generate AI Assessment'}
                </button>
                <div className="space-y-3">
                  {GRADE_KEYS.map((key, i) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-silver">{GRADE_LABELS[i]}</span>
                        <span className="text-sm font-bold text-blue-400">{currentCandidate.aiGrades[key].toFixed(1)}</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${currentCandidate.aiGrades[key] * 10}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-silver">AI Average</span>
                  <span className="text-xl font-bold text-blue-400">{calcAvg(currentCandidate.aiGrades).toFixed(1)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-silver">No transcript available. Complete interview in Co-Pilot first.</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Radar Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20 overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
            <span className="text-3xl">📊</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Calibration Radar</h3>
            <p className="text-sm text-silver">Human vs AI visual comparison</p>
          </div>
        </div>
        <div className="p-6">
          <div className="relative h-[400px]">
            <Radar data={radarData} options={radarOptions} />
          </div>
          <div className="flex items-center justify-center gap-8 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white" />
              <span className="text-sm text-silver">Human</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500" />
              <span className="text-sm text-silver">AI</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notes & Save */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl bg-[#0A0A0A] to-green-900/10 border border-green-500/20 overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center">
              <span className="text-3xl">📝</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Interview Notes</h3>
              <p className="text-sm text-silver">Additional observations</p>
            </div>
          </div>
          {hasTranscript && (
            <button onClick={generateAutoSummary} disabled={generatingSummary}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all disabled:opacity-50"
            >
              {generatingSummary ? 'Generating...' : '✨ Auto-Summary'}
            </button>
          )}
        </div>
        <div className="p-6">
          <textarea rows={6}
            className="w-full rounded-xl p-4 text-sm bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-green-500/50 focus:outline-none resize-none mb-6"
            placeholder="Add interview notes, observations, concerns, follow-ups..."
            value={currentCandidate.notes}
            onChange={(e) => setCurrentCandidate({ notes: e.target.value })}
          />
          <button onClick={saveCandidate} disabled={saving || !currentCandidate.name}
            className="w-full px-6 py-4 rounded-xl font-bold bg-gradient-to-r from-green-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50"
          >
            {saving ? '⏳ Saving...' : '💾 Save Candidate Assessment'}
          </button>
          {!currentCandidate.name && <p className="text-xs text-red-400 mt-2 text-center">Enter candidate name in Detective tab</p>}
        </div>
      </motion.div>
    </div>
  );
}
