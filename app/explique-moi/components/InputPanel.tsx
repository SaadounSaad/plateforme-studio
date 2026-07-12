"use client";

import { useState, useRef } from 'react';
import { Domain, Level } from '../types';
import { LEVELS, DOMAINS, MODELS, DEFAULT_MODEL } from '../lib/constants';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface InputPanelProps {
  onSubmit: (term: string, level: Level, domain: Domain | '', model: string) => void;
  loading: boolean;
}

export function InputPanel({ onSubmit, loading }: InputPanelProps) {
  const [term, setTerm] = useState('');
  const [level, setLevel] = useState<Level>('simple');
  const [domain, setDomain] = useState<Domain | ''>('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    onSubmit(term.trim(), level, domain, model);
  };

  const toggleDictation = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('La dictée vocale n\'est pas supportée par ce navigateur. Essayez Chrome.');
      return;
    }

    const r = new SR();
    r.lang = 'fr-FR';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setTerm((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    recognitionRef.current = r;
    r.start();
    setRecording(true);
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="term" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          Explique-moi…
        </label>
        <div className="relative">
          <textarea
            id="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex: API vs MCP, la surcharge mentale, un bail commercial…"
            rows={4}
            className="w-full resize-none rounded-xl border border-line bg-surface p-4 pr-12 text-[15px] text-fg placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={toggleDictation}
            className={`absolute right-3 bottom-3 rounded-lg p-2 transition-colors ${
              recording
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'text-muted hover:bg-surface2 hover:text-gold'
            }`}
            title={recording ? 'Arrêter la dictée' : 'Dicter'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <path d="M12 19v4M8 23h8" />
            </svg>
          </button>
        </div>
        {recording && <p className="text-[11px] text-red-400">● À l'écoute…</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Niveau</span>
          <div className="flex rounded-lg border border-line p-1">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={`flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  level === l.value
                    ? 'bg-gold/15 text-gold'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Domaine</span>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as Domain | '')}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-fg focus:border-gold/50 focus:outline-none"
          >
            {DOMAINS.map((d) => (
              <option key={d.value || 'auto'} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Modèle</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-fg focus:border-gold/50 focus:outline-none"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !term.trim()}
        className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-gold px-5 py-3 text-[14px] font-semibold text-bg transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg/30 border-t-bg" />
            Explication en cours…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1.26A6.98 6.98 0 0 1 5 10a7 7 0 0 1 7-7z" />
              <path d="M9 21h6" />
            </svg>
            Expliquer
          </>
        )}
      </button>
    </form>
  );
}
