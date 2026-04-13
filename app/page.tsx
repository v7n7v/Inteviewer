'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { setUser } = useStore();

  useEffect(() => {
    // Listen for real Firebase auth state — if already signed in, hydrate store
    const unsub = authHelpers.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      router.replace('/suite');
    });
    return () => unsub();
  }, [setUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="scanning-loader" />
    </div>
  );
}
