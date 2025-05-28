'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login'); // Redirect to login page immediately
  }, [router]);

  return null; // Optionally render nothing, since it's redirecting
}