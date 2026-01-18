'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import HeroSection from '@/components/HeroSection';
import AuthModal from '@/components/modals/AuthModal';
import Toast from '@/components/Toast';

export default function Home() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // Check for existing session
    authHelpers.getSession()
      .then(({ session }) => {
        if (session) {
          setUser(session.user);
          // Don't redirect - let user view landing page, they can use "Open Dashboard" button
        }
      })
      .catch((error) => {
        console.error('Session check failed:', error);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth changes - only redirect on actual sign in, not on page load
    // Also check pending2FA to avoid redirecting during 2FA flow
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Get current pending2FA state directly from store
        const isPending2FA = useStore.getState().pending2FA;

        // Always clear user on sign out - this is critical for security
        if (event === 'SIGNED_OUT') {
          setUser(null);
          return;
        }

        // Don't update user state during 2FA flow
        if (!isPending2FA) {
          setUser(session?.user ?? null);
        }

        // Only redirect to hub on actual sign in, not during 2FA
        if (event === 'SIGNED_IN' && session && !isPending2FA) {
          router.push('/hub');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, router]);

  const handleShowLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleShowSignup = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleGetStarted = () => {
    if (user) {
      router.push('/hub');
    } else {
      handleShowSignup();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="scanning-loader mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Hirely.ai...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <HeroSection
        onGetStarted={handleGetStarted}
        onShowLogin={handleShowLogin}
        onShowSignup={handleShowSignup}
        isAuthenticated={!!user}
      />

      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
        />
      )}

      <Toast />
    </main>
  );
}
