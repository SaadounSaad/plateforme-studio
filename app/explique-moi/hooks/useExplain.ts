import { useState, useCallback } from 'react';
import { ExplainOptions, ExplanationResult } from '../types';
import { parseExplanation } from '../lib/parser';

interface UseExplainReturn {
  result: ExplanationResult | null;
  loading: boolean;
  error: string | null;
  explain: (options: ExplainOptions) => Promise<void>;
  reset: () => void;
}

export function useExplain(): UseExplainReturn {
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explain = useCallback(async (options: ExplainOptions) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/explique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: options.term,
          level: options.level,
          domain: options.domain,
          model: options.model,
          action: options.action,
          previousResponse: options.previousResponse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erreur HTTP ${res.status}`);
      }

      const parsed = parseExplanation(data.raw, data.model);
      setResult(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, explain, reset };
}
