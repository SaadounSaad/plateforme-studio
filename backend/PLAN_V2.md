# Plan v2 - Plateforme unifiée (LoopForge + Prompt Perfect B/C)

> Réfs : conception validée session 2026-07-12, PRD/SPEC dogfood dans `output/v2/`
> (générés par LoopForge v1 sur son propre objectif v2, coût 0,24 $).
> Règle absolue : une fonctionnalité = un hook ou un noeud. Noyau v1 intact.

## Enseignements du run dogfood (preuves, pas théorie)

1. **Critique trop clémente** : score 8.0/10 = exactement le seuil, verdict accept
   à l'itération 0, boucle refine jamais exercée. Le juge rubrique seul ne suffit
   pas - confirme le levier "critique par consommation".
2. **Incohérence non détectée** : le SPEC généré déclare "localStorage,
   persistance légère" (§2) tout en définissant 7 entités relationnelles (§3).
   Un implémenteur simulé l'aurait bloquée.
3. **Clarification efficace** : 1 seule question posée sur contexte riche -
   le noeud ask dose correctement. Pas de chantier ici.
4. **Coût déjà bas** (0,24 $) - le routage cascade est un gain réel mais pas
   le goulot. La qualité passe avant le coût dans l'ordre des phases.

## Idées du dogfood adoptées (le run a enrichi ma conception)

- Risque "discipline d'usage" : volant d'apprentissage et jeu doré ne produisent
  rien si non alimentés → automatiser journalisation et régression (jamais manuel).
- Borne dure d'itérations sur la boucle implémenteur (max 5) - convergence non garantie.
- Fréquence de resynchronisation de l'index catalogue : hors v2, documentée comme limite.
- Intégration UI en avant-dernier - le moteur doit être complet avant le frontend.

## Phases (chacune laisse la plateforme utilisable)

### Phase 0 - Harnais d'évaluation [tout le reste est aveugle sans lui]
- Jeu doré : les 2 runs existants (dashboard conso, plateforme v2) + 3 projets à venir.
- Script `eval/run_gold.py` : rejoue le jeu doré, score rubrique + comptage
  d'ambiguïtés bloquantes + coût. Régression obligatoire avant tout changement de prompt.
- Table `RunLog` (SQLite) : noeud, modèle, coût, latence, cache_hit.
- Critère : rapport comparatif automatique entre deux versions de prompts sur 5 projets.

### Phase 1 - Implémenteur simulé [plus gros levier qualité, prouvé par le dogfood]
- Nouveau noeud `implementer_critique` en parallèle du juge rubrique : lit le SPEC,
  liste les ambiguïtés qui bloqueraient un agent codeur. Sortie structurée
  (catégorie, localisation, question à trancher).
- Verdict accept exige désormais : score >= seuil ET zéro ambiguïté bloquante.
- Borne : max 5 itérations, sortie propre avec ambiguïtés résiduelles listées en
  tête de SPEC.
- Critère : l'incohérence localStorage/modèle relationnel du dogfood est détectée
  en rejeu.

### Phase 2 - Volant d'apprentissage
- Table `Finding` : catégorie, description, occurrences, promu.
- Hook post-critique : journalise chaque finding. Promotion automatique en
  system prompt du draft après 3 récurrences inter-projets.
- Critère : un finding promu ne réapparaît plus sur le jeu doré (mesuré Phase 0).

### Phase 3 - Budget de questions dans la boucle
- Hook sur refine : ambiguïté que le refine ne peut trancher seul → question à
  l'humain (interrupt), budget global 5 questions run entier, 1-2 max en amont.
- Critère : sur projet à contexte pauvre, les questions post-draft sont majoritaires.

### Phase 4 - Routage cascade + cache research
- `cascade_router` en hook transverse : tentative modèle cheap → vérif Haiku →
  escalade. `research_cache` ChromaDB (clé = hash objectif+contexte).
- Critère : coût médian jeu doré < 0,15 $ sans perte de score, cache hit sur rejeu.

### Phase 5 - Drafts parallèles + fusion
- Sous-graphes PRD / SPEC / CLAUDE.md (LangGraph Send) + noeud `fusion_coherence`
  qui détecte les contradictions inter-docs.
- Critère : 3 docs produits, zéro contradiction sur jeu doré, latence réduite.

### Phase 6 - Skills : index sémantique + section SPEC + scaffold
- Index ChromaDB : catalogue awesome-claude-code + `~/.claude/skills`.
- Noeud `skills_recommender` post-research ; section "Skills recommandés"
  obligatoire dans le SPEC (nom, justification, installation).
- `scaffold_installer` PowerShell : crée le projet, installe les skills.
- Critère : 100 % des SPEC portent la section ; scaffold s'exécute sans erreur.

### Phase 7 - API + UI
- FastAPI autour de `build_graph()`, interrupts → websocket.
- Frontend : UX Prompt Perfect Mode B réutilisée (plateforme-studio), le chat
  brainstorm pilote les interrupts. CLI conservé.
- Critère : parcours complet idée → scaffold depuis le navigateur.

### Phase 8 - Forge (optionnel, flag explicite)
- `forge_executor` : `claude -p` headless sur le scaffold jusqu'à tests verts.
  Désactivé par défaut, plafond de coût dédié, arrêt sur échec explicite.
- Critère : déclenchement uniquement manuel, jamais silencieux.

## Divergence assumée avec le SPEC dogfood

Le SPEC généré place le routage cascade en étape 2 ; ce plan le place en Phase 4.
Raison : le dogfood prouve que le goulot est la qualité de critique (accept à
l'itération 0, incohérence ratée), pas le coût (0,24 $). On mesure (Phase 0),
on fiabilise (Phases 1-3), on optimise (Phase 4+).
