'use client';

import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';

interface HeaderProps {
  onShowLogin: () => void;
  onShowSignup: () => void;
}

export default function Header({ onShowLogin, onShowSignup }: HeaderProps) {
  const { user, setUser } = useStore();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await authHelpers.signOut();
      setUser(null);
    }
  };

  return (
    <header className="glass sticky top-0 z-50 border-b border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center neon-glow">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">TalentConsulting.io</h1>
            <p className="text-xs text-slate-400">Interview Intelligence Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs">
            <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={user ? 'text-green-400' : 'text-slate-400'}>
              {user ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-300">
                <span className="text-cyan-400">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium"
              >
                🚪 Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onShowLogin}
                className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium"
              >
                🔐 Login
              </button>
              <button
                onClick={onShowSignup}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-medium"
              >
                ✨ Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
