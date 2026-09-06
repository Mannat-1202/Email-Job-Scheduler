'use client';

import { AlertTriangle, CheckCircle, ExternalLink, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useSentEmails } from '../hooks/useEmails';
import { Email } from '../types';
import { Badge } from './ui/Badge';
import { Table } from './ui/Table';

export const SentEmailsTable: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED'>('ALL');
  const { data, isLoading, isError, error } = useSentEmails();

  const allEmails = data?.data || [];

  const filteredEmails = React.useMemo(() => {
    return allEmails.filter((e) => {
      const matchesStatus =
        statusFilter === 'ALL' || e.status === statusFilter;
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.recipientEmail.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        (e.error && e.error.toLowerCase().includes(q))
      );
    });
  }, [allEmails, searchQuery, statusFilter]);

  const extractPreviewUrl = (errorStr: string | null) => {
    if (!errorStr) return null;
    const match = errorStr.match(/Preview:\s*(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
  };

  const columns = [
    {
      key: 'recipientEmail',
      header: 'Recipient',
      render: (email: Email) => (
        <div>
          <div className="font-medium text-slate-100">{email.recipientEmail}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-xs">{email.subject}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (email: Email) => (
        <div className="flex items-center space-x-2">
          <Badge status={email.status} />
          {email.status === 'SENT' ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          )}
        </div>
      ),
    },
    {
      key: 'sentTime',
      header: 'Delivered At',
      render: (email: Email) => {
        if (!email.sentTime) {
          return <span className="text-xs text-slate-500">Not delivered</span>;
        }
        const date = new Date(email.sentTime);
        return <span className="text-xs text-slate-300">{date.toLocaleString()}</span>;
      },
    },
    {
      key: 'deliveryDetails',
      header: 'Ethereal / Delivery Info',
      render: (email: Email) => {
        const previewUrl = extractPreviewUrl(email.error);

        if (previewUrl) {
          return (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              <span>View in Ethereal Inbox</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          );
        }

        if (email.status === 'FAILED') {
          return (
            <span className="text-xs text-red-400 truncate max-w-xs block" title={email.error || ''}>
              {email.error || 'Send failed'}
            </span>
          );
        }

        return <span className="text-xs text-slate-400">Delivered via SMTP</span>;
      },
    },
  ];

  if (isError) {
    return (
      <div className="p-6 border border-red-800/60 bg-red-950/20 rounded-xl text-center text-sm text-red-300">
        Failed to load delivered emails: {(error as Error)?.message || 'Server connection error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search recipients or copy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status filter buttons */}
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            {(['ALL', 'SENT', 'FAILED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === filter
                    ? 'bg-surfaceHover text-slate-100 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Showing {filteredEmails.length} delivered records
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredEmails}
        isLoading={isLoading}
        emptyMessage="No sent or processed emails recorded yet."
      />
    </div>
  );
};
