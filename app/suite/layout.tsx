'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import SuiteSidebar from '@/components/SuiteSidebar';
import AIAssistant from '@/components/AIAssistant';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllStudyProgress, type StudyProgress } from '@/lib/database-suite';


export default function SuiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [trainingNotif, setTrainingNotif] = useState<{ show: boolean; activeCount: number; nextSkill: string }>({ show: false, activeCount: 0, nextSkill: '' });

  useEffect(() => {
    const unsubscribe = authHelpers.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        router.push('/');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, setUser]);

  // Training notification on sign-in (throttled to once per 4 hours)
  useEffect(() => {
    if (!user) return;
    const THROTTLE_KEY = 'tc_training_notif_last';
    const THROTTLE_MS = 4 * 60 * 60 * 1000; // 4 hours
    const last = localStorage.getItem(THROTTLE_KEY);
    if (last && Date.now() - Number(last) < THROTTLE_MS) return;

    const checkTraining = async () => {
      try {
        const result = await getAllStudyProgress();
        if (result.success && result.data && result.data.length > 0) {
          const active = result.data.filter((p: StudyProgress) => p.completed_days.length < 7);
          if (active.length > 0) {
            // Find the most recently active skill
            const sorted = [...active].sort((a, b) =>
              new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
            );
            setTrainingNotif({ show: true, activeCount: active.length, nextSkill: sorted[0].skill });
            localStorage.setItem(THROTTLE_KEY, String(Date.now()));

            // Auto-dismiss after 8 seconds
            setTimeout(() => setTrainingNotif(prev => ({ ...prev, show: false })), 8000);
          }
        }
      } catch {}
    };

    // Delay slightly so it doesn't compete with page load
    const timer = setTimeout(checkTraining, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--theme-bg)]">
        <div className="text-center">
          <div className="scanning-loader mx-auto mb-4"></div>
          <p className="text-silver">Loading Talent Suite...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] relative overflow-hidden">
      {/* Theme-aware background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 theme-base-bg" />
        <div className="absolute inset-0 theme-radial-glow" />
        <div className="mesh-gradient" />
      </div>

      {/* Training Notification Banner */}
      <AnimatePresence>
        {trainingNotif.show && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
          >
            <button
              onClick={() => { setTrainingNotif(prev => ({ ...prev, show: false })); router.push('/suite/skill-bridge'); }}
              className="pointer-events-auto mt-4 mx-4 max-w-lg w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl backdrop-blur-xl shadow-2xl border transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(16,185,129,0.1) 50%, rgba(245,158,11,0.1) 100%)',
                borderColor: 'rgba(6,182,212,0.25)',
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-lg">🌉</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">
                  Welcome back! 🎯 Continue your training
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {trainingNotif.activeCount} active course{trainingNotif.activeCount !== 1 ? 's' : ''} · Next up: <span className="text-teal-400 font-semibold">{trainingNotif.nextSkill}</span>
                </p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className="text-[10px] px-3 py-1.5 rounded-lg bg-white/10 text-white font-semibold">
                  Resume →
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <SuiteSidebar />
      <main className="lg:ml-[280px] min-h-screen transition-all duration-300 relative z-10">
        {children}
      </main>
      <AIAssistant />

    </div>
  );
}

