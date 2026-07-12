"use client";

import { HistoryItem } from '../types';

interface HistoryScreenProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function HistoryScreen({ history, onSelect }: HistoryScreenProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--paper)]">
      <div className="px-6 pt-5 pb-3">
        <h2 className="font-[family-name:var(--serif)] text-[24px] italic text-[var(--ink)]">Historique</h2>
        <p className="text-[13px] text-[var(--muted)]">{history.length} explication{history.length > 1 ? 's' : ''}</p>
      </div>
      <div className="em-scroll flex-1 overflow-y-auto px-5 pb-5">
        {history.length === 0 ? (
          <p className="pt-10 text-center text-[14px] text-[var(--muted)]">Aucune explication dans l'historique.</p>
        ) : (
          <div className="space-y-0">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="flex w-full items-center gap-3 border-t border-[var(--line)] py-3 text-left"
              >
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-[var(--accent-dim)] font-[family-name:var(--mono)] text-[11px] font-semibold text-[var(--accent)]">
                  {item.term.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-[var(--ink)]">{item.term}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {item.domain} · {formatDate(item.createdAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
