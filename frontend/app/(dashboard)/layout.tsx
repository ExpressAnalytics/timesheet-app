'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/store/authStore';

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // ms
  } catch { return null; }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token  = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [mounted,        setMounted]        = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Redirect if no token
  useEffect(() => {
    if (mounted && !token) router.push('/login');
  }, [mounted, token, router]);

  // Timer: fire exactly when the token expires
  useEffect(() => {
    if (!token) return;
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const msLeft = expiry - Date.now();
    if (msLeft <= 0) { setSessionExpired(true); return; }
    const timer = setTimeout(() => setSessionExpired(true), msLeft);
    return () => clearTimeout(timer);
  }, [token]);

  // Patch window.fetch to catch any mid-session 401
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 401) setSessionExpired(true);
      return res;
    };
    return () => { window.fetch = original; };
  }, []);

  const handleRelogin = useCallback(() => {
    logout();
    router.push('/login');
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

      {/* Session expired overlay */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-11V7m0 0V5m0 2h2m-2 0H10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-zinc-800 mb-2">Session Expired</h2>
            <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
              Your session has expired after 2 hours of inactivity.<br />
              Please log in again to continue.
            </p>
            <button onClick={handleRelogin}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
              Log in again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
