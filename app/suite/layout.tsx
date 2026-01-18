'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHelpers } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import SuiteSidebar from '@/components/SuiteSidebar';
import AIAssistant from '@/components/AIAssistant';
import CommandPalette from '@/components/CommandPalette';

export default function SuiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authHelpers.getSession()
      .then(({ session }) => {
        if (!session) {
          router.push('/');
        } else {
          setUser(session.user);
        }
      })
      .catch((error) => {
        console.error('Session check failed:', error);
        router.push('/');
      })
      .finally(() => {
        setLoading(false);
      });
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
      {/* Black background with dots */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Subtle radial glow at top */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #0A0A0A, #000000)' }}
        />
        {/* Dot grid overlay */}
        <div className="mesh-gradient" />
      </div>

      <SuiteSidebar />
      <main className="lg:ml-[280px] min-h-screen transition-all duration-300 relative z-10">
        {children}
      </main>
      <AIAssistant />
      <CommandPalette />
    </div>
  );
}
