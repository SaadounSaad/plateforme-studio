"use client";

import { ExplanationResult } from '../types';

interface ResultPanelProps {
  result: ExplanationResult | null;
  loading: boolean;
  error: string | null;
  onIterate: (action: 'Approfondir' | 'Simplifier davantage') => void;
  onSave: () => void;
}

export function ResultPanel({ result, loading, error, onIterate, onSave }: ResultPanelProps) {
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <div className="h-6 w-1/3 animate-pulse rounded bg-muted/20" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted/20" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted/20" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/20" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/20" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div className="text-[15px] font-medium text-red-400">Erreur</div>
        <p className="text-[13.5px] text-muted">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line bg-surface/50 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1.26A6.98 6.98 0 0 1 5 10a7 7 0 0 1 7-7z" />
            <path d="M9 21h6" />
          </svg>
        </div>
        <div className="text-[15px] font-medium text-fg">Prêt à expliquer</div>
        <p className="max-w-sm text-[13px] text-muted">
          Saisis un terme ou une comparaison à gauche. ExpliqueMoi générera une réponse claire, une analogie et un point clé.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-surface">
      <div className="border-b border-line p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold">
            {result.domain}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
            {result.model}
          </span>
        </div>
        <h2 className="mt-3 font-serif text-[clamp(1.6rem,4vw,2.4rem)] leading-tight text-fg">
          {result.term}
        </h2>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Explication</h3>
          <div className="text-[15px] leading-relaxed text-fg">{result.explanation}</div>
        </section>

        {result.analogy && (
          <section className="rounded-xl border border-gold/20 bg-gold/5 p-4">
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gold">Analogie</h3>
            <p className="text-[14px] leading-relaxed text-fg/90">{result.analogy}</p>
          </section>
        )}

        {result.takeaway && (
          <section>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">À retenir</h3>
            <p className="border-l-2 border-gold/40 pl-4 text-[14px] font-medium leading-relaxed text-fg">
              {result.takeaway}
            </p>
          </section>
        )}

        <p className="text-[12px] text-muted/80">{result.confidence}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line p-4">
        <button
          onClick={() => onIterate('Approfondir')}
          className="flex-1 rounded-lg border border-line bg-surface2 px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:border-gold/40 hover:text-gold"
        >
          Approfondir
        </button>
        <button
          onClick={() => onIterate('Simplifier davantage')}
          className="flex-1 rounded-lg border border-line bg-surface2 px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:border-gold/40 hover:text-gold"
        >
          Simplifier
        </button>
        <button
          onClick={onSave}
          className="flex-1 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-bg transition-colors hover:bg-gold/90"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
