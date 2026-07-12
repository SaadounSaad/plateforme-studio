"use client";

import { useState } from 'react';
import { Domain, Level, IterationAction, HistoryItem, ExplanationResult } from '../types';
import { LEVELS, DOMAINS, MODELS, DEFAULT_MODEL } from '../lib/constants';
import { buildObsidianNote, buildFilePath, downloadMarkdown } from '../lib/formatters';
import { useDrive } from '../hooks/useDrive';

interface DesktopLayoutProps {
  result: ExplanationResult | null;
  loading: boolean;
  error: string | null;
  history: HistoryItem[];
  onExplain: (term: string, level: Level, domain: Domain | '', model: string) => void;
  onPickRecent: (item: HistoryItem) => void;
  onIterate: (action: Exclude<IterationAction, 'Enregistrer dans Obsidian'>) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function DesktopLayout({ result, loading, error, history, onExplain, onPickRecent, onIterate }: DesktopLayoutProps) {
  const [term, setTerm] = useState('');
  const [level, setLevel] = useState<Level>('simple');
  const [domain, setDomain] = useState<Domain | ''>('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showSave, setShowSave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { isSignedIn, loading: driveLoading, error: driveError, login, saveFile, configured } = useDrive();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    onExplain(term.trim(), level, domain, model);
  };

  const handleDownload = () => {
    if (!result) return;
    const fileName = `${result.term.replace(/[^a-zA-Z0-9\u00C0-\u017F]+/g, '-').toLowerCase()}.md`;
    downloadMarkdown(buildObsidianNote(result), fileName);
    setShowSave(false);
  };

  const handleSaveToDrive = async () => {
    if (!result) return;
    const fileName = `${result.term.replace(/[^a-zA-Z0-9\u00C0-\u017F]+/g, '-').toLowerCase()}.md`;
    await saveFile(fileName, buildObsidianNote(result));
  };

  const confidenceValue = result?.confidence.match(/(\d+)%/)?.[1] || '';
  const filePath = result ? buildFilePath(result) : '';
  const pathParts = filePath.split('/');

  return (
    <div className="flex min-h-screen bg-[var(--stage)]">
      {/* Left sidebar */}
      <aside className="sticky top-0 flex h-screen w-[360px] flex-col border-r border-[var(--line)] bg-[var(--paper)] px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-[15px] font-bold text-[var(--ink-light)]">
              ?
            </div>
            <span className="font-[family-name:var(--serif)] text-[22px] italic leading-none text-[var(--ink)]">
              Explique<em className="text-[var(--accent)]">Moi</em>
            </span>
          </div>
          <a href="/" className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--accent)]">
            ← Studio
          </a>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <textarea
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              rows={3}
              placeholder="Tapez un terme… (ex: API vs MCP)"
              className="w-full resize-none rounded-2xl border border-[var(--line)] bg-white p-3.5 pr-10 text-[14px] text-[var(--ink)] outline-none placeholder:text-[#b5aa9d]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">Domaine</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDomain('')}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                  domain === '' ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink-light)]' : 'border-[var(--line)] text-[var(--muted)]'
                }`}
              >
                Tous
              </button>
              {DOMAINS.filter((d) => d.value).map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDomain(d.value as Domain)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                    domain === d.value ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink-light)]' : 'border-[var(--line)] text-[var(--muted)]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">Niveau</span>
              <div className="flex rounded-lg border border-[var(--line)] p-1">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLevel(l.value)}
                    className={`flex-1 rounded-md py-1.5 text-[11px] font-medium ${
                      level === l.value ? 'bg-[var(--accent)] text-[var(--ink-light)]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">Modèle</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[11px] text-[var(--ink)] outline-none"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!term.trim() || loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] px-4 py-3 text-[14px] font-semibold text-[var(--ink-light)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Explication…' : 'Expliquer'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <span className="font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">Historique</span>
          <button onClick={() => setShowHistory(true)} className="text-[11px] text-[var(--accent)] hover:underline">Voir tout</button>
        </div>
        <div className="em-scroll mt-3 flex-1 space-y-0 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-[12px] text-[var(--muted)]">Aucun élément.</p>
          ) : (
            history.slice(0, 8).map((item) => (
              <button
                key={item.id}
                onClick={() => onPickRecent(item)}
                className="flex w-full items-center gap-3 border-t border-[var(--line)] py-2.5 text-left"
              >
                <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-[var(--accent-dim)] font-[family-name:var(--mono)] text-[10px] font-semibold text-[var(--accent)]">
                  {item.term.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-[var(--ink)]">{item.term}</div>
                  <div className="text-[10px] text-[var(--muted)]">{item.domain} · {formatDate(item.createdAt)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {!result && !loading && !error && (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--paper)]/50 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1.26A6.98 6.98 0 0 1 5 10a7 7 0 0 1 7-7z" />
                <path d="M9 21h6" />
              </svg>
            </div>
            <h2 className="font-[family-name:var(--serif)] text-[28px] italic text-[var(--ink)]">Prêt à expliquer</h2>
            <p className="max-w-md text-[14px] text-[var(--muted)]">Saisissez un terme dans la barre latérale. ExpliqueMoi générera une réponse claire avec analogie et point clé.</p>
          </div>
        )}

        {loading && (
          <div className="flex h-full flex-col gap-4 rounded-[24px] border border-[var(--line)] bg-[var(--paper)] p-8">
            <div className="h-7 w-1/4 animate-pulse rounded bg-[var(--line)]"></div>
            <div className="h-4 w-1/6 animate-pulse rounded bg-[var(--line)]"></div>
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]"></div>
              <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]"></div>
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--line)]"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-red-300/30 bg-red-50 p-8 text-center">
            <div className="mb-2 text-[16px] font-medium text-red-700">Erreur</div>
            <p className="text-[14px] text-[var(--muted)]">{error}</p>
          </div>
        )}

        {result && (
          <div className="mx-auto max-w-3xl rounded-[24px] border border-[var(--line)] bg-[var(--paper)] p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--accent-dim)] px-3 py-1 font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  {result.domain}
                </span>
                {confidenceValue && (
                  <span className="rounded-full bg-[rgba(90,138,90,0.08)] px-3 py-1 font-[family-name:var(--mono)] text-[10px] uppercase tracking-wider text-[var(--success)]">
                    Confiance {confidenceValue}%
                  </span>
                )}
              </div>
              <span className="font-[family-name:var(--mono)] text-[10px] tracking-wider text-[var(--muted)]">{result.model}</span>
            </div>

            <h1 className="mb-6 font-[family-name:var(--serif)] text-[36px] italic leading-tight text-[var(--ink)]">
              {result.term}
            </h1>

            <div className="mb-6 text-[15px] leading-relaxed text-[var(--ink)]/80 whitespace-pre-line">
              {result.explanation}
            </div>

            {result.analogy && (
              <div className="mb-6 rounded-r-xl border-l-2 border-[var(--accent)] bg-[var(--accent-dim)] py-4 pr-5 pl-5">
                <div className="mb-2 font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--accent)]">Analogie</div>
                <p className="font-[family-name:var(--serif)] text-[15px] italic leading-relaxed text-[var(--ink)]/70">{result.analogy}</p>
              </div>
            )}

            {result.takeaway && (
              <div className="mb-6 rounded-xl border border-[rgba(156,106,60,0.12)] bg-[rgba(156,106,60,0.05)] p-4">
                <div className="mb-1.5 font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--accent)]">À retenir</div>
                <p className="text-[15px] font-semibold leading-relaxed text-[var(--ink)]">{result.takeaway}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-6">
              <button onClick={() => onIterate('Approfondir')} className="rounded-xl border border-[var(--line)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]">Approfondir</button>
              <button onClick={() => onIterate('Simplifier davantage')} className="rounded-xl border border-[var(--line)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]">Simplifier</button>
              <button onClick={() => setShowSave(true)} className="rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] px-5 py-2.5 text-[13px] font-semibold text-[var(--ink-light)] transition-opacity hover:opacity-90">Enregistrer</button>
            </div>
          </div>
        )}
      </main>

      {/* Save modal */}
      {showSave && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--serif)] text-[20px] italic text-[var(--accent)]">Enregistrer</h3>
              <button onClick={() => setShowSave(false)} className="text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--accent-dim)] px-3 py-3 font-[family-name:var(--mono)] text-[12px] text-[var(--accent)]">
              {pathParts.map((part, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span>{part}</span>
                  {i < pathParts.length - 1 && <span className="text-[var(--muted)]">/</span>}
                </span>
              ))}
            </div>
            <div className="mb-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--stage)] p-3">
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-[family-name:var(--mono)] text-[10.5px] leading-relaxed text-[var(--ink)]/50">
                {buildObsidianNote(result).slice(0, 400)}…
              </pre>
            </div>
            <div className="flex gap-2">
              {!isSignedIn && configured && (
                <button onClick={login} disabled={driveLoading} className="flex-1 rounded-xl border border-[var(--line)] bg-white py-2.5 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]">
                  Connecter Google Drive
                </button>
              )}
              {isSignedIn && (
                <button onClick={handleSaveToDrive} disabled={driveLoading} className="flex-1 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] py-2.5 text-[13px] font-semibold text-[var(--ink-light)] transition-opacity hover:opacity-90">
                  {driveLoading ? '…' : 'Enregistrer dans Drive'}
                </button>
              )}
              {!configured && (
                <div className="flex-1 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-dim)] p-2 text-center text-[11px] text-[var(--accent)]">
                  Configurez NEXT_PUBLIC_GOOGLE_CLIENT_ID
                </div>
              )}
              <button onClick={handleDownload} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]">Télécharger</button>
            </div>
            {driveError && <p className="mt-3 text-[11px] text-red-600">{driveError}</p>}
          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--serif)] text-[20px] italic text-[var(--accent)]">Historique</h3>
              <button onClick={() => setShowHistory(false)} className="text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
            </div>
            <div className="em-scroll flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <p className="pt-10 text-center text-[14px] text-[var(--muted)]">Aucun élément.</p>
              ) : (
                <div className="space-y-0">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { onPickRecent(item); setShowHistory(false); }}
                      className="flex w-full items-center gap-3 border-t border-[var(--line)] py-3 text-left"
                    >
                      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-[var(--accent-dim)] font-[family-name:var(--mono)] text-[11px] font-semibold text-[var(--accent)]">
                        {item.term.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[var(--ink)]">{item.term}</div>
                        <div className="text-[11px] text-[var(--muted)]">{item.domain} · {formatDate(item.createdAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
