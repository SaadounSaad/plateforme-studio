// ============================================================
// api.jsx — All server fetch wrappers
// ============================================================

const API_MODEL = 'claude-sonnet-4-6';

// Strip markdown code fences Claude sometimes adds despite instructions
function stripFence(s) {
  return (s || '').replace(/^```(?:\w+)?\s*/,'').replace(/\s*```$/,'').trim();
}

// ── Core Claude call ──────────────────────────────────────
async function claudeCall({ system, messages, max_tokens = 1500 }) {
  const body = { model: API_MODEL, max_tokens, messages };
  if (system) body.system = system;
  const resp = await fetch('/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

// ── Mode A: refine prompt XML ─────────────────────────────
async function apiRefinePrompt(structured) {
  const raw = await claudeCall({
    system: 'You are a prompt engineering expert following Anthropic official best practices. Review and refine this XML-structured prompt. Ensure: role is concise and precise, instructions are sequential and unambiguous, output_format uses positive directives, examples in proper <example> XML tags. Preserve all user intent. Return ONLY the refined XML prompt starting with <prompt>, no markdown, no commentary.',
    messages: [{ role: 'user', content: 'Refine:\n\n' + structured }],
    max_tokens: 1500
  });
  return stripFence(raw);
}

// ── Mode A: restructure dictated text ─────────────────────
async function apiRestructure(raw, lang) {
  const langLabel = { fr: 'en français soutenu', ar: 'en arabe littéral (فصحى)', en: 'in formal English', same: 'in the same language as the input' };
  const result = await claudeCall({
    system: `You are a prompt engineering expert following Anthropic best practices. Transform this rough idea (may be in darija, French, Arabic, or a mix) into a well-structured XML prompt with <role>, <instructions>, <context> (if needed), <output_format>, <examples> (if implied), <input> (if applicable). Instructions must be sequential and unambiguous. output_format must use positive directives (say what TO DO). Write the full prompt ${langLabel[lang] || 'en français'}. Return ONLY the XML-structured prompt starting with <prompt>, no markdown, no commentary.`,
    messages: [{ role: 'user', content: raw }],
    max_tokens: 1500
  });
  return stripFence(result);
}

// ── Mode B: load resources list ──────────────────────────
async function apiLoadResources() {
  const r = await fetch('/resources');
  if (!r.ok) throw new Error('Erreur chargement ressources: ' + r.status);
  return r.json();
}

// ── Mode B: load single resource file ────────────────────
async function apiLoadResourceFile(filePath) {
  if (!filePath) return null;
  const r = await fetch('/resource-file?path=' + encodeURIComponent(filePath));
  if (!r.ok) return null;
  const text = await r.text();
  if (text.startsWith('{"error"')) return null;
  return text;
}

// ── Mode B: analyze project → recommend resources ─────────
async function apiRecommendResources(project, conversation, resources) {
  const resList = resources.map(r =>
    `- id:"${r.id}" name:"${r.name}" type:${r.type} cat:${r.category} tags:[${(r.tags||[]).join(',')}] desc:"${r.description}"`
  ).join('\n');

  const projectCtx = [
    `Nom: ${project.name}`,
    `Description: ${project.desc}`,
    project.stack ? `Stack: ${project.stack}` : '',
    project.goals ? `Phases: ${project.goals}` : '',
  ].filter(Boolean).join('\n');

  const chatSummary = conversation.length >= 2
    ? '\n\n<discussion_brainstorm>\n' +
      conversation.map(m => `${m.role === 'user' ? 'Utilisateur' : 'Claude'}: ${m.content}`).join('\n\n') +
      '\n</discussion_brainstorm>'
    : '';

  const prompt = `Tu es un expert Claude Code. Analyse ce projet et sélectionne les 5 à 8 ressources les plus pertinentes parmi la liste fournie.

<projet>
${projectCtx}
</projet>
${chatSummary}

<ressources_disponibles>
${resList}
</ressources_disponibles>

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas d'explication) :
[
  {"id": "...", "justification": "1-2 phrases expliquant pourquoi cette ressource est utile pour CE projet spécifique"},
  ...
]`;

  const raw = await claudeCall({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024
  });
  const jsonStr = raw.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
  return JSON.parse(jsonStr);
}

// ── Mode B: generate CLAUDE.md ────────────────────────────
async function apiGenerateClaudeMd(project, recsWithContent) {
  const resourceSummaries = recsWithContent
    .filter(r => r.res && r.content)
    .map(r => `### ${r.res.name} (${r.res.type})\n${r.content.substring(0, 400)}`)
    .join('\n\n---\n\n');

  const { name='', desc='', stack='', goals='' } = project;

  const prompt = `Génère un CLAUDE.md haute performance pour ce projet en suivant les best practices de prompt engineering Anthropic.

<projet>
Nom: ${name}
Description: ${desc}
${stack ? `Stack: ${stack}` : ''}
${goals ? `Phases/Objectifs: ${goals}` : ''}
</projet>

<ressources_intégrées>
${resourceSummaries || '(aucune ressource)'}
</ressources_intégrées>

<instructions>
Structure le CLAUDE.md avec ces 6 sections XML dans cet ordre exact :

1. <project_context> — Role prompting : "You are a senior [stack adapté] developer working on ${name}. [description]. Your goal is [objectif]."

2. <coding_standards> — Conventions de code numérotées (style, nommage, structure fichiers, commandes build/test). Instructions séquentielles.

3. <workflow> — Process de développement. OBLIGATOIRE : "For complex tasks, think step-by-step in <thinking> tags before responding. Break tasks >30min into subtasks."

4. <slash_commands> — Liste les commandes depuis les ressources intégrées avec usage concret dans CE projet.

5. <examples> — 2 exemples concrets : format idéal commit + pattern de code caractéristique du stack.

6. <constraints> — Ce que Claude NE doit PAS faire. Liste courte, règles non négociables.
</instructions>

Réponds UNIQUEMENT avec le contenu markdown du CLAUDE.md. Pas de preamble, pas de commentaire.`;

  return claudeCall({
    system: 'You are an expert Claude Code architect. You create CLAUDE.md files that maximize Claude\'s effectiveness using prompt engineering best practices: role prompting, XML structure, chain-of-thought guidance, and multishot examples. Output only the CLAUDE.md content, no preamble.',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000
  });
}

// ── Mode B: generate all project docs in one call ─────────
async function apiGenerateAllDocs(project, claudeMd, conversation) {
  const { name='', desc='', stack='', goals='', domains='' } = project;
  const chatSummary = (conversation || []).slice(0, 6)
    .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content}`)
    .join('\n\n');

  const prompt = `Tu es un architecte logiciel expert. Génère 3 documents clés pour ce projet Claude Code.

<projet>
Nom: ${name}
Description: ${desc}${stack ? `\nStack: ${stack}` : ''}${goals ? `\nObjectifs: ${goals}` : ''}${domains ? `\nDomaines: ${domains}` : ''}
</projet>
${chatSummary ? `\n<brainstorm>\n${chatSummary.slice(0, 1200)}\n</brainstorm>` : ''}

Génère exactement ce JSON valide, sans markdown wrapper :
{"orchestrateur":"...","prd":"...","architecture":"..."}

orchestrateur.md : ## Rôle, ## Agents disponibles (liste spécialistes à spawner selon tâche), ## Règles de coordination, ## Mémoire partagée
PRD : ## Vision, ## Utilisateurs cibles, ## Fonctionnalités (MoSCoW), ## Critères de succès, ## Contraintes
ARCHITECTURE.md : ## Vue d'ensemble, ## Stack, ## Structure dossiers (arborescence), ## Flux de données, ## ADR

200-350 mots par document, markdown, français. JSON uniquement en réponse.`;

  const raw = await claudeCall({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3500
  });
  const jsonStr = raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return JSON.parse(jsonStr);
}

// ── Mode B: generate getting-started guide ────────────────
async function apiGenerateGuide(project, claudeMd, allDocs, conversation) {
  const { name='', desc='', stack='', goals='' } = project;
  const chatCtx = (conversation || []).slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content}`)
    .join('\n\n');

  const prompt = `Tu es un expert Claude Code. Génère un guide de démarrage pratique pour ce projet.

<projet>
Nom: ${name}
Description: ${desc}${stack ? `\nStack: ${stack}` : ''}${goals ? `\nObjectifs: ${goals}` : ''}
</projet>
${chatCtx ? `\n<contexte>\n${chatCtx.slice(0, 800)}\n</contexte>` : ''}

Structure EXACTE (markdown, sections dans cet ordre) :

## Récapitulatif
3-4 lignes : projet, stack, objectif principal.

## 1. Avant de lancer Claude Code
Commandes shell à exécuter (venv Python OU npm install Node, etc.). Variables d'env si applicable. Bloc \`\`\`powershell ou \`\`\`bash.

## 2. Prompt de démarrage Claude Code
Bloc de code avec le prompt copy-paste exact à coller dans Claude Code pour lancer le scaffold. Doit : demander de lire CLAUDE.md, lister ce qu'il faut générer, demander validation avant de coder.

## 3. Validation du scaffold
Commande(s) pour vérifier que le scaffold fonctionne. Indiquer l'URL ou le résultat attendu.

## 4. Ordre de développement
Liste numérotée des modules/features dans l'ordre de priorité, basée sur les objectifs.

## 5. Notes techniques
1-2 points importants : versions, caveats, pièges courants pour ce stack.

Réponds uniquement avec le contenu markdown. Adapte chaque section au stack ${stack || 'du projet'}.`;

  return claudeCall({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1800
  });
}

// ── Mode B: brainstorm chat turn ──────────────────────────
async function apiBrainstormChat(conversation) {
  return claudeCall({
    system: CC_BRAINSTORM_SYSTEM,
    messages: conversation,
    max_tokens: 1500
  });
}

Object.assign(window, {
  claudeCall, apiRefinePrompt, apiRestructure,
  apiLoadResources, apiLoadResourceFile,
  apiRecommendResources, apiGenerateClaudeMd, apiBrainstormChat,
  apiGenerateAllDocs, apiGenerateGuide
});
