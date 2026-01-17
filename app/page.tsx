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
    authHelpers.getSession().then(({ session }) => {
      if (session) {
        setUser(session.user);
        // Don't redirect - let user view landing page, they can use "Open Dashboard" button
      }
      setLoading(false);
    });

    // Listen for auth changes - only redirect on actual sign in, not on page load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        // Only redirect to hub on actual sign in, not when page loads with existing session
        if (event === 'SIGNED_IN' && session) {
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
