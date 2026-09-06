import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
}

export function Table<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found',
  emptyAction,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto border border-border rounded-xl bg-surface">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-surfaceHover/50 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-border">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="animate-pulse">
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-4">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full border border-border rounded-xl bg-surface p-12 text-center">
        <div className="max-w-sm mx-auto space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-surfaceHover border border-border flex items-center justify-center text-slate-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-300">{emptyMessage}</p>
          {emptyAction && <div className="pt-2">{emptyAction}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-border rounded-xl bg-surface">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="bg-surfaceHover/50 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-border">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-5 py-3.5 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, index) => (
            <tr
              key={item.id || index}
              className="hover:bg-surfaceHover/30 transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.render ? col.render(item, index) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
