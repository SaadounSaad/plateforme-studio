# LoopForge

Transforme un objectif + contexte minimal en produit documenté (PRD + spec
technique) via une boucle agentique LangGraph : clarification une question à
la fois, recherche, rédaction, critique, raffinement automatique.

## Installation

```bash
pip install -r requirements.txt
```

Créer un fichier `.env` à la racine :

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Important : clé API dédiée (pay-per-token), jamais le quota d'abonnement
Claude.** Coût typique d'un run complet : 0,30 - 1,00 $ (affiché en fin de run).

Surcharges optionnelles du routage de modèles :

```
LOOPFORGE_MODEL_ARCHITECT=claude-opus-4-8
LOOPFORGE_MODEL_WORKER=claude-sonnet-5
LOOPFORGE_MODEL_UTILITY=claude-haiku-4-5
```

## Exécution

```bash
python examples/run_example.py
```

Le graphe pose ses questions de clarification une par une (5 max), puis produit
`output/PRD.md` et `output/SPEC.md` après une ou deux passes critique/raffinement.

## Architecture

```
START -> ask <-> answer (interrupt humain, 1 question à la fois)
           |
        research (RAG mémoire + note de cadrage)
           |
         draft (PRD + SPEC depuis templates stricts)
           |
        critique <-> refine (boucle jusqu'à score >= seuil ou max_iterations)
           |
         output (fichiers + mémorisation vectorielle + bilan de coût)
```

| Fichier | Rôle |
|---|---|
| `loopforge/state.py` | TypedDict central (accumulateurs annotés) |
| `loopforge/llm.py` | Routage modèles par rôle + suivi de coût |
| `loopforge/prompts.py` | Prompts système stricts (zéro bavardage) |
| `loopforge/templates.py` | Templates PRD / SPEC |
| `loopforge/nodes.py` | Noeuds du graphe |
| `loopforge/graph.py` | Assemblage LangGraph |
| `loopforge/memory.py` | Mémoire vectorielle persistante (ChromaDB local) |
| `loopforge/extensions.py` | Registre de hooks pour les extensions |

## Routage des modèles (coût / performance)

| Rôle | Modèle | Noeuds | Justification |
|---|---|---|---|
| architect | Opus 4.8 ($5/$25 par MTok) | ask, critique | Raisonnement profond requis : détecter l'information manquante, juger la qualité. Peu de tokens - coût marginal. |
| worker | Sonnet 5 ($3/$15) | research, draft, refine | Production du volume de tokens. Qualité rédactionnelle proche Opus à 40 % du prix. |
| utility | Haiku 4.5 ($1/$5) | (réservé aux extensions) | Extraction, classification, formatage. |

## Roadmap - fonctionnalités cibles et point d'ancrage

Le noyau v1 est volontairement minimal. Chaque fonctionnalité ambitieuse a un
point d'ancrage précis - aucune n'exige de refonte :

| Fonctionnalité | Point d'ancrage |
|---|---|
| Auto-research marché temps réel | hook `post_research` + outil web_search Anthropic |
| Génération multimodale (diagrammes, wireframes) | hook `post_draft` (Mermaid dans les docs, HTML wireframes) |
| Simulation d'impact, ROI, risques | nouveau noeud entre `research` et `draft` |
| Multi-agents hiérarchique, rôles dynamiques | sous-graphes LangGraph par document dans `draft` |
| Intégration DevOps / coding agents | hook `pre_output` (déclenche `claude -p` ou GitHub Actions) |
| Gouvernance, conformité, sécurité | hook `pre_output` (noeud de validation bloquant) |
| Collaboration multi-humains | checkpointer Postgres + plusieurs `thread_id` |
| Interface web + vocal | FastAPI autour de `build_graph()` (interrupts -> websocket) |
| Orchestration hybride local/cloud | `LOOPFORGE_MODEL_*` -> wrapper Ollama |
| Meta-loop d'auto-évolution | journal des critiques -> réécriture périodique des prompts |

Règle d'ajout : une fonctionnalité = un hook ou un noeud, jamais une
modification des noeuds existants.
