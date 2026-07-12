"use client";

import { useState } from 'react';
import { HomeScreen } from './HomeScreen';
import { ResponseScreen } from './ResponseScreen';
import { SaveScreen } from './SaveScreen';
import { HistoryScreen } from './HistoryScreen';
import { Domain, Level, IterationAction, HistoryItem, ExplanationResult } from '../types';

type Tab = 'home' | 'response' | 'save' | 'history';

interface MobileLayoutProps {
  result: ExplanationResult | null;
  loading: boolean;
  error: string | null;
  history: HistoryItem[];
  query: string;
  currentOptions: { term: string; level: Level; domain: Domain | ''; model: string } | null;
  onExplain: (term: string, level: Level, domain: Domain | '', model: string) => void;
  onPickRecent: (item: HistoryItem) => void;
  onIterate: (action: Exclude<IterationAction, 'Enregistrer dans Obsidian'>) => void;
}

export function MobileLayout({
  result,
  loading,
  error,
  history,
  query,
  currentOptions,
  onExplain,
  onPickRecent,
  onIterate,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  const handleExplain = async (term: string, level: Level, domain: Domain | '', model: string) => {
    setActiveTab('response');
    onExplain(term, level, domain, model);
  };

  const handlePickRecent = (item: HistoryItem) => {
    onPickRecent(item);
    setActiveTab('response');
  };

  const handleSave = () => {
    if (!result) return;
    setActiveTab('save');
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Accueil', icon: '⌂' },
    { id: 'response', label: 'Réponse', icon: '◈' },
    { id: 'save', label: 'Drive', icon: '☁' },
    { id: 'history', label: 'Historique', icon: '◫' },
  ];

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--paper)]">
      <div className="em-scroll flex-1 overflow-y-auto">
        {activeTab === 'home' && (
          <HomeScreen onExplain={handleExplain} onPickRecent={handlePickRecent} history={history} />
        )}
        {activeTab === 'response' && (
          <ResponseScreen
            result={result}
            loading={loading}
            error={error}
            query={query}
            onBack={() => setActiveTab('home')}
            onIterate={onIterate}
            onSave={handleSave}
          />
        )}
        {activeTab === 'save' && (
          <SaveScreen result={result} history={history} onBack={() => setActiveTab('response')} />
        )}
        {activeTab === 'history' && (
          <HistoryScreen history={history} onSelect={handlePickRecent} />
        )}
      </div>

      <div className="grid grid-cols-4 border-t border-[var(--line)] bg-[var(--paper)] px-4 pb-6 pt-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 font-[family-name:var(--mono)] text-[9px] uppercase tracking-wider transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-md text-[12px] ${
                  isActive ? 'bg-[var(--accent-dim)]' : 'bg-[var(--line)]'
                }`}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
