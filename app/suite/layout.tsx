'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import SuiteSidebar from '@/components/SuiteSidebar';
import AIAssistant from '@/components/AIAssistant';


export default function SuiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Theme-aware background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 theme-base-bg" />
        <div className="absolute inset-0 theme-radial-glow" />
        <div className="mesh-gradient" />
      </div>

      <SuiteSidebar />
      <main className="lg:ml-[280px] min-h-screen transition-all duration-300 relative z-10">
        {children}
      </main>
      <AIAssistant />

    </div>
  );
}
