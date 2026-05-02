'use client';

import { useEffect, useState } from 'react';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import { getUserProfile } from '@/lib/database-suite';
import SuiteSidebar from '@/components/SuiteSidebar';
import SonaFloatingOrb from '@/components/SonaFloatingOrb';
import OnboardingModal from '@/components/modals/OnboardingModal';

export default function SuiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, setUserProfile } = useStore();
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Real Firebase auth listener — sets user or null
    const unsub = authHelpers.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Load profile + check onboarding status
        try {
          const { data } = await getUserProfile();
          if (data) {
            setUserProfile(data);
            if (!data.onboarding_completed && localStorage.getItem('tc_hide_onboarding') !== 'true') {
              setShowOnboarding(true);
            }
          } else {
            // No profile doc yet → new user, show onboarding
            if (localStorage.getItem('tc_hide_onboarding') !== 'true') {
              setShowOnboarding(true);
            }
          }
        } catch {
          // Profile fetch failed — don't block the user
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });
    return () => unsub();
  }, [setUser, setUserProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="scanning-loader" />
      </div>
    );
  }

  // Freemium: allow unauthenticated users to browse the dashboard
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <SuiteSidebar />
      <main className="lg:ml-[250px] min-h-screen transition-[margin] duration-200 pt-14 lg:pt-0 overflow-x-hidden">
        {children}
      </main>
      <SonaFloatingOrb />

      {showOnboarding && (
        <OnboardingModal
          userName={useStore.getState().user?.displayName || ''}
          onComplete={() => setShowOnboarding(false)}
          onClose={() => setShowOnboarding(false)}
          onDismissPermanently={() => {
            localStorage.setItem('tc_hide_onboarding', 'true');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
}
