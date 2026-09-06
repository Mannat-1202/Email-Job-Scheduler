'use client';

import { Activity, ExternalLink, LogOut, MessageSquare, Plus } from 'lucide-react';
import React, { useState } from 'react';
import { useCurrentUser } from '../hooks/useEmails';
import { SlackModal } from './SlackModal';
import { Button } from './ui/Button';

export interface HeaderProps {
  onOpenCompose: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCompose }) => {
  const { data: user } = useCurrentUser();
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);

  const bullBoardUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/admin/queues`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white tracking-tight">
            RI
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-100 text-sm tracking-tight">
                ReachInbox
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surfaceHover border border-border text-slate-400">
                Scheduler
              </span>
            </div>
          </div>
        </div>

        {/* Actions & Integration Links */}
        <div className="flex items-center space-x-3">
          {/* Bull-Board Live Queues Link */}
          <a
            href={bullBoardUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-slate-300 hover:bg-surfaceHover hover:text-slate-100 transition-colors"
            title="Open Bull-Board Live Queue Visualizer"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Live Queues</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          {/* Slack Integration Button */}
          <button
            onClick={() => setIsSlackModalOpen(true)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              user?.slackConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50'
                : 'bg-surface hover:bg-surfaceHover text-slate-300 border-border'
            }`}
            title="Manage Slack Workspace Integration"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#E01E5A]" />
            <span>{user?.slackConnected ? 'Slack Active' : 'Connect Slack'}</span>
          </button>

          {/* Compose Email Trigger */}
          <Button size="sm" onClick={onOpenCompose}>
            <Plus className="w-4 h-4 mr-1" />
            <span>Compose Email</span>
          </Button>

          {/* User Profile */}
          <div className="flex items-center pl-3 border-l border-border space-x-2.5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-border flex items-center justify-center text-xs font-semibold text-slate-300">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-slate-200 leading-tight">
                {user?.name || 'Developer'}
              </p>
              <p className="text-[11px] text-slate-400 truncate max-w-[140px] leading-tight">
                {user?.email || 'dev@reachinbox.test'}
              </p>
            </div>
            <a
              href="/login"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surfaceHover transition-colors"
              title="Sign Out / Switch User"
            >
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <SlackModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
      />
    </header>
  );
};
