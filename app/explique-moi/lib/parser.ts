import { ExplanationResult } from '../types';

export function parseExplanation(raw: string, model: string): ExplanationResult {
  const text = raw || '';

  const extract = (label: string, endLabel?: string): string => {
    const regex = endLabel
      ? new RegExp(`${label}\\s*\\n?([\\s\\S]*?)(?=\\n${endLabel}|\\n---|$)`, 'i')
      : new RegExp(`${label}\\s*\\n?([\\s\\S]*?)(?=\\n---|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const term = extract('Terme:', 'Domaine:');
  const domain = extract('Domaine:', 'Explication:');
  const explanation = extract('Explication:', 'Analogie:');
  const analogy = extract('Analogie:', 'À retenir:');
  const takeaway = extract('À retenir:', '\\[Confiance / à vérifier:');
  const confidenceMatch = text.match(/\[Confiance \/ à vérifier:\s*(.*?)\]/i);
  const confidence = confidenceMatch ? confidenceMatch[1].trim() : 'aucune réserve';

  const modelMatch = text.match(/Modèle utilisé:\s*(.+)/i);
  const detectedModel = modelMatch ? modelMatch[1].trim() : model;

  const actionsMatch = text.match(/Actions disponibles:\s*(.+)/i);
  const actions = actionsMatch ? actionsMatch[1].trim() : '[Approfondir] [Simplifier davantage] [Enregistrer dans Obsidian → Brain/ExpliqueMoi]';

  return {
    term: term || 'Terme non détecté',
    domain: domain || ' général',
    explanation: explanation || text,
    analogy: analogy || '',
    takeaway: takeaway || '',
    confidence,
    model: detectedModel,
    actions,
    raw: text,
  };
}
