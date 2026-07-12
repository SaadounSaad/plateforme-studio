"use client";

import { useState, useEffect } from 'react';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';
import { useExplain } from '../hooks/useExplain';
import { useHistory } from '../hooks/useHistory';
import { Domain, Level, IterationAction, HistoryItem } from '../types';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export function ExpliqueMoiApp() {
  const isDesktop = useIsDesktop();
  const { result, loading, error, explain, reset } = useExplain();
  const { history, addItem } = useHistory();
  const [query, setQuery] = useState('');
  const [currentOptions, setCurrentOptions] = useState<{
    term: string;
    level: Level;
    domain: Domain | '';
    model: string;
  } | null>(null);

  useEffect(() => {
    if (result && currentOptions && !loading) {
      addItem(currentOptions.term, currentOptions.level, currentOptions.model, result);
    }
  }, [result, currentOptions, loading, addItem]);

  const handleExplain = async (term: string, level: Level, domain: Domain | '', model: string) => {
    setCurrentOptions({ term, level, domain, model });
    setQuery(term);
    reset();
    await explain({ term, level, domain, model });
  };

  const handlePickRecent = (item: HistoryItem) => {
    setCurrentOptions({
      term: item.term,
      level: item.level,
      domain: item.domain as Domain | '',
      model: item.model,
    });
    setQuery(item.term);
    explain({
      term: item.term,
      level: item.level,
      domain: item.domain as Domain | '',
      model: item.model,
    });
  };

  const handleIterate = async (action: Exclude<IterationAction, 'Enregistrer dans Obsidian'>) => {
    if (!currentOptions || !result) return;
    await explain({
      ...currentOptions,
      action,
      previousResponse: result.raw,
    });
  };

  if (isDesktop) {
    return (
      <DesktopLayout
        result={result}
        loading={loading}
        error={error}
        history={history}
        onExplain={handleExplain}
        onPickRecent={handlePickRecent}
        onIterate={handleIterate}
      />
    );
  }

  return (
    <MobileLayout
      result={result}
      loading={loading}
      error={error}
      history={history}
      query={query}
      currentOptions={currentOptions}
      onExplain={handleExplain}
      onPickRecent={handlePickRecent}
      onIterate={handleIterate}
    />
  );
}
