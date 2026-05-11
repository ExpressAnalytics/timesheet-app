'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';

// 2 hours of no activity → auto logout
const IDLE_MS = 2 * 60 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const token   = useAuthStore((s) => s.token);
  const logout  = useAuthStore((s) => s.logout);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Redirect immediately if no token
  useEffect(() => {
    if (mounted && !token) router.push('/login');
  }, [mounted, token, router]);

  // Inactivity timer — resets on any user activity
  useEffect(() => {
    if (!token) return;

    let idleTimer: ReturnType<typeof setTimeout>;

    const handleActivity = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        logout();
        router.push('/login?reason=idle');
      }, IDLE_MS);
    };

    // Start the timer immediately
    handleActivity();

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [token, logout, router]);

  // Safety net: any 401 → logout + redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 401) {
        logout();
        router.push('/login?reason=session');
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, [logout, router]);

  if (!mounted) return <div className="flex min-h-[100dvh] bg-[#fafafa]" />;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-[#fafafa] text-zinc-500">
        <div className="flex items-center gap-3 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
          </span>
          Redirecting to sign in…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] bg-[#fafafa]">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[#fafafa]">{children}</main>
    </div>
  );
}
