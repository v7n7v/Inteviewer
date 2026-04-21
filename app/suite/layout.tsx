'use client';

import { useEffect, useState } from 'react';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import SuiteSidebar from '@/components/SuiteSidebar';
import SonaFloatingOrb from '@/components/SonaFloatingOrb';

export default function SuiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real Firebase auth listener — sets user or null
    const unsub = authHelpers.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, [setUser]);

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
      <main className="lg:ml-[250px] min-h-screen transition-[margin] duration-200">
        {children}
      </main>
      <SonaFloatingOrb />
    </div>
  );
}
