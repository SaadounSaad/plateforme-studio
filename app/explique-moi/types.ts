export type Domain = 'tech' | 'rh' | 'psy' | 'business' | 'general' | 'product' | 'finance';
export type Level = 'simple' | 'approfondir';
export type IterationAction = 'Approfondir' | 'Simplifier davantage' | 'Enregistrer dans Obsidian';
export type ModelName = string;

export interface ExplainOptions {
  term: string;
  level: Level;
  domain?: Domain | '';
  model: ModelName;
  action?: IterationAction | '';
  previousResponse?: string;
}

export interface ExplanationResult {
  term: string;
  domain: string;
  explanation: string;
  analogy: string;
  takeaway: string;
  confidence: string;
  model: string;
  actions: string;
  raw: string;
}

export interface HistoryItem {
  id: string;
  term: string;
  domain: string;
  level: Level;
  model: string;
  result: ExplanationResult;
  createdAt: string;
}

export interface DriveConfig {
  enabled: boolean;
  folderId: string | null;
  folderName: string;
}
