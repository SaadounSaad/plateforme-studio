"use client";

import { useState } from 'react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPanel({ history, onRestore, onDelete, onClear }: HistoryPanelProps) {
  const [search, setSearch] = useState('');

  const filtered = history.filter(
    (item) =>
      item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.domain.toLowerCase().includes(search.toLowerCase())
  );

  if (history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface/50 p-6 text-center">
        <p className="text-[13.5px] text-muted">Aucune explication dans l'historique.</p>
        <p className="text-[12px] text-muted/70">Vos questions et réponses apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-surface">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans l'historique…"
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-fg placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
          />
          <button
            onClick={onClear}
            className="whitespace-nowrap rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition-colors hover:border-red-400/50 hover:text-red-400"
          >
            Tout supprimer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-[13px] text-muted">Aucun résultat.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-lg border border-line bg-bg p-3 transition-colors hover:border-gold/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onRestore(item)}
                    className="flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-[15px] italic text-fg">{item.term}</span>
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                        {item.domain}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>·</span>
                      <span>{item.level === 'simple' ? 'Simple' : 'Approfondi'}</span>
                      <span>·</span>
                      <span className="font-mono">{item.model}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded p-1.5 text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
