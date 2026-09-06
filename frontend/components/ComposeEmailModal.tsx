'use client';

import { AlertCircle, CheckCircle2, FileText, Plus, UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import React, { useRef, useState } from 'react';
import { useCreateCampaign, useProvisionSender, useSenders } from '../hooks/useEmails';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';

export interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { data: senders = [], isLoading: isSendersLoading } = useSenders();
  const createCampaign = useCreateCampaign();
  const provisionSender = useProvisionSender();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [isCsvMode, setIsCsvMode] = useState(true);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const [startTime, setStartTime] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(50);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Auto-select first sender if available
  React.useEffect(() => {
    if (senders.length > 0 && !selectedSenderId) {
      setSelectedSenderId(senders[0].id);
    }
  }, [senders, selectedSenderId]);

  const handleCsvUpload = (file: File) => {
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const extracted: string[] = [];
        for (const row of results.data) {
          const emailVal =
            row.email ||
            row.Email ||
            row.EMAIL ||
            row.recipient ||
            row.Recipient ||
            Object.values(row)[0];
          if (emailVal && typeof emailVal === 'string' && emailVal.includes('@')) {
            extracted.push(emailVal.trim().toLowerCase());
          }
        }
        const unique = Array.from(new Set(extracted));
        setRecipients(unique);
        setValidationError(null);
      },
      error: (err) => {
        setValidationError(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleRawTextChange = (text: string) => {
    setRawTextRecipients(text);
    const parsed = Array.from(
      new Set(
        text
          .split(/[\n,]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.includes('@'))
      )
    );
    setRecipients(parsed);
  };

  const handleCreateSender = async () => {
    try {
      const newSender = await provisionSender.mutateAsync();
      setSelectedSenderId(newSender.id);
    } catch (err: any) {
      setValidationError(`Could not provision Ethereal account: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessInfo(null);

    if (!subject.trim()) {
      setValidationError('Please enter a subject line');
      return;
    }

    if (!body.trim()) {
      setValidationError('Please enter email body content');
      return;
    }

    if (recipients.length === 0) {
      setValidationError('Please provide at least one valid recipient email address');
      return;
    }

    try {
      const scheduledIso = startTime ? new Date(startTime).toISOString() : new Date().toISOString();
      const delayMs = Math.max(1000, delaySeconds * 1000);

      const result = await createCampaign.mutateAsync({
        senderId: selectedSenderId || undefined,
        subject,
        body,
        recipients,
        startTime: scheduledIso,
        delayMs,
        hourlyLimit,
      });

      setSuccessInfo(
        `Successfully scheduled ${result.recipients} emails. BullMQ job sequence queued.`
      );

      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset form
        setSubject('');
        setBody('');
        setRecipients([]);
        setRawTextRecipients('');
        setCsvFileName(null);
        setSuccessInfo(null);
      }, 1200);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to schedule campaign');
    }
  };

  const senderOptions = senders.map((s) => ({
    label: `${s.email} (${s.smtpHost})`,
    value: s.id,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose and Schedule Campaign"
      description="Queue cold emails with deterministic idempotency, min-delay throttling, and rate limiting"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {validationError && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{validationError}</span>
          </div>
        )}

        {successInfo && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Sender Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Sender Account</label>
            <button
              type="button"
              onClick={handleCreateSender}
              disabled={provisionSender.isPending}
              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 focus:outline-none"
            >
              <Plus className="w-3 h-3" />
              <span>Auto-Provision Ethereal Account</span>
            </button>
          </div>

          {senders.length > 0 ? (
            <Select
              options={senderOptions}
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              disabled={isSendersLoading}
            />
          ) : (
            <div className="p-3 border border-border rounded-lg bg-surface/50 flex items-center justify-between text-xs text-slate-400">
              <span>No sender configured. One will be auto-created for this campaign.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCreateSender}
                isLoading={provisionSender.isPending}
              >
                Provision Now
              </Button>
            </div>
          )}
        </div>

        {/* Subject */}
        <Input
          label="Subject Line"
          placeholder="e.g. Scaling outreach infrastructure efficiently"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        {/* Body */}
        <Textarea
          label="Email Body (Plain Text or Markdown)"
          placeholder="Write your email copy here..."
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />

        {/* Recipients input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Recipients</label>
            <div className="flex space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setIsCsvMode(true)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  isCsvMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CSV Upload
              </button>
              <button
                type="button"
                onClick={() => setIsCsvMode(false)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  !isCsvMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manual Paste
              </button>
            </div>
          </div>

          {isCsvMode ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-slate-500 rounded-lg p-5 text-center cursor-pointer transition-colors bg-surfaceHover/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvUpload(file);
                }}
              />
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-200">
                {csvFileName ? csvFileName : 'Click to upload recipient CSV file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Columns: email, recipient, or raw email addresses
              </p>
            </div>
          ) : (
            <Textarea
              placeholder="Paste email addresses separated by commas or line breaks..."
              rows={3}
              value={rawTextRecipients}
              onChange={(e) => handleRawTextChange(e.target.value)}
            />
          )}

          {recipients.length > 0 && (
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded bg-surface border border-border">
              <span className="font-medium text-emerald-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {recipients.length.toLocaleString()} recipients detected
              </span>
              <span className="text-slate-400 text-[11px] truncate max-w-xs">
                Sample: {recipients.slice(0, 3).join(', ')}
                {recipients.length > 3 ? '...' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Scheduling Constraints */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <Input
            label="Start Time (Optional)"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            helperText="Leave empty to start immediately"
          />

          <Input
            label="Delay Between Sends"
            type="number"
            min={1}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value) || 2)}
            helperText="Minimum throttle interval (seconds)"
          />

          <Input
            label="Hourly Rate Limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value) || 50)}
            helperText="Max emails/hour for sender"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={createCampaign.isPending}
            disabled={createCampaign.isPending || recipients.length === 0}
          >
            Schedule Campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
};
