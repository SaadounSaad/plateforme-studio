// ============================================================
// data.jsx — Constants, helpers, builders, seed content
// ============================================================

// ── Form constants ────────────────────────────────────────
const STYLE_OPTS = [
  { v: 'prose',      l: 'Prose fluide' },
  { v: 'structured', l: 'Structuré (sections)' },
  { v: 'json',       l: 'JSON' },
  { v: 'liste',      l: 'Liste numérotée' },
  { v: 'tableau',    l: 'Tableau' },
];
const LANG_OPTS = [
  { v: 'fr',    l: 'Français soutenu' },
  { v: 'ar',    l: 'عربية فصحى' },
  { v: 'en',    l: 'English formel' },
  { v: 'same',  l: 'Même langue input' },
];
const CAT_OPTS = [
  { v: '',                      l: 'Catégorie…' },
  { v: 'Code',                  l: 'Code' },
  { v: 'RH',                    l: 'RH' },
  { v: 'Rémunération',          l: 'Rémunération' },
  { v: 'Communication Interne', l: 'Communication Interne' },
  { v: 'International',         l: 'International' },
  { v: 'Autre',                 l: 'Autre' },
];
const HOOK_TAGS = [];
const EMPTY_FORM = {
  role: '', goal: '', ctx: '', exInput: '', exOutput: '',
  style: 'prose', lang: 'fr', varName: '', fmtExtra: '', notes: ''
};
const EMPTY_PROJECT_B = { name: '', desc: '', stack: '', goals: '', domains: '' };

// ── XML builder ───────────────────────────────────────────
function buildXML(f) {
  const { role, goal, ctx, exInput, exOutput, style, lang, varName, fmtExtra, notes } = f;
  const ind = (n) => '  '.repeat(n);
  const L = [];
  L.push('<prompt>');
  if (role)    L.push(`${ind(1)}<role>\n${ind(2)}${role}\n${ind(1)}</role>`);
  if (goal)    L.push(`${ind(1)}<instructions>\n${ind(2)}${goal}\n${ind(1)}</instructions>`);
  if (ctx)     L.push(`${ind(1)}<context>\n${ind(2)}${ctx}\n${ind(1)}</context>`);
  if (exInput || exOutput) {
    L.push(`${ind(1)}<examples>`);
    L.push(`${ind(2)}<example index="1">`);
    L.push(`${ind(3)}<input>${exInput || '{{input}}'}</input>`);
    L.push(`${ind(3)}<output>${exOutput || '…'}</output>`);
    L.push(`${ind(2)}</example>`);
    L.push(`${ind(1)}</examples>`);
  }
  const styleFmt = { prose:'Prose fluide', structured:'Structuré', json:'JSON', liste:'Liste numérotée', tableau:'Tableau' };
  const langFmt  = { fr:'Français soutenu', ar:'عربية فصحى', en:'English formel', same:'Même langue input' };
  L.push(`${ind(1)}<output_format>\n${ind(2)}Style: ${styleFmt[style]||style}. Langue: ${langFmt[lang]||lang}.\n${ind(1)}</output_format>`);
  if (fmtExtra) L.push(`${ind(1)}<constraints>\n${ind(2)}${fmtExtra}\n${ind(1)}</constraints>`);
  if (notes)    L.push(`${ind(1)}<!-- ${notes} -->`);
  if (varName)  L.push(`${ind(1)}<input>\n${ind(2)}{{${varName.toUpperCase()}}}\n${ind(1)}</input>`);
  L.push('</prompt>');
  return L.join('\n');
}

// ── Claude.md builder (fallback if API fails) ─────────────
function buildClaudeMdFallback(p) {
  const { name='Projet', desc='', stack='', goals='' } = p;
  return `# ${name}

<project_context>
You are a senior developer working on ${name}. ${desc}${goals ? ` Your goal is: ${goals}` : ''}
</project_context>

<coding_standards>
${stack ? `## Stack\n${stack}\n\n` : ''}1. Follow existing code style and conventions
2. Write tests before implementing features
3. Keep files under 500 lines
4. Validate input at system boundaries only
</coding_standards>

<workflow>
For complex tasks (architecture, refactor, debug), think step-by-step in <thinking> tags before responding.
Break tasks >30min into subtasks. Commit after each working increment.
</workflow>

<constraints>
- NEVER commit secrets, credentials, or .env files
- NEVER add features beyond what was asked
- ALWAYS run tests before committing
- Match existing code style, even if imperfect
</constraints>`;
}

// ── PS1 script builder ────────────────────────────────────
// Encode content as Base64 to avoid heredoc termination issues ('@ in content)
function toB64(str) {
  try {
    // TextEncoder → Uint8Array → base64
    const bytes = new TextEncoder().encode(str || '');
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  } catch(e) { return btoa(unescape(encodeURIComponent(str || ''))); }
}

// Emit a PS1 snippet that decodes base64 and writes a file (UTF-8, no BOM)
function ps1WriteFile(b64, filePath) {
  return `[System.IO.File]::WriteAllText("${filePath}", [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')))`;
}

function buildPS1(proj, claudeMdContent, slashCmds, allDocs) {
  const name = proj.name || 'mon-projet';
  const slug = name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'mon-projet';
  const today = new Date().toLocaleDateString('fr-FR');
  const todayIso = new Date().toISOString().split('T')[0];

  const copyLines = (slashCmds || []).map(r =>
    `Copy-Item "$resourcesBase\\${r.path.replace(/\//g, '\\')}"`
    + ` "$projectPath\\.claude\\commands\\${r.id}.md" -Force`
  ).join('\n');

  const docsSection = allDocs ? `
# ── Documents de projet ────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path "$projectPath\\docs" | Out-Null
New-Item -ItemType Directory -Force -Path "$projectPath\\.claude\\agents" | Out-Null
${ps1WriteFile(toB64(allDocs.orchestrateur || ''), '$projectPath\\.claude\\agents\\orchestrateur.md')}
${ps1WriteFile(toB64(allDocs.prd || ''), '$projectPath\\docs\\PRD.md')}
${ps1WriteFile(toB64(allDocs.architecture || ''), '$projectPath\\docs\\ARCHITECTURE.md')}
Write-Host "✓ Docs générés (orchestrateur.md · PRD.md · ARCHITECTURE.md)"` : '';

  return `# Setup — ${name}
# Généré par Prompt Perfect le ${today}

$projectPath   = "C:\\Mes Projets\\${slug}"
$resourcesBase = "C:\\Mes Projets\\awesome-claude-code"

# ── Créer la structure ─────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $projectPath | Out-Null
New-Item -ItemType Directory -Force -Path "$projectPath\\.claude\\commands" | Out-Null
New-Item -ItemType Directory -Force -Path "$projectPath\\.claude\\memory" | Out-Null
Write-Host "✓ Dossier créé : $projectPath"

# ── Copier les slash-commands recommandés ─────────────────────────
${copyLines || '# (aucun slash-command recommandé)'}
${slashCmds?.length ? `Write-Host "✓ ${slashCmds.length} commande(s) installée(s) dans .claude/commands/"` : ''}

# ── CLAUDE.md ──────────────────────────────────────────────────────
${ps1WriteFile(toB64(claudeMdContent), '$projectPath\\CLAUDE.md')}
Write-Host "✓ CLAUDE.md généré"

# ── Registres mémoire ──────────────────────────────────────────────
@'
# BLOCKERS — ${name}

| Date | Contexte | Blocage | Contournement |
|------|----------|---------|---------------|
| ${todayIso} | Init | - | - |
'@ | Out-File -FilePath "$projectPath\\.claude\\memory\\BLOCKERS.md" -Encoding UTF8

@'
# ADR — ${name}

## ADR-001 : Initialisation
- Date : ${todayIso}
- Décision : Projet initialisé avec Prompt Perfect
- Conséquences : Structure .claude/ en place
'@ | Out-File -FilePath "$projectPath\\.claude\\memory\\ADR.md" -Encoding UTF8

@'
# ITERATION_LOG — ${name}

## ${todayIso}
- Projet initialisé via Prompt Perfect
'@ | Out-File -FilePath "$projectPath\\.claude\\memory\\ITERATION_LOG.md" -Encoding UTF8

@'
# PROGRESS — ${name}

## Statut : 🔴 Non démarré

- [ ] Phase 1 : Setup
- [ ] Phase 2 : Développement
- [ ] Phase 3 : Tests
- [ ] Phase 4 : Déploiement
'@ | Out-File -FilePath "$projectPath\\.claude\\memory\\PROGRESS.md" -Encoding UTF8
Write-Host "✓ Registres mémoire créés (.claude/memory/)"

# ── Settings Claude Code ───────────────────────────────────────────
@'
{
  "permissions": {
    "allow": ["Bash(git:*)", "Edit", "Write", "Read", "Glob", "Grep"],
    "deny": ["Bash(rm -rf *)", "Bash(curl:*)", "Bash(wget:*)"]
  }
}
'@ | Out-File -FilePath "$projectPath\\.claude\\settings.json" -Encoding UTF8
Write-Host "✓ .claude/settings.json créé"
${docsSection}
Write-Host ""
Write-Host "Projet prêt : $projectPath" -ForegroundColor Green`;
}

// ── XML colorizer → React elements ───────────────────────
function XMLView({ src }) {
  if (!src) return null;
  const lines = src.split('\n');
  const render = (line, k) => {
    const indent = (line.match(/^\s*/) || [''])[0].length;
    const trimmed = line.trim();
    let inner;
    if (trimmed.startsWith('<!--')) {
      inner = <span className="m">{trimmed}</span>;
    } else {
      const m = trimmed.match(/^(<\/?[\w_]+)(.*?)(\/?>)(.*?)(<\/[\w_]+>)?$/);
      if (m) {
        const attrParts = m[2].split(/([\w-]+="[^"]*")/g).map((p, i) => {
          const am = p.match(/^([\w-]+)=("[^"]*")$/);
          if (am) {
            return <React.Fragment key={i}><span className="a">{am[1]}</span>=<span className="s">{am[2]}</span></React.Fragment>;
          }
          return <span key={i}>{p}</span>;
        });
        inner = (<>
          <span className="t">{m[1]}</span>{attrParts}<span className="t">{m[3]}</span>
          {m[4] && <span className="c">{m[4]}</span>}
          {m[5] && <span className="t">{m[5]}</span>}
        </>);
      } else {
        inner = <span className="c">{trimmed}</span>;
      }
    }
    return <div key={k} style={{ paddingLeft: indent * 9 }}>{inner}</div>;
  };
  return <div>{lines.map(render)}</div>;
}

// ── Guide content ─────────────────────────────────────────
const GUIDE_WORKFLOW = [
  ['Définir le rôle', 'Attribue un rôle clair et expert à Claude — c\'est le levier le plus puissant.'],
  ['Énoncer l\'objectif', 'Une tâche précise, mesurable, formulée à l\'impératif.'],
  ['Donner le contexte', 'Marque, audience, contraintes métier : tout ce que Claude ignore.'],
  ['Ajouter des exemples', 'Le few-shot (INPUT → OUTPUT) cadre le format mieux que toute consigne.'],
  ['Structurer en XML', 'Les balises <role>, <instructions>… délimitent sans ambiguïté chaque section.'],
  ['Fixer le format', 'Style de sortie + langue + variable d\'entrée pour un résultat exploitable.'],
  ['Itérer & sauvegarder', 'Teste, ajuste, puis archive le prompt dans la bibliothèque.'],
];
const GUIDE_SKILLS = [
  'humanizer-fr', 'arabic-eloquence', 'analyse-document', 'extraction-json',
  'traduction-darija', 'résumé-exécutif', 'classification', 'génération-code', 'révision-style'
];

// ── Seed library ─────────────────────────────────────────
const SEED_LIBRARY = [
  { id: 'p1', title: 'Accroches publicitaires', cat: 'Marketing', lang: 'fr', date: '12 mai',
    xml: '<prompt>\n  <role>\n    Expert en marketing de contenu, ton chaleureux\n  </role>\n  <instructions>\n    Rédiger 5 accroches publicitaires pour un lancement\n  </instructions>\n  <output_format>\n    Style: Liste numérotée. Langue: Français soutenu.\n  </output_format>\n</prompt>',
    fields: null },
  { id: 'p2', title: 'Résumé article technique', cat: 'Rédaction', lang: 'fr', date: '9 mai',
    xml: '<prompt>\n  <role>\n    Vulgarisateur technique précis et concis\n  </role>\n  <instructions>\n    Résumer un article en 3 points clés\n  </instructions>\n  <output_format>\n    Style: Liste numérotée. Langue: Français soutenu.\n  </output_format>\n</prompt>',
    fields: null },
  { id: 'p3', title: 'Classificateur de tickets', cat: 'Support', lang: 'en', date: '3 mai',
    xml: '<prompt>\n  <role>\n    Support triage assistant\n  </role>\n  <instructions>\n    Classify a ticket into a category and priority\n  </instructions>\n  <output_format>\n    Style: JSON. Langue: English formel.\n  </output_format>\n</prompt>',
    fields: null },
];

// ── CC Brainstorm system prompt ───────────────────────────
const CC_BRAINSTORM_SYSTEM = `Tu es un consultant expert en architecture logicielle et Claude Code.
Ton rôle : affiner le projet par un dialogue structuré avant de recommander des ressources.

Format de chaque réponse :
1. Un résumé court (1-2 phrases) de ce que tu as compris jusqu'ici
2. UNE seule question ciblée, avec 2-4 options numérotées quand c'est pertinent :
   a) Option 1
   b) Option 2
   c) Autre (précise)
3. L'utilisateur répond, tu poses la question suivante

Règles absolues :
- Une seule question par réponse — jamais plusieurs en même temps
- Les options doivent être courtes et mutuellement exclusives
- Si la question est ouverte (pas de choix évidents), pose-la sans options
- Ne génère jamais de code, ne propose pas d'implémentation
- Ne recommande pas de ressources — c'est la prochaine étape
- Langue : adapte-toi à la langue de l'utilisateur`;

// ── Helpers ───────────────────────────────────────────────
function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Export all to window
Object.assign(window, {
  STYLE_OPTS, LANG_OPTS, CAT_OPTS, HOOK_TAGS, EMPTY_FORM, EMPTY_PROJECT_B,
  buildXML, buildClaudeMdFallback, buildPS1, XMLView,
  GUIDE_WORKFLOW, GUIDE_SKILLS, SEED_LIBRARY,
  CC_BRAINSTORM_SYSTEM, escHtml
});
