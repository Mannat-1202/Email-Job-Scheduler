'use client';

import React, { useState } from 'react';
import { ComposeEmailModal } from '../../components/ComposeEmailModal';
import { Header } from '../../components/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onOpenCompose={() => setIsComposeOpen(true)} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {children}
      </main>
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
}
