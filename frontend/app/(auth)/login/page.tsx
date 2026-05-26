'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled:   'Google sign-in was cancelled.',
  google_failed:      'Google sign-in failed. Please try again.',
  wrong_domain:       'Only @expressanalytics.net Google accounts are allowed.',
  no_account:         'No TimeSync account found for this Google account.',
  google_not_enabled: 'Google sign-in is not enabled for your account.',
  idle:               'You were logged out due to 2 hours of inactivity. Please log in again.',
  session:            'Your session expired. Please log in again.',
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(GOOGLE_ERRORS[err] ?? 'Sign-in failed. Please try again.');
  }, [searchParams]);

  const handleGoogle = (e: React.MouseEvent) => {
    e.preventDefault();
    setChecking(true);
    window.location.href = `${API}/auth/google`;
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr] bg-[#fafafa] text-zinc-900">

      {/* ── Left — brand canvas (desktop only) */}
      <aside className="hidden lg:flex relative flex-col justify-between p-12 overflow-hidden bg-zinc-950 text-zinc-100">
        <div
          className="absolute inset-0 opacity-[0.55] animate-breathe pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 75% 25%, rgba(37,99,235,0.35), transparent 60%),' +
              'radial-gradient(50% 40% at 20% 80%, rgba(29,78,216,0.22), transparent 60%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
          aria-hidden
        />

        <div className="relative inline-flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">TimeSync</p>
            <p className="text-[11px] font-medium text-zinc-400">Express Analytics</p>
          </div>
        </div>

        <div className="relative max-w-[440px] space-y-6">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
            Hours, accounted for
          </p>
          <h2 className="text-[44px] leading-[1.04] tracking-tight font-semibold">
            Track time the way<br />your team already works.
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-400 max-w-[44ch]">
            Tied directly to your Jira sprint. No double entry, no spreadsheet
            export, nothing to remember on Friday afternoon.
          </p>
        </div>

        <div className="relative flex items-center gap-3 text-[12px] text-zinc-500">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" aria-hidden />
          <span>All systems operational</span>
          <span className="text-zinc-700">·</span>
          <span className="font-mono text-zinc-500">v2.4.1</span>
        </div>
      </aside>

      {/* ── Right — sign-in form */}
      <main className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-[400px] space-y-8">

          {/* Mobile-only brand */}
          <div className="lg:hidden flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 8v4l2.5 1.5" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-zinc-900 tracking-tight">TimeSync</p>
              <p className="text-[11px] font-medium text-zinc-500">Express Analytics</p>
            </div>
          </div>

          <div className="space-y-2 animate-rise-in">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">Sign in</p>
            <h1 className="text-[28px] leading-[1.15] tracking-tight font-semibold text-zinc-900">
              Welcome back.
            </h1>
          </div>

          <div className="space-y-4">
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl text-[12.5px] bg-[rgba(185,28,28,0.05)] border border-[rgba(185,28,28,0.18)] text-[#991b1b] animate-rise-in"
              >
                <svg className="w-4 h-4 mt-px shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Continue with Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={checking}
              className="tactile flex items-center justify-center gap-3 w-full h-12 rounded-xl bg-white border border-zinc-200 text-[14px] font-medium text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checking ? (
                <svg className="w-[18px] h-[18px] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="#9ca3af" strokeWidth="2.5" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <p className="text-[11.5px] text-zinc-500 text-center">
              Only <span className="font-mono text-zinc-700">@expressanalytics.net</span> accounts are allowed.
            </p>
          </div>

          <p className="text-[12.5px] text-zinc-500">
            Trouble signing in? Email{' '}
            <a
              href="mailto:admin@expressanalytics.net"
              className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              admin@expressanalytics.net
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
