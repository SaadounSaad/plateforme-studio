// ============================================================
// api.jsx — All server fetch wrappers
// ============================================================

const API_MODEL = 'claude-sonnet-5';

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
  if (data.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (max_tokens atteint) — augmente la limite pour cet appel');
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
  // Le catalogue complet (100+ ressources) dépasse MAX_MESSAGE_LENGTH une fois
  // sérialisé avec le reste du prompt. Pré-filtrer avant l'appel Claude plutôt
  // que de tronquer les descriptions (insuffisant : même sans description le
  // catalogue entier dépasse déjà la limite).
  // NB : tags/category viennent de /resources toujours vides/hardcodés
  // (SKILL.md n'a que name/description en frontmatter) — le score se base
  // donc sur le recouvrement de mots entre le projet et name+description.
  const stopwords = new Set(['avec','sans','pour','dans','sur','les','des','une','aux','par']);
  const tokens = `${project.desc} ${project.stack||''} ${project.goals||''}`
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter(w => w.length >= 4 && !stopwords.has(w));
  const keywordSet = new Set(tokens);

  const candidates = resources
    .map(r => {
      const haystack = `${r.name} ${r.description}`.toLowerCase();
      let score = 0;
      for (const w of keywordSet) if (haystack.includes(w)) score += 1;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(s => s.r);

  const resList = candidates.map(r =>
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
</ressources_disponibles>`;

  const res = await claudeToolCall('claude-sonnet-5', {
    system: 'Tu sélectionnes des ressources pertinentes pour un projet Claude Code. Renvoie UNIQUEMENT via l\'outil fourni.',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
    toolName: 'recommend_resources',
    schema: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          minItems: 5,
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              justification: { type: 'string', description: '1-2 phrases expliquant pourquoi cette ressource est utile pour CE projet spécifique' }
            },
            required: ['id', 'justification']
          }
        }
      },
      required: ['recommendations']
    }
  });
  return res.recommendations || [];
}

// ── Mode B: generate CLAUDE.md ────────────────────────────
async function apiGenerateClaudeMd(project, recsWithContent, decisions = '') {
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
${decisions ? `
<décisions_projet>
${decisions}
</décisions_projet>

RÈGLE ABSOLUE : les décisions ci-dessus (stack, base de données, seuils chiffrés, modèle de données) sont déjà actées dans la spec du projet. Reprends-les TELLES QUELLES — ne substitue jamais une techno ou une valeur différente.
` : ''}
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
    max_tokens: 4000
  });
}

// ── Mode B: generate all project docs in one call ─────────
async function apiGenerateAllDocs(project, claudeMd, conversation, decisions = '') {
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
${decisions ? `\n<décisions_projet>\n${decisions}\n</décisions_projet>\n\nRÈGLE ABSOLUE : stack, base de données, seuils chiffrés et modèle de données ci-dessus sont déjà actés — reprends-les tels quels, ne substitue rien.\n` : ''}
Contraintes :
- 200-350 mots par document
- markdown, français
- orchestrateur.md : ## Rôle, ## Agents disponibles (liste spécialistes à spawner selon tâche), ## Règles de coordination, ## Mémoire partagée
- prd : ## Vision, ## Utilisateurs cibles, ## Fonctionnalités (MoSCoW), ## Critères de succès, ## Contraintes
- architecture : ## Vue d'ensemble, ## Stack, ## Structure dossiers (arborescence), ## Flux de données, ## ADR`;

  return await claudeToolCall('claude-sonnet-5', {
    system: 'Tu génères 3 documents projet en markdown français. Renvoie UNIQUEMENT via l\'outil fourni.',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3500,
    toolName: 'generate_project_docs',
    schema: {
      type: 'object',
      properties: {
        orchestrateur: { type: 'string', description: 'Contenu markdown de orchestrateur.md' },
        prd: { type: 'string', description: 'Contenu markdown du PRD' },
        architecture: { type: 'string', description: 'Contenu markdown de ARCHITECTURE.md' }
      },
      required: ['orchestrateur', 'prd', 'architecture']
    }
  });
}

// ── Mode B: generate getting-started guide ────────────────
async function apiGenerateGuide(project, claudeMd, allDocs, conversation, decisions = '') {
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
${decisions ? `\n<décisions_projet>\n${decisions}\n</décisions_projet>\n\nRÈGLE ABSOLUE : stack, base de données, seuils chiffrés et choix d'architecture ci-dessus sont déjà actés dans la spec — le guide doit les reprendre TELS QUELS (mêmes technos, mêmes valeurs), ne substitue rien.\n` : ''}
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
    max_tokens: 3000
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

// ── Structured tool call (forced JSON via Anthropic tool use) ─────────
async function claudeToolCall(model, { system, messages, max_tokens = 2000, toolName, schema }) {
  const body = {
    model, max_tokens, messages,
    tools: [{ name: toolName, description: 'Structured output', input_schema: schema }],
    tool_choice: { type: 'tool', name: toolName }
  };
  if (system) body.system = system;
  const resp = await fetch('/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  if (data.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (max_tokens atteint)');
  const block = (data.content || []).find(b => b.type === 'tool_use');
  if (!block) throw new Error('Pas de sortie structurée dans la réponse');
  return block.input;
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
  if (data.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (max_tokens atteint) — augmente la limite pour cet appel');
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

// ── Mode C: Classify task complexity → model tier ────────
// Uses Sonnet (fast, cheap) — classification is a medium task
async function apiClassifyTask(taskDesc) {
  return await claudeToolCall('claude-sonnet-5', {
    system: `Tu es un routeur expert de la gamme de modèles Anthropic. Analyse la tâche décrite et choisis le tier au meilleur ratio coût/performance.

Tiers disponibles :
- haiku  (Haiku 4.5) : tâche simple et mécanique. Extraction, classification, reformatage, traduction courte, Q&R factuelle. Un seul passage, aucun jugement requis.
- sonnet (Sonnet 5)  : tâche standard. Rédaction structurée, analyse d'un document, code courant, résumé, contenu créatif bien cadré. Quasi-niveau Opus sur le code à coût réduit.
- opus   (Opus 4.8)  : tâche complexe. Sous-problèmes interdépendants, architecture logicielle, debug difficile, synthèse multi-sources, jugement nuancé, forte ambiguïté, long horizon.
- fable  (Fable 5)   : frontière. Preuve mathématique, raisonnement inédit, expertise PhD multi-domaines, travail agentique très long où Opus échouerait probablement, enjeu critique.

Règles de décision :
1. ≥ 2 sous-problèmes interdépendants → opus minimum
2. Expertise rare ou domaine à enjeu (juridique, médical, financier) avec jugement → opus minimum
3. Volumineux ≠ complexe : une tâche simple sur un long document reste haiku/sonnet
4. Créativité avec exigence de style → sonnet ; créativité + stratégie ou arbitrages → opus
5. Hésitation entre deux tiers → prends le supérieur et mets confidence < 0.7
6. fable est réservé aux cas où opus échouerait probablement — pas un opus « premium »`,
    messages: [{ role: 'user', content: `Tâche à classifier :\n\n${taskDesc}` }],
    max_tokens: 400,
    toolName: 'classify_task',
    schema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['haiku', 'sonnet', 'opus', 'fable'] },
        justification: { type: 'string', description: '1-2 phrases en français' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        signals: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 }
      },
      required: ['tier', 'justification', 'confidence', 'signals']
    }
  });
}

// ── Mode C: Generate boosted prompt for target tier ───────
// Uses Opus — prompt generation is a complex creative task
async function apiGenerateBoostedPrompt(taskDesc, tier, domain) {
  const TIER_STRATEGIES = {
    haiku: `TIER CIBLE : HAIKU 4.5 — tâche simple, vitesse maximale.
Stratégie : prompt ultra-direct, zéro overhead cognitif, instructions atomiques.
- PAS de <thinking>, pas de décomposition, pas d'auto-critique (surcharge inutile qui dégrade la latence)
- Rôle en 1 ligne, hyper-spécifique à la tâche (pas de "world-class expert" générique)
- Instructions séquentielles numérotées, chaque étape = 1 action atomique et vérifiable
- <output_format> avec 1 exemple concret inline montrant EXACTEMENT la sortie attendue
- Cas limites explicitement traités (input vide, ambigu, hors sujet → quoi faire)
- 2-3 contraintes négatives max, uniquement celles qui préviennent les erreurs probables
- cot_required: false`,

    sonnet: `TIER CIBLE : SONNET 5 — tâche standard, quasi-niveau Opus sur le code et la rédaction.
Sonnet 5 a un thinking adaptatif natif et suit les instructions TRÈS littéralement.
Stratégie : structure XML nette + rôle expert + portée explicite.
- Rôle expert précis avec domaine d'autorité et contexte de travail
- Instructions XML (<role>, <instructions>, <context>, <output_format>) sans sur-échafaudage
- NE PAS forcer de CoT manuel ("think step by step" partout) — le thinking adaptatif s'en charge ; réserve "reason carefully before answering" à 1 sous-étape réellement difficile maximum
- Instruction de PORTÉE explicite : Sonnet 5 ne généralise pas silencieusement ("Apply this to EVERY section, not just the first")
- 1 exemple few-shot INPUT→OUTPUT si le format de sortie est ambigu
- Variable d'entrée {{NOM}} en majuscules, positionnée en fin de prompt
- cot_required: false`,

    opus: `TIER CIBLE : OPUS 4.8 — objectif : extraire une performance niveau FABLE 5.
Les 5 mécanismes de boost OBLIGATOIRES dans le system_prompt généré :

1. THINKING FORCÉ : "Before EVERY response, reason through the problem in <thinking></thinking> tags: explore at least 2 approaches, check assumptions, identify edge cases. Never skip this."

2. DÉCOMPOSITION MANDATÉE : "For any problem with 2+ parts: first list ALL sub-problems and your approach to each, then solve them one by one. Do not interleave."

3. CALIBRATION EXPERT : "You are a world-class expert in [domaine adapté à la tâche]. Your bar: the best published work in the field. If a junior professional could have produced it, redo it."

4. AUTO-CRITIQUE CONSTITUTIONNELLE : "After drafting, audit: (a) Is every claim accurate and supported? (b) What did I miss? (c) Is this the strongest possible structure? Revise once before responding."

5. PROTOCOLE INCERTITUDE : "Never fabricate. When confidence < 90% on a claim, flag it explicitly ('[à vérifier]', 'hypothèse:'). An acknowledged gap beats a confident error."

En plus : décision autonome sur les choix mineurs ("For minor choices, pick a reasonable option and note it rather than asking"), et ancrage des affirmations de progrès sur des éléments vérifiables.
- cot_required: true`,

    fable: `TIER CIBLE : FABLE 5 — tâche frontière.
RÈGLE D'OR : Fable 5 raisonne nativement en profondeur. Les prompts sur-prescriptifs (CoT forcé, étapes détaillées, échafaudage "think step by step") DÉGRADENT sa performance. Prescris le QUOI, jamais le COMMENT.
Stratégie : objectif net + contexte maximal + barre de qualité explicite.
- Rôle avec autorité et mission claires, SANS lui dicter sa méthode de raisonnement
- <context> le plus riche possible : pourquoi la tâche existe, pour qui, ce que le résultat permet, contraintes réelles ("Give the reason, not just the request")
- Objectif formulé comme critères de succès vérifiables, pas comme séquence d'étapes
- 1-2 exemples few-shot de TRÈS haute qualité montrant le NIVEAU attendu (pas le procédé)
- <output_format> avec critères de qualité explicites (profondeur, précision, sources)
- Contraintes de périmètre : ce qui est HORS scope, quand s'arrêter, incertitude signalée explicitement
- Anti-surplanification : "When you have enough information to act, act."
- cot_required: false (le thinking est natif et toujours actif)`
  };

  const res = await claudeToolCall('claude-opus-4-8', {
    system: `Tu es un prompt engineer expert de la gamme Anthropic. Tu génères des prompts "boostés" qui extraient le maximum de performance du modèle cible — chaque tier a une stratégie différente et incompatible avec les autres : applique STRICTEMENT celle du tier demandé.

Règles absolues :
- Le system_prompt est en anglais (meilleure performance), adapté au domaine de la tâche — jamais générique
- Le user_template est dans la langue de la tâche et contient les {{VARIABLES}} en MAJUSCULES
- XML tags Anthropic (<role>, <instructions>, <context>, <examples>, <output_format>, <constraints>) — pas de markdown dans les prompts générés
- Chaque variable du user_template apparaît dans "variables"
- usage_tips : 2-4 conseils concrets et spécifiques à CETTE tâche (où coller le prompt, quoi mettre dans les variables, comment itérer) — pas de généralités

${TIER_STRATEGIES[tier]}`,
    messages: [{ role: 'user', content: `Génère un prompt boosté pour cette tâche.

Tâche : ${taskDesc}${domain ? `\nDomaine : ${domain}` : ''}
Tier cible : ${tier}` }],
    max_tokens: 8000,
    toolName: 'boosted_prompt',
    schema: {
      type: 'object',
      properties: {
        system_prompt: { type: 'string' },
        user_template: { type: 'string' },
        variables: { type: 'array', items: { type: 'string' } },
        usage_tips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
        cot_required: { type: 'boolean' }
      },
      required: ['system_prompt', 'user_template', 'variables', 'usage_tips', 'cot_required']
    }
  });

  // Réconciliation locale : la vérité = les {{VARS}} présentes dans le template
  const found = [...new Set((res.user_template.match(/\{\{([A-Z0-9_]+)\}\}/g) || [])
    .map(v => v.slice(2, -2)))];
  res.variables = found;
  return res;
}

// ── Mode Forge: LoopForge API wrappers ───────────────────
// En localhost, cible l'instance locale (dev sans redéployer) ; sinon
// l'instance Railway. La clé n'est pas un vrai secret côté navigateur
// (visible via "Afficher le code source") — elle filtre le scan
// automatique aléatoire d'une URL Railway obscure, pas un attaquant ciblé.
const LF_API = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:8123'
  : 'https://loopforge-said.fly.dev';
const LF_API_KEY = '1F2U07uwNGgLA_w8M_HYbSFGLkZsJNruDQXAGk9IaYM';

function lfHeaders(json) {
  const h = { 'X-Api-Key': LF_API_KEY };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function apiForgeCreateRun(objective, context = '', max_iterations = 2, quality_threshold = 8.0) {
  const r = await fetch(`${LF_API}/runs`, {
    method: 'POST',
    headers: lfHeaders(true),
    body: JSON.stringify({ objective, context, max_iterations, quality_threshold })
  });
  if (!r.ok) throw new Error('Erreur création run: ' + r.status);
  return r.json();
}

async function apiForgeGetStatus(runId) {
  const r = await fetch(`${LF_API}/runs/${runId}`, { headers: lfHeaders() });
  if (!r.ok) throw new Error('Erreur statut: ' + r.status);
  return r.json();
}

async function apiForgeAnswer(runId, answer) {
  const r = await fetch(`${LF_API}/runs/${runId}/answer`, {
    method: 'POST',
    headers: lfHeaders(true),
    body: JSON.stringify({ answer })
  });
  if (!r.ok) throw new Error('Erreur réponse: ' + r.status);
  return r.json();
}

async function apiForgeGetDocuments(runId) {
  const r = await fetch(`${LF_API}/runs/${runId}/documents`, { headers: lfHeaders() });
  if (!r.ok) throw new Error('Erreur documents: ' + r.status);
  return r.json();
}

Object.assign(window, {
  claudeCall, claudeCallWith, claudeToolCall,
  apiRefinePrompt, apiRestructure, apiRefineChat,
  apiLoadResources, apiLoadResourceFile,
  apiRecommendResources, apiGenerateClaudeMd, apiBrainstormChat,
  apiGenerateAllDocs, apiGenerateGuide,
  apiClassifyTask, apiGenerateBoostedPrompt,
  apiForgeCreateRun, apiForgeGetStatus, apiForgeAnswer, apiForgeGetDocuments
});
