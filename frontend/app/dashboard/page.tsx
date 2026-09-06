'use client';

import { AlertCircle, CheckCircle2, Clock, Send, Users } from 'lucide-react';
import React, { useState } from 'react';
import { ComposeEmailModal } from '../../components/ComposeEmailModal';
import { ScheduledEmailsTable } from '../../components/ScheduledEmailsTable';
import { SentEmailsTable } from '../../components/SentEmailsTable';
import { Tabs } from '../../components/ui/Tabs';
import { useScheduledEmails, useSenders, useSentEmails } from '../../hooks/useEmails';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const { data: scheduledData } = useScheduledEmails();
  const { data: sentData } = useSentEmails();
  const { data: senders } = useSenders();

  const scheduledCount = scheduledData?.pagination?.total ?? 0;
  const sentEmails = sentData?.data ?? [];
  const successfulSends = sentEmails.filter((e) => e.status === 'SENT').length;
  const failedSends = sentEmails.filter((e) => e.status === 'FAILED').length;
  const senderCount = senders?.length ?? 0;

  const tabs = [
    {
      id: 'scheduled',
      label: 'Scheduled',
      count: scheduledCount,
    },
    {
      id: 'sent',
      label: 'Sent & History',
      count: sentData?.pagination?.total ?? 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Scheduled Queue</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{scheduledCount}</p>
            <p className="text-[11px] text-blue-400 mt-0.5">BullMQ delayed state</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Sent Successfully</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{successfulSends}</p>
            <p className="text-[11px] text-emerald-400 mt-0.5">Delivered via SMTP</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Failed / Errors</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{failedSends}</p>
            <p className="text-[11px] text-rose-400 mt-0.5">Retries / delivery errors</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Active Senders</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{senderCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Ethereal test accounts</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surfaceHover border border-border flex items-center justify-center text-slate-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 tracking-tight">
              Email Dispatch Monitor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live BullMQ queue state synchronized with PostgreSQL source of truth
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab panels */}
        {activeTab === 'scheduled' ? (
          <ScheduledEmailsTable onOpenCompose={() => setIsComposeOpen(true)} />
        ) : (
          <SentEmailsTable />
        )}
      </div>

      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
}
