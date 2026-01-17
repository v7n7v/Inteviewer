'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Detective tab by default
    router.push('/dashboard/detective');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="scanning-loader"></div>
    </div>
  );
}
