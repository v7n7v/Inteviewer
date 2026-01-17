'use client';

import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import Navigation from '@/components/Navigation';
import DetectiveTab from '@/components/tabs/DetectiveTab';
import CoPilotTab from '@/components/tabs/CoPilotTab';
import CalibrationTab from '@/components/tabs/CalibrationTab';
import AnalyticsTab from '@/components/tabs/AnalyticsTab';

interface DashboardViewProps {
  onShowLogin: () => void;
  onShowSignup: () => void;
  onBackToHome: () => void;
}

export default function DashboardView({ onBackToHome }: DashboardViewProps) {
  const { user, setUser, currentTab } = useStore();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await authHelpers.signOut();
      setUser(null);
      onBackToHome();
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBackToHome} className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center pulse-glow hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gradient">TalentConsulting.io</h1>
              <p className="text-xs text-slate-500">Interview Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-slate-400">{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/30 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <Navigation />

      {/* Content */}
      <div className="pt-32 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          {currentTab === 'detective' && <DetectiveTab />}
          {currentTab === 'copilot' && <CoPilotTab />}
          {currentTab === 'calibration' && <CalibrationTab />}
          {currentTab === 'analytics' && <AnalyticsTab />}
        </div>
      </div>
    </div>
  );
}
