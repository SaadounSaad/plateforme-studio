"use client";

import { ExplanationResult, IterationAction } from '../types';

interface ResponseScreenProps {
  result: ExplanationResult | null;
  loading: boolean;
  error: string | null;
  query: string;
  onBack: () => void;
  onIterate: (action: Exclude<IterationAction, 'Enregistrer dans Obsidian'>) => void;
  onSave: () => void;
}

export function ResponseScreen({ result, loading, error, query, onBack, onIterate, onSave }: ResponseScreenProps) {
  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[var(--paper)] p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--line)] text-[var(--ink)]">←</button>
          <span className="font-[family-name:var(--mono)] text-[12px] tracking-wider text-[var(--muted)]">{query}</span>
        </div>
        <div className="flex-1 space-y-4 rounded-[20px] border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--line)]"></div>
          <div className="h-4 w-1/4 animate-pulse rounded bg-[var(--line)]"></div>
          <div className="mt-4 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]"></div>
            <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]"></div>
            <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--line)]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col bg-[var(--paper)] p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--line)] text-[var(--ink)]">←</button>
        </div>
        <div className="rounded-[20px] border border-red-300/30 bg-red-50 p-5 text-center">
          <div className="mb-2 text-[15px] font-medium text-red-700">Erreur</div>
          <p className="text-[13px] text-[var(--muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--paper)] p-6 text-center">
        <p className="text-[14px] text-[var(--muted)]">Aucune explication à afficher.</p>
        <button onClick={onBack} className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-semibold text-[var(--ink-light)]">
          Poser une question
        </button>
      </div>
    );
  }

  const confidenceValue = result.confidence.match(/(\d+)%/)?.[1] || '';

  return (
    <div className="flex h-full flex-col bg-[var(--paper)]">
      <div className="flex items-center gap-2.5 px-5 pt-3">
        <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--line)] text-[var(--ink)]">←</button>
        <span className="truncate font-[family-name:var(--mono)] text-[12px] tracking-wider text-[var(--muted)]">{query}</span>
      </div>

      <div className="flex gap-2 px-5 pb-2 pt-2">
        <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-1 font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.16em] text-[var(--accent)]">
          {result.domain}
        </span>
        {confidenceValue && (
          <span className="rounded-full bg-[rgba(90,138,90,0.08)] px-2.5 py-1 font-[family-name:var(--mono)] text-[9px] uppercase tracking-wider text-[var(--success)]">
            Confiance {confidenceValue}%
          </span>
        )}
      </div>

      <div className="em-scroll mx-4 mb-3 flex-1 overflow-y-auto rounded-[20px] border border-[var(--line)] bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-[family-name:var(--serif)] text-[26px] font-normal italic leading-tight text-[var(--ink)]">
          {result.term}
        </h2>
        <div className="mb-4 font-[family-name:var(--mono)] text-[9.5px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {result.domain}
        </div>

        <div className="mb-5 text-[13.5px] leading-relaxed text-[var(--ink)]/75 whitespace-pre-line">
          {result.explanation}
        </div>

        {result.analogy && (
          <div className="mb-5 rounded-r-xl border-l-2 border-[var(--accent)] bg-[var(--accent-dim)] py-3.5 pr-4 pl-4">
            <div className="mb-2 font-[family-name:var(--mono)] text-[8.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Analogie
            </div>
            <p className="font-[family-name:var(--serif)] text-[13px] italic leading-relaxed text-[var(--ink)]/65">
              {result.analogy}
            </p>
          </div>
        )}

        {result.takeaway && (
          <div className="mb-5 rounded-xl border border-[rgba(156,106,60,0.12)] bg-[rgba(156,106,60,0.05)] p-3.5">
            <div className="mb-1.5 font-[family-name:var(--mono)] text-[8.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
              À retenir
            </div>
            <p className="text-[13px] font-semibold leading-relaxed text-[var(--ink)]">{result.takeaway}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
          <span className="rounded-full bg-[var(--accent-dim)] px-2 py-1 font-[family-name:var(--mono)] text-[9px] tracking-wider text-[var(--muted)]">
            {result.model}
          </span>
          <span className="rounded-full bg-[var(--accent-dim)] px-2 py-1 font-[family-name:var(--mono)] text-[9px] tracking-wider text-[var(--muted)]">
            Domaine détecté: {result.domain}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 pb-7">
        <button
          onClick={() => onIterate('Approfondir')}
          className="rounded-xl border border-[var(--line)] bg-white py-3 text-center text-[12px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          Approfondir
          <span className="mt-1 block font-[family-name:var(--mono)] text-[9px] font-normal tracking-wider text-[var(--muted)]">
            + de détails
          </span>
        </button>
        <button
          onClick={() => onIterate('Simplifier davantage')}
          className="rounded-xl border border-[var(--line)] bg-white py-3 text-center text-[12px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          Simplifier
          <span className="mt-1 block font-[family-name:var(--mono)] text-[9px] font-normal tracking-wider text-[var(--muted)]">
            version enfant
          </span>
        </button>
        <button
          onClick={onSave}
          className="rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] py-3 text-center text-[12px] font-semibold text-[var(--ink-light)] transition-opacity hover:opacity-90"
        >
          Enregistrer
          <span className="mt-1 block font-[family-name:var(--mono)] text-[9px] font-normal tracking-wider text-[var(--ink-light)]/80">
            → Drive
          </span>
        </button>
      </div>
    </div>
  );
}
