'use client';

import { useEffect, useState } from 'react';
import { TalentLanding } from '@/components/landing/TalentLanding';
import AuthModal from '@/components/modals/AuthModal';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';

type AuthMode = 'login' | 'signup';

export default function Home() {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [postAuthRedirect, setPostAuthRedirect] = useState('/suite');

  useEffect(() => {
    const unsubscribe = authHelpers.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });

    return unsubscribe;
  }, [setUser]);

  const openAuth = (mode: AuthMode, redirect: string) => {
    setAuthMode(mode);
    setPostAuthRedirect(redirect);
    setShowAuthModal(true);
  };

  const closeAuth = () => {
    setShowAuthModal(false);
  };

  return (
    <>
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
            description: 'A review-first career operating system for resume evidence, role discovery, application packets, interview preparation, and career intelligence.',
            featureList: [
              'Resume Studio and ATS analysis',
              'Evidence-aware job discovery',
              'Application and relationship tracking',
              'Interview practice and story preparation',
              'Taco AI career guidance',
              'Career intelligence and progress analytics',
            ],
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '0',
              priceCurrency: 'USD',
              offerCount: '3',
            },
          }),
        }}
      />

      <TalentLanding isAuthenticated={Boolean(user)} onOpenAuth={openAuth} />

      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={closeAuth}
          onSwitchMode={() => setAuthMode((mode) => mode === 'login' ? 'signup' : 'login')}
          postAuthRedirect={postAuthRedirect}
        />
      )}
    </>
  );
}
