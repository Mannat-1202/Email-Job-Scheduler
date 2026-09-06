'use client';

import { Clock, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useScheduledEmails } from '../hooks/useEmails';
import { Email } from '../types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Table } from './ui/Table';

export interface ScheduledEmailsTableProps {
  onOpenCompose: () => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({ onOpenCompose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, isError, error } = useScheduledEmails();

  const allEmails = data?.data || [];

  const filteredEmails = React.useMemo(() => {
    if (!searchQuery.trim()) return allEmails;
    const q = searchQuery.toLowerCase();
    return allEmails.filter(
      (e) =>
        e.recipientEmail.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.bullJobId.toLowerCase().includes(q)
    );
  }, [allEmails, searchQuery]);

  const columns = [
    {
      key: 'recipientEmail',
      header: 'Recipient',
      render: (email: Email) => (
        <div className="font-medium text-slate-100">{email.recipientEmail}</div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (email: Email) => (
        <div className="truncate max-w-xs text-slate-300" title={email.subject}>
          {email.subject}
        </div>
      ),
    },
    {
      key: 'scheduledTime',
      header: 'Scheduled For',
      render: (email: Email) => {
        const date = new Date(email.scheduledTime);
        return (
          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{date.toLocaleString()}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (email: Email) => <Badge status={email.status} />,
    },
    {
      key: 'bullJobId',
      header: 'Queue Job ID',
      render: (email: Email) => (
        <span className="font-mono text-xs text-slate-400 bg-surfaceHover px-2 py-0.5 rounded border border-border">
          {email.bullJobId}
        </span>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="p-6 border border-red-800/60 bg-red-950/20 rounded-xl text-center text-sm text-red-300">
        Failed to load scheduled emails: {(error as Error)?.message || 'Server connection error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter scheduled emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing {filteredEmails.length} queued jobs (Live auto-refresh every 5s)
        </div>
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={filteredEmails}
        isLoading={isLoading}
        emptyMessage="No pending emails currently scheduled."
        emptyAction={
          <Button size="sm" onClick={onOpenCompose}>
            Compose First Campaign
          </Button>
        }
      />
    </div>
  );
};
