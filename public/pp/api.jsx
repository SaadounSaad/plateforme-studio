// ============================================================
// api.jsx — All server fetch wrappers
// ============================================================

const API_MODEL = 'claude-sonnet-4-6';

// Strip markdown code fences Claude sometimes adds despite instructions
function stripFence(s) {
  return (s || '').replace(/^```(?:\w+)?\s*/,'').replace(/\s*```$/,'').trim();
}

// ── Core Claude call ──────────────────────────────────────
async function claudeCall({ system, messages, max_tokens = 2000 }) {
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
    max_tokens: 2500
  });
  return stripFence(raw);
}

// ── Mode A: restructure dictated text ─────────────────────
async function apiRestructure(raw, lang) {
  const langLabel = { fr: 'en français soutenu', ar: 'en arabe littéral (فصحى)', en: 'in formal English', same: 'in the same language as the input' };
  const result = await claudeCall({
    system: `You are a prompt engineering expert following Anthropic best practices. Transform this rough idea (may be in darija, French, Arabic, or a mix) into a well-structured XML prompt with <role>, <instructions>, <context> (if needed), <output_format>, <examples> (if implied), <input> (if applicable). Instructions must be sequential and unambiguous. output_format must use positive directives (say what TO DO). Write the full prompt ${langLabel[lang] || 'en français'}. Return ONLY the XML-structured prompt starting with <prompt>, no markdown, no commentary.`,
    messages: [{ role: 'user', content: raw }],
    max_tokens: 2000
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

// ── Mode A: iterative prompt refinement via chat ───────────
async function apiRefineChat(messages) {
  return claudeCall({
    system: `You are an expert prompt engineer following Anthropic best practices. You iteratively refine XML-structured prompts through dialogue.

Rules:
- When the user asks for a modification, apply it and return the COMPLETE updated XML prompt wrapped in <refined_prompt>...</refined_prompt> tags, followed by a 1-sentence explanation of what changed.
- When the user asks a question (not a modification), answer directly without the XML tags.
- Preserve all original user intent. Never remove functionality without explicit request.
- Apply Anthropic best practices: clear role, sequential instructions, positive output_format directives, proper XML structure.
- Keep changes surgical — only modify what was asked.`,
    messages,
    max_tokens: 3000
  });
}

// ── Generic call with explicit model ─────────────────────
async function claudeCallWith(model, { system, messages, max_tokens = 1500 }) {
  const body = { model, max_tokens, messages };
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

// ── Mode C: Classify task complexity → model tier ────────
// Uses Sonnet (fast, cheap) — classification is a medium task
async function apiClassifyTask(taskDesc) {
  const raw = await claudeCallWith('claude-sonnet-4-6', {
    system: `Tu es un expert en architecture LLM et prompt engineering.
Analyse la tâche décrite et détermine le tier de complexité optimal.

Tiers disponibles :
- haiku  : Tâches simples. Extraction, classification, traduction courte, reformatage, Q&R factuelles courtes.
- sonnet : Tâches moyennes. Rédaction structurée, analyse documentaire, code review, génération de contenu structuré.
- opus   : Tâches complexes. Raisonnement multi-étapes, architecture logicielle, debug profond, synthèse multi-source, jugement nuancé, ambiguïté forte.
- fable  : Tâches frontières. Preuve mathématique, raisonnement inédit, expertise PhD-level, multi-domaine très complexe.

Règles de classification :
- Plusieurs sous-problèmes interdépendants → opus minimum
- Jugement nuancé ou expertise rare → opus/fable
- Output structuré > 500 tokens → sonnet minimum
- Créativité complexe ou style exigeant → sonnet minimum
- Incertitude sur la bonne approche → tier supérieur

Réponds UNIQUEMENT avec ce JSON valide (pas de markdown) :
{"tier":"haiku|sonnet|opus|fable","justification":"1-2 phrases expliquant le choix","confidence":0.0-1.0,"signals":["signal1","signal2","signal3"]}`,
    messages: [{ role: 'user', content: `Tâche à classifier :\n\n${taskDesc}` }],
    max_tokens: 350
  });
  const json = raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return JSON.parse(json);
}

// ── Mode C: Generate boosted prompt for target tier ───────
// Uses Opus — prompt generation is a complex creative task
async function apiGenerateBoostedPrompt(taskDesc, tier, domain) {
  const TIER_STRATEGIES = {
    haiku: `TIER : HAIKU — tâche simple.
Stratégie : prompt ultra-direct, zéro overhead cognitif, instructions atomiques.
- PAS de <thinking> (surcharge inutile sur tâche simple)
- Rôle court et précis (1 ligne max)
- Instructions séquentielles numérotées, chaque étape = 1 action atomique
- Output format avec exemple concret inline
- Contraintes négatives si pertinentes (ce que Claude NE doit PAS faire)`,

    sonnet: `TIER : SONNET — tâche moyenne.
Stratégie : structure XML claire + rôle expert + CoT sélectif.
- Rôle expert précis avec domaine d'autorité
- Instructions XML structurées (<role>, <instructions>, <output_format>)
- CoT UNIQUEMENT pour les sous-parties non-triviales : "For [étape complexe], reason step by step before answering"
- Few-shot example si output format ambigu
- Variable d'entrée {{NOM}} en majuscules`,

    opus: `TIER : OPUS — objectif : performance niveau FABLE 5.
Les 5 mécanismes OBLIGATOIRES dans le system prompt généré :

1. THINKING FORCÉ : "Before EVERY response, reason through the problem in <thinking></thinking> tags. Explore alternatives, check assumptions, identify edge cases. Never skip this."

2. DÉCOMPOSITION MANDATÉE : "For any problem with 2+ parts: first list ALL sub-problems and your approach to each. Then solve one by one."

3. CALIBRATION EXPERT : "You are a world-class expert in [domaine adapté]. Your standard: match the quality of the best published work in the field. If a junior analyst could have written it, rewrite it."

4. AUTO-CRITIQUE CONSTITUTIONNELLE : "After drafting, review: (a) Is every claim accurate? (b) Did I miss anything important? (c) Is this the best possible structure? Revise before responding."

5. PROTOCOLE INCERTITUDE : "Never hallucinate. When confidence < 90%, signal explicitly: '[à vérifier]', 'je suppose que...', 'selon mes connaissances générales...'. Better to acknowledge uncertainty than to fabricate."`,

    fable: `TIER : FABLE 5 — tâche frontière.
Fable 5 raisonne naturellement en profondeur — ne pas forcer de CoT artificiel.
Stratégie : structure riche + contexte maximal + exemples haute qualité.
- Rôle avec autorité maximale et contexte de travail précis
- XML structuré complet avec <context> riche
- 1-2 exemples few-shot de TRÈS haute qualité montrant le niveau attendu
- Output format précis avec critères de qualité explicites
- Contraintes de précision et de profondeur`
  };

  const raw = await claudeCallWith('claude-opus-4-8', {
    system: `Tu es un expert prompt engineer Anthropic. Tu génères des prompts "boostés" optimisés pour extraire le maximum de performance d'un modèle cible.

Règles absolues :
- Le system_prompt doit être en anglais (meilleure performance sur les modèles Anthropic)
- Le user_template peut être dans la langue de la tâche
- Utilise les XML tags Anthropic (<role>, <instructions>, <context>, <examples>, <output_format>, <constraints>)
- Les variables sont en {{MAJUSCULES}}
- PAS de markdown dans les prompts générés — uniquement du texte structuré XML

${TIER_STRATEGIES[tier]}`,
    messages: [{ role: 'user', content: `Génère un prompt boosté pour cette tâche.

Tâche : ${taskDesc}${domain ? `\nDomaine : ${domain}` : ''}
Tier cible : ${tier}

Réponds UNIQUEMENT avec ce JSON valide (pas de markdown wrapper) :
{"system_prompt":"...","user_template":"...","variables":["VAR1"],"usage_tips":["conseil1","conseil2"],"cot_required":true}` }],
    max_tokens: 2500
  });
  const json = raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return JSON.parse(json);
}

Object.assign(window, {
  claudeCall, claudeCallWith,
  apiRefinePrompt, apiRestructure, apiRefineChat,
  apiLoadResources, apiLoadResourceFile,
  apiRecommendResources, apiGenerateClaudeMd, apiBrainstormChat,
  apiGenerateAllDocs, apiGenerateGuide,
  apiClassifyTask, apiGenerateBoostedPrompt
});
