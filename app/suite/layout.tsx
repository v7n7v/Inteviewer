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
    authHelpers.getSession().then(({ session }) => {
      if (!session) {
        router.push('/');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });
  }, [router, setUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="scanning-loader mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Talent Suite...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <SuiteSidebar />
      <main className="lg:ml-[280px] min-h-screen transition-all duration-300">
        {children}
      </main>
      <AIAssistant />
      <CommandPalette />
    </div>
  );
}
