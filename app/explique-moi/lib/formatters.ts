import { ExplanationResult } from '../types';
import { DEFAULT_VAULT_PATH } from './constants';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildObsidianNote(result: ExplanationResult, date = new Date().toISOString()): string {
  const domainTag = result.domain.trim().toLowerCase().replace(/\s+/g, '-');
  const fileName = slugify(result.term) || 'concept';

  const frontmatter = `---
title: "${result.term.replace(/"/g, '\\"')}"
domain: ${domainTag}
tags: [${domainTag}]
created: ${date.split('T')[0]}
model: ${result.model}
---

# ${result.term}

> **Domaine :** ${result.domain}
> **Modèle :** ${result.model}

## Explication

${result.explanation}

## Analogie

${result.analogy}

## À retenir

${result.takeaway}

## Confiance

${result.confidence}

## Voir aussi

- [[Concept connexe]]
`;

  return frontmatter;
}

export function buildFilePath(result: ExplanationResult): string {
  const domain = result.domain.trim().toLowerCase().replace(/\s+/g, '-');
  const fileName = `${slugify(result.term) || 'concept'}.md`;
  return domain ? `${DEFAULT_VAULT_PATH}/${domain}/${fileName}` : `${DEFAULT_VAULT_PATH}/${fileName}`;
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
