"use client";

import { useState } from 'react';
import { Domain, Level, HistoryItem } from '../types';
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

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionCtor;
    webkitSpeechRecognition: SpeechRecognitionCtor;
  }
}

interface HomeScreenProps {
  onExplain: (term: string, level: Level, domain: Domain | '', model: string) => void;
  onPickRecent: (item: HistoryItem) => void;
  history: HistoryItem[];
}

export function HomeScreen({ onExplain, onPickRecent, history }: HomeScreenProps) {
  const [term, setTerm] = useState('');
  const [level, setLevel] = useState<Level>('simple');
  const [domain, setDomain] = useState<Domain | ''>('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [recording, setRecording] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    onExplain(term.trim(), level, domain, model);
  };

  const toggleDictation = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("La dictée vocale n'est pas supportée par ce navigateur.");
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
    r.start();
    setRecording(true);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--paper)]">
      <div className="px-7 pt-12">
        <div className="mb-9 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-[17px] font-bold text-[var(--ink-light)]">
              ?
            </div>
            <span className="font-[family-name:var(--serif)] text-[26px] italic leading-none text-[var(--ink)]">
              Explique<em className="text-[var(--accent)]">Moi</em>
            </span>
          </div>
          <a href="/" className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] transition-colors hover:text-[var(--accent)]">
            ← Studio
          </a>
        </div>
        <h1 className="mb-3.5 max-w-[14ch] font-[family-name:var(--serif)] text-[38px] font-normal italic leading-[1.06] text-[var(--ink)]">
          Comprenez n'importe quel concept en <span className="text-[var(--accent)]">30 secondes</span>.
        </h1>
        <p className="max-w-[30ch] text-[14px] leading-relaxed text-[var(--muted)]">
          Un terme, une comparaison, une idée floue — posez-la, ExpliqueMoi la décortique en langage clair.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4 px-5">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3.5 shadow-sm">
          <svg className="h-5 w-5 flex-shrink-0 text-[var(--muted)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5L17 17" />
          </svg>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tapez un terme… (ex: API vs MCP)"
            className="flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[#b5aa9d]"
          />
          <button
            type="button"
            onClick={toggleDictation}
            className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full transition-colors ${
              recording ? 'animate-pulse bg-red-500/20 text-red-600' : 'bg-[var(--accent-dim)] text-[var(--accent)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <path d="M12 18v4" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDomain('')}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider ${
              domain === ''
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink-light)]'
                : 'border-[var(--line)] text-[var(--muted)]'
            }`}
          >
            Tous
          </button>
          {DOMAINS.filter((d) => d.value).map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDomain(d.value as Domain)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider ${
                domain === d.value
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--ink-light)]'
                  : 'border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-wider text-[var(--muted)]">Niveau</span>
            <div className="flex rounded-lg border border-[var(--line)] p-1">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  className={`flex-1 rounded-md py-2 text-[12px] font-medium ${
                    level === l.value ? 'bg-[var(--accent)] text-[var(--ink-light)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-wider text-[var(--muted)]">Modèle</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-[12px] text-[var(--ink)] outline-none"
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
          disabled={!term.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] px-4 py-3.5 text-[15px] font-semibold text-[var(--ink-light)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Expliquer
        </button>
      </form>

      <div className="flex-1 px-5 pt-6">
        <div className="mb-3 font-[family-name:var(--mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Recherches récentes
        </div>
        {history.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Aucune recherche récente.</p>
        ) : (
          <div className="space-y-0">
            {history.slice(0, 6).map((item) => (
              <button
                key={item.id}
                onClick={() => onPickRecent(item)}
                className="flex w-full items-center gap-3 border-t border-[var(--line)] py-3 text-left"
              >
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent)] opacity-50"></span>
                <span className="flex-1 text-[13px] text-[var(--ink)] opacity-65">{item.term}</span>
                <span className="font-[family-name:var(--mono)] text-[9px] uppercase tracking-wider text-[var(--muted)]">
                  {item.domain}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-[var(--line)] px-5 py-5">
        <p className="text-[10.5px] leading-relaxed text-[var(--muted)] font-[family-name:var(--mono)]">
          Tapez votre question. Utilisez le micro pour la <b className="font-medium text-[var(--ink)]">dictée vocale</b>. Les réponses s'enregistrent automatiquement dans votre Drive.
        </p>
      </div>
    </div>
  );
}
