"use client";

import { useState } from 'react';
import { ExplanationResult } from '../types';
import { buildObsidianNote, buildFilePath, downloadMarkdown } from '../lib/formatters';
import { useDrive } from '../hooks/useDrive';

interface SaveToDriveModalProps {
  result: ExplanationResult;
  onClose: () => void;
}

export function SaveToDriveModal({ result, onClose }: SaveToDriveModalProps) {
  const { isSignedIn, loading, error, login, saveFile, configured } = useDrive();
  const [saved, setSaved] = useState(false);

  const fileName = `${result.term.replace(/[^a-zA-Z0-9\u00C0-\u017F]+/g, '-').toLowerCase()}.md`;
  const filePath = buildFilePath(result);
  const note = buildObsidianNote(result);

  const handleDownload = () => {
    downloadMarkdown(note, fileName);
    onClose();
  };

  const handleSaveToDrive = async () => {
    try {
      await saveFile(fileName, note);
      setSaved(true);
    } catch (err) {
      // error is surfaced via useDrive error state
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg italic text-gold">Enregistrer</h3>
          <button onClick={onClose} className="text-muted hover:text-fg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 space-y-3 text-[13px] text-muted">
          <p>
            Fichier : <span className="font-mono text-fg">{filePath}</span>
          </p>
          <p>
            Titre : <span className="text-fg">{result.term}</span>
          </p>
        </div>

        {saved ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center text-[14px] text-green-400">
            Fichier enregistré dans Google Drive.
          </div>
        ) : (
          <div className="space-y-3">
            {!isSignedIn && configured && (
              <button
                onClick={login}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-bg px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-50"
              >
                {loading ? 'Connexion…' : 'Connecter Google Drive'}
              </button>
            )}

            {isSignedIn && (
              <button
                onClick={handleSaveToDrive}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-bg transition-colors hover:bg-gold/90 disabled:opacity-50"
              >
                {loading ? 'Enregistrement…' : 'Enregistrer dans Google Drive'}
              </button>
            )}

            {!configured && (
              <p className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-[12px] text-gold/90">
                Google Drive n'est pas configuré. Configurez NEXT_PUBLIC_GOOGLE_CLIENT_ID ou téléchargez le fichier.
              </p>
            )}

            <button
              onClick={handleDownload}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              Télécharger le fichier .md
            </button>

            {error && <p className="text-[12px] text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
