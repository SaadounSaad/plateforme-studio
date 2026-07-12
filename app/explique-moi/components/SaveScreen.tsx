"use client";

import { ExplanationResult, HistoryItem } from '../types';
import { buildObsidianNote, buildFilePath, downloadMarkdown } from '../lib/formatters';
import { useDrive } from '../hooks/useDrive';

interface SaveScreenProps {
  result: ExplanationResult | null;
  history: HistoryItem[];
  onBack: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function SaveScreen({ result, history, onBack }: SaveScreenProps) {
  const { isSignedIn, loading, error, login, saveFile, configured } = useDrive();

  if (!result) {
    return (
      <div className="flex h-full flex-col bg-[var(--paper)] p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--line)] text-[var(--ink)]">←</button>
          <span className="font-[family-name:var(--mono)] text-[12px] uppercase tracking-wider text-[var(--muted)]">Enregistrer</span>
        </div>
        <p className="text-[14px] text-[var(--muted)]">Aucune explication à enregistrer.</p>
      </div>
    );
  }

  const fileName = `${result.term.replace(/[^a-zA-Z0-9\u00C0-\u017F]+/g, '-').toLowerCase()}.md`;
  const note = buildObsidianNote(result);
  const filePath = buildFilePath(result);

  const handleDownload = () => {
    downloadMarkdown(note, fileName);
  };

  const handleSaveToDrive = async () => {
    try {
      await saveFile(fileName, note);
    } catch {
      // error surfaced via useDrive
    }
  };

  const parts = filePath.split('/');

  return (
    <div className="flex h-full flex-col bg-[var(--paper)]">
      <div className="flex items-center gap-2.5 px-6 pt-3 pb-2">
        <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--line)] text-[var(--ink)]">←</button>
        <span className="font-[family-name:var(--mono)] text-[12px] uppercase tracking-wider text-[var(--muted)]">Enregistrer</span>
      </div>

      <div className="mx-4 rounded-[20px] border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#4285f4] to-[#34a853] text-[12px] font-bold text-white">
            G
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--ink)]">Google Drive</h3>
            <p className="text-[11px] text-[var(--muted)]">
              {isSignedIn ? 'Connecté' : configured ? 'Non connecté' : 'Non configuré'}
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-1.5 rounded-xl bg-[var(--accent-dim)] px-3.5 py-3 font-[family-name:var(--mono)] text-[12px] text-[var(--accent)]">
          {parts.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>{part}</span>
              {i < parts.length - 1 && <span className="text-[var(--muted)]">/</span>}
            </span>
          ))}
        </div>

        <div className="mb-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--stage)] p-3.5">
          <div className="mb-2 font-[family-name:var(--mono)] text-[8.5px] uppercase tracking-[0.22em] text-[var(--muted)]">
            Aperçu du fichier .md
          </div>
          <pre className="whitespace-pre-wrap font-[family-name:var(--mono)] text-[10.5px] leading-relaxed text-[var(--ink)]/45">
            {note.slice(0, 320)}…
          </pre>
        </div>

        <div className="flex gap-2">
          {!isSignedIn && configured && (
            <button
              onClick={login}
              disabled={loading}
              className="flex-1 rounded-xl border border-[var(--line)] bg-white py-2.5 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
            >
              Connecter
            </button>
          )}
          {isSignedIn && (
            <button
              onClick={handleSaveToDrive}
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] py-2.5 text-[13px] font-semibold text-[var(--ink-light)] transition-opacity hover:opacity-90"
            >
              {loading ? '…' : 'Enregistrer dans Drive'}
            </button>
          )}
          {!configured && (
            <div className="flex-1 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-dim)] p-2 text-center text-[11px] text-[var(--accent)]">
              Configurez NEXT_PUBLIC_GOOGLE_CLIENT_ID
            </div>
          )}
          <button
            onClick={handleDownload}
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
          >
            Télécharger
          </button>
        </div>

        {error && <p className="mt-3 text-[11px] text-red-600">{error}</p>}
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl border border-[rgba(90,138,90,0.12)] bg-[rgba(90,138,90,0.06)] px-3.5 py-3">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--success)]"></span>
        <span className="text-[12px] text-[var(--ink)]/60">Synchronisé · Dernière sync: à l'instant</span>
      </div>

      <div className="em-scroll flex-1 overflow-y-auto px-5 pt-5">
        <div className="mb-3 font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Historique récent
        </div>
        <div className="space-y-0">
          {history.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">Aucun élément.</p>
          ) : (
            history.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center gap-3 border-t border-[var(--line)] py-3">
                <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] bg-[var(--accent-dim)] font-[family-name:var(--mono)] text-[11px] font-semibold text-[var(--accent)]">
                  {item.term.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[var(--ink)]">{item.term}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {item.domain} · {formatDate(item.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
