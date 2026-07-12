import { Domain, Level } from '../types';

export const LEVELS: { value: Level; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'approfondir', label: 'Approfondir' },
];

export const DOMAINS: { value: Domain | ''; label: string }[] = [
  { value: '', label: 'Auto' },
  { value: 'tech', label: 'Tech' },
  { value: 'rh', label: 'RH' },
  { value: 'psy', label: 'Psychologie' },
  { value: 'business', label: 'Business' },
  { value: 'finance', label: 'Finance' },
  { value: 'product', label: 'Produit' },
  { value: 'general', label: 'Général' },
];

// Modèles disponibles. L'ID doit être reconnu par l'API Anthropic.
// Vérifiez les IDs actifs pour votre clé API via https://docs.anthropic.com/en/docs/about-claude/models
export const MODELS: { value: string; label: string; isDefault?: boolean }[] = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', isDefault: true },
  { value: 'claude-sonnet-4-5-20251001', label: 'Claude Sonnet 4.5 [à vérifier]' },
  { value: 'claude-opus-4-8-20251001', label: 'Claude Opus 4.8 [à vérifier]' },
];

export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const STORAGE_KEY = 'em-history';
export const STORAGE_CONFIG_KEY = 'em-config';
export const DEFAULT_VAULT_PATH = 'Brain/ExpliqueMoi';
