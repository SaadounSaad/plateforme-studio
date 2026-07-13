# Plan d'intégration — LoopForge dans Prompt Perfect (mode unifié « Forge »)

> Décision Said 2026-07-13 : Prompt Perfect ne garde que DEUX modes —
> Mode A (Prompt XML, inchangé) et un mode unifié « Forge » qui fusionne
> Mode B (pipeline Claude Code) + Mode C (routage) + LoopForge (moteur).
> Réfs : conception v2 (Projets/loopforge.md session 2), PLAN_V2.md.

## Architecture cible

```
Prompt Perfect (plateforme-studio, React/Babel, port 3000)
├── Mode A  : Prompt XML                     [INCHANGÉ]
└── Mode Forge : idée -> projet documenté    [NOUVEAU, remplace B et C]
        |  fetch localhost:8123 (polling)
        v
LoopForge API (FastAPI, port 8123, NOUVEAU fichier loopforge/api.py)
        v
build_graph() existant — ask/research/draft/critique/implementer_critique/refine/output
```

## Décisions verrouillées

1. **Backend = wrapper, zéro modification du noyau.** `loopforge/api.py` est un
   nouveau fichier (règle « un hook ou un noeud » respectée). Le graphe tourne
   dans un thread de fond par run ; le checkpointer MemorySaver existant gère
   les interrupts.
2. **Polling, pas de websocket.** Le frontend est du Babel/CDN sans build ; le
   pattern fetch existant (api.jsx) se transpose tel quel. Un GET de statut
   toutes les 2 s pendant les phases longues suffit largement.
3. **CORS direct** frontend (3000) -> API (8123). Pas de proxy via server.js :
   deux services indépendants, couplage minimal.
4. **Sort de Mode B et survit dans Forge** : chat de clarification (ChatStep),
   Stepper de phases, recommandations catalogue awesome-claude-code,
   génération CLAUDE.md, scaffold PS1, bibliothèque localStorage, Accordions
   de livrables. Ces générations restent côté frontend/proxy (appels /v1/messages
   existants), branchées sur le PRD/SPEC produits par LoopForge.
5. **Sort de Mode C et survit ailleurs** : les prompts de boost par tier sont
   absorbés dans `loopforge/prompts.py` (amélioration future) ; la
   classification de complexité attend la Phase 4 (routage cascade) du PLAN_V2.
   L'onglet C meurt sans remplacement direct.
6. **Les onglets B et C ne sont retirés qu'à l'étape 4**, une fois Forge
   au niveau fonctionnel équivalent. Pas de suppression avant parité.

## Contrat API (loopforge/api.py)

| Endpoint | Rôle |
|---|---|
| `POST /runs` `{objective, context, max_iterations?, quality_threshold?}` | Démarre un run dans un thread de fond ; retourne `{run_id}` |
| `GET /runs/{id}` | `{status: running\|waiting_answer\|done\|error, phase, question?, cost_usd, iteration, n_ambiguites}` |
| `POST /runs/{id}/answer` `{answer}` | Résout l'interrupt courant, relance le run |
| `GET /runs/{id}/documents` | `{PRD: str, SPEC: str}` (état final ou meilleure passe) |

État en mémoire (dict run_id -> {thread, graph, config, dernier statut}).
Un seul run simultané suffit (usage solo) — pas de queue.

## Étapes d'exécution (chacune livrable et testable seule)

### Étape 1 — API backend (~150 lignes, brief Sonnet)
- `loopforge/api.py` : FastAPI + CORS + endpoints ci-dessus, thread de fond,
  interrupt LangGraph -> statut `waiting_answer` + question exposée.
- `requirements.txt` : + fastapi, uvicorn.
- Critère : scénario curl complet (create -> question -> answer -> ... -> documents)
  sur le cas dashboard-conso du jeu doré.

### Étape 2 — Mode Forge MVP (~300 lignes, brief Sonnet)
- `plateforme-studio/public/pp/modeForge.jsx` + onglet dans app.jsx +
  script dans prompt-perfect.html.
- Formulaire objectif/contexte -> chat clarifications (réutilise le pattern
  ChatStep) -> Stepper des phases (ask/recherche/rédaction/critique/raffinement)
  alimenté par polling -> PRD/SPEC en Accordions + téléchargement + coût affiché.
- Critère : run complet depuis le navigateur, docs téléchargés.

### Étape 3 — Rapatriement des livrables B (~1 session Sonnet)
- Dans Forge, après PRD/SPEC : bouton « Compléter le projet » qui enchaîne les
  appels existants de Mode B (recommandations catalogue, CLAUDE.md, scaffold
  PS1, guide) en leur passant le PRD/SPEC LoopForge comme contexte.
- Bibliothèque localStorage commune (schéma de Mode B étendu : + PRD/SPEC/coût).
- Critère : un projet Forge sauvegardé contient PRD, SPEC, CLAUDE.md, PS1.

### Étape 4 — Bascule (~30 min)
- Retirer les onglets B et C de app.jsx (code JSX conservé sur disque, une
  release de recul avant suppression).
- README des deux projets mis à jour.

## Hors périmètre (assumé)
- Websocket/streaming temps réel, multi-runs parallèles, checkpointer Postgres.
- Cascade/classification (PLAN_V2 Phase 4) et index skills sémantique (Phase 6)
  — Forge les récupérera automatiquement quand le moteur les aura.

## Exécution recommandée
Étapes 1-2 : briefs détaillés à un agent Sonnet 5 (pattern Phase 1 : brief +
critère mécanique + revue de diff avant commit). Étape 3 : Sonnet avec accès
aux deux repos. Vérification à chaque étape avant la suivante.
