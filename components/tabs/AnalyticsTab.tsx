'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { database } from '@/lib/database';
import { showToast } from '@/components/Toast';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { Candidate, Grades } from '@/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type SortOption = 'name' | 'humanAvg' | 'aiAvg' | 'date';

export default function AnalyticsTab() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => { fetchCandidates(); }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await database.getCandidates();
      setCandidates(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      showToast('Error loading candidates', '❌');
    } finally { setLoading(false); }
  };

  const calcAvg = (g: Grades) => Object.values(g).reduce((a, b) => a + b, 0) / 6;

  const stats = {
    total: candidates.length,
    avgHuman: candidates.length ? candidates.reduce((s, c) => s + calcAvg(c.humanGrades), 0) / candidates.length : 0,
    avgAI: candidates.length ? candidates.reduce((s, c) => s + calcAvg(c.aiGrades), 0) / candidates.length : 0,
    topCandidate: candidates.length ? candidates.reduce((t, c) => calcAvg(c.humanGrades) > calcAvg(t.humanGrades) ? c : t) : null,
  };

  const sorted = [...candidates].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'humanAvg': cmp = calcAvg(a.humanGrades) - calcAvg(b.humanGrades); break;
      case 'aiAvg': cmp = calcAvg(a.aiGrades) - calcAvg(b.aiGrades); break;
      case 'date': cmp = new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime(); break;
    }
    return sortDesc ? -cmp : cmp;
  });

  const chartData = {
    labels: sorted.slice(0, 8).map(c => c.name.substring(0, 12)),
    datasets: [
      { label: 'Human', data: sorted.slice(0, 8).map(c => calcAvg(c.humanGrades)), backgroundColor: 'rgba(0,245,255,0.7)', borderRadius: 8 },
      { label: 'AI', data: sorted.slice(0, 8).map(c => calcAvg(c.aiGrades)), backgroundColor: 'rgba(0,153,255,0.7)', borderRadius: 8 },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: 'rgba(255,255,255,0.8)' } },
    },
    scales: {
      y: { beginAtZero: true, max: 10, ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { display: false } },
    },
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mx-auto mb-4" />
        <p className="text-silver">Loading candidates...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-center">
      <span className="text-4xl mb-4 block">❌</span>
      <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Data</h3>
      <p className="text-silver mb-4">{error}</p>
      <button onClick={fetchCandidates} className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors">Retry</button>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Hero Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] to-blue-900/20 border border-white/10 p-8"
        >
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 mb-4"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-blue-400">Phase 4 • Data Intelligence</span>
            </motion.div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-3"><span className="text-gradient">Analytics</span></h1>
            <p className="text-silver text-lg max-w-xl">Candidate comparison, leaderboards, and exportable reports</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '👥', label: 'Total Candidates', value: stats.total, color: 'cyan' },
            { icon: '👤', label: 'Avg Human Score', value: stats.avgHuman.toFixed(1), color: 'cyan' },
            { icon: '🤖', label: 'Avg AI Score', value: stats.avgAI.toFixed(1), color: 'blue' },
            { icon: '🏆', label: 'Top Candidate', value: stats.topCandidate?.name.substring(0, 15) || 'N/A', color: 'green', sub: stats.topCandidate ? `${calcAvg(stats.topCandidate.humanGrades).toFixed(1)}/10` : '' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`p-5 rounded-2xl bg-[#0A0A0A] to-${stat.color}-900/10 border border-${stat.color}-500/20`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center`}>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <div>
                  <p className="text-xs text-silver">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color === 'cyan' ? 'text-cyan-400' : stat.color === 'blue' ? 'text-blue-400' : 'text-green-400'}`}>
                    {stat.value}
                  </p>
                  {stat.sub && <p className="text-xs text-silver">{stat.sub}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comparison Chart */}
        {candidates.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[#0A0A0A] to-cyan-900/10 border border-cyan-500/20 overflow-hidden"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                  <span className="text-3xl">📊</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Score Comparison</h3>
                  <p className="text-sm text-silver">Top 8 candidates (Human vs AI)</p>
                </div>
              </div>
              <button onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all"
              >📄 Export PDF</button>
            </div>
            <div className="p-6 h-[350px]"><Bar data={chartData} options={chartOptions} /></div>
          </motion.div>
        )}

        {/* Candidate Matrix */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden"
        >
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                <span className="text-3xl">📋</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Candidate Leaderboard</h3>
                <p className="text-sm text-silver">{candidates.length} candidates</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 rounded-xl text-sm bg-black/30 border border-white/10 text-white focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="humanAvg">Human Score</option>
                <option value="aiAvg">AI Score</option>
              </select>
              <button onClick={() => setSortDesc(!sortDesc)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
              >{sortDesc ? '↓' : '↑'}</button>
            </div>
          </div>
          <div className="p-6">
            {candidates.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl block mb-4">📭</span>
                <h3 className="text-xl font-bold text-white mb-2">No Candidates Yet</h3>
                <p className="text-silver">Complete interviews to see them here.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sorted.map((c, i) => {
                  const hAvg = calcAvg(c.humanGrades);
                  const aAvg = calcAvg(c.aiGrades);
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedCandidate(c)}
                      className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.07] cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">{c.name}</h4>
                          {c.timestamp && <p className="text-xs text-silver">{new Date(c.timestamp).toLocaleDateString()}</p>}
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          hAvg >= 8 ? 'bg-green-500/20 text-green-400' : hAvg >= 6 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                        }`}>{hAvg.toFixed(1)}</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-silver">Human</span><span className="text-cyan-400">{hAvg.toFixed(1)}</span></div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${hAvg * 10}%` }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-silver">AI</span><span className="text-blue-400">{aAvg.toFixed(1)}</span></div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${aAvg * 10}%` }} /></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-silver pt-3 mt-3 border-t border-white/10">
                        <span>{c.questions.length} Qs</span>
                        <span>{c.riskFactors.length} risks</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedCandidate(null)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0A0A0A] border border-white/10"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedCandidate.name}</h3>
                    {selectedCandidate.timestamp && <p className="text-xs text-silver">{new Date(selectedCandidate.timestamp).toLocaleString()}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedCandidate(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <svg className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Human Grades */}
                  <div className="p-5 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                    <h4 className="font-bold text-white mb-4">Human Assessment</h4>
                    {Object.entries(selectedCandidate.humanGrades).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-1">
                        <span className="text-sm text-silver capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-sm font-bold text-cyan-400">{v.toFixed(1)}</span>
                      </div>
                    ))}
                    <div className="pt-3 mt-3 border-t border-white/10 flex justify-between">
                      <span className="font-semibold text-white">Average</span>
                      <span className="text-lg font-bold text-cyan-400">{calcAvg(selectedCandidate.humanGrades).toFixed(1)}</span>
                    </div>
                  </div>
                  {/* AI Grades */}
                  <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <h4 className="font-bold text-white mb-4">AI Assessment</h4>
                    {Object.entries(selectedCandidate.aiGrades).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-1">
                        <span className="text-sm text-silver capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-sm font-bold text-blue-400">{v.toFixed(1)}</span>
                      </div>
                    ))}
                    <div className="pt-3 mt-3 border-t border-white/10 flex justify-between">
                      <span className="font-semibold text-white">Average</span>
                      <span className="text-lg font-bold text-blue-400">{calcAvg(selectedCandidate.aiGrades).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                {selectedCandidate.notes && (
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="font-bold text-white mb-2">Notes</h4>
                    <p className="text-sm text-silver whitespace-pre-wrap">{selectedCandidate.notes}</p>
                  </div>
                )}
                {selectedCandidate.riskFactors.length > 0 && (
                  <div className="p-5 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <h4 className="font-bold text-white mb-3">Risk Factors</h4>
                    {selectedCandidate.riskFactors.map((rf, i) => (
                      <div key={i} className="flex items-start gap-2 py-1">
                        <span>{rf.level === 'high' ? '🔴' : rf.level === 'medium' ? '🟡' : '🟢'}</span>
                        <p className="text-sm text-silver">{rf.description}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { window.print(); setSelectedCandidate(null); }}
                  className="w-full px-6 py-4 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg transition-all"
                >📄 Export This Candidate</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
