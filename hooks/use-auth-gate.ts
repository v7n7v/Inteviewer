'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

/**
 * Auth Gate Hook — "Try First, Gate Later"
 * 
 * Usage:
 *   const { requireAuth, showAuth, setShowAuth } = useAuthGate();
 *   <button onClick={() => requireAuth(() => downloadResume())}>Download</button>
 *   {showAuth && <AuthModal mode={showAuth} ... />}
 */
export function useAuthGate() {
  const user = useStore((s) => s.user);
  const [showAuth, setShowAuth] = useState<'login' | 'signup' | null>(null);

  const requireAuth = (callback: () => void) => {
    if (user) {
      callback();
    } else {
      setShowAuth('signup');
    }
  };

  return {
    requireAuth,
    showAuth,
    setShowAuth,
    isAuthenticated: !!user,
    user,
  };
}
