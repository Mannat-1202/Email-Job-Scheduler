'use client';

import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { signIn } from 'next-auth/react';
import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';

export default function LoginPage() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsLoadingDemo(true);
    try {
      await signIn('demo-login', {
        callbackUrl: '/dashboard',
        email: 'alex.mercer@reachinbox.test',
        name: 'Alex Mercer',
      });
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-background">
      <div className="w-full max-w-md space-y-8 bg-surface border border-border p-8 rounded-2xl shadow-xl">
        {/* Logo and header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-xl text-white mx-auto shadow-lg shadow-blue-500/20">
            RI
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            ReachInbox Scheduler
          </h1>
          <p className="text-sm text-slate-400">
            Distributed email dispatch and queue management
          </p>
        </div>

        {/* Feature pillars */}
        <div className="space-y-2 py-2">
          <div className="flex items-center space-x-3 text-xs text-slate-300 p-2.5 rounded-lg bg-surfaceHover/40 border border-border/50">
            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
            <span>BullMQ delayed jobs with Redis & PostgreSQL persistence</span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-300 p-2.5 rounded-lg bg-surfaceHover/40 border border-border/50">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Strict per-sender hourly rate limiting & non-dropping rescheduling</span>
          </div>
        </div>

        {/* Auth options */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle || isLoadingDemo}
            className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-lg bg-surfaceHover hover:bg-slate-800 border border-border text-sm font-medium text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.02h3.87c2.26-2.09 3.675-5.17 3.675-9.12z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12C3.29 21.37 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.61H1.26C.46 8.21 0 10.05 0 12s.46 3.79 1.26 5.39l4.01-3.12z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.63 1.26 6.61l4.01 3.12c.95-2.85 3.6-4.98 6.73-4.98z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-slate-500 font-medium">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={handleDemoSignIn}
            isLoading={isLoadingDemo}
            disabled={isLoadingGoogle || isLoadingDemo}
          >
            <span>Enter as Demo User</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
          <p className="text-[11px] text-center text-slate-500 pt-1">
            Instant evaluation session with pre-provisioned developer environment
          </p>
        </div>
      </div>
    </div>
  );
}
