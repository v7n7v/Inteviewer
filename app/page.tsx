'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHelpers } from '@/lib/firebase';
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
    // Safety timeout — never stay blank for more than 3s
    const fallback = setTimeout(() => setLoading(false), 3000);

    const unsubscribe = authHelpers.onAuthStateChanged((firebaseUser) => {
      clearTimeout(fallback);
      if (firebaseUser) {
        setUser(firebaseUser);
        router.replace('/suite');
        // Don't keep loading=true — if redirect is slow, show landing page
        setTimeout(() => setLoading(false), 500);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => {
      clearTimeout(fallback);
      unsubscribe();
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
      router.push('/suite');
    } else {
      handleShowSignup();
    }
  };

  // While checking auth, show loader with visible spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="scanning-loader" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated users see the full landing page
  return (
    <main className="min-h-screen">
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Talent Studio',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: 'https://talentconsulting.io',
            description: 'Free AI text humanizer and detector — bypass AI detection in one click. Build ATS-optimized resumes, practice with AI interviewers, get smart job recommendations, and access 22+ career intelligence tools.',
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '0',
              highPrice: '9.99',
              priceCurrency: 'USD',
              offerCount: '3',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.9',
              reviewCount: '2847',
            },
          }),
        }}
      />

      <HeroSection
        onGetStarted={handleGetStarted}
        onShowLogin={handleShowLogin}
        onShowSignup={handleShowSignup}
        isAuthenticated={!!user}
      />

      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => {
            setShowAuthModal(false);
            const currentUser = useStore.getState().user;
            if (currentUser) router.push('/suite');
          }}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
        />
      )}

      <Toast />
    </main>
  );
}
