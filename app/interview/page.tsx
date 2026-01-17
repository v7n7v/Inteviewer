'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function InterviewRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the main dashboard for now
    // You could also create a dedicated interview page here
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-card p-8">
        <p className="text-white">Redirecting...</p>
      </div>
    </div>
  );
}
