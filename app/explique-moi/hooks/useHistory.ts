import { useState, useEffect, useCallback } from 'react';
import { HistoryItem, ExplanationResult, Level } from '../types';
import { STORAGE_KEY } from '../lib/constants';

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryItem[];
        setHistory(parsed);
      }
    } catch {
      // ignore parse errors
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore storage errors
    }
  }, [history, loaded]);

  const addItem = useCallback((
    term: string,
    level: Level,
    model: string,
    result: ExplanationResult
  ) => {
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      term,
      domain: result.domain,
      level,
      model,
      result,
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => [item, ...prev].slice(0, 200));
    return item.id;
  }, []);

  const deleteItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm('Supprimer tout l\'historique ?')) {
      setHistory([]);
    }
  }, []);

  return { history, addItem, deleteItem, clearHistory, loaded };
}
