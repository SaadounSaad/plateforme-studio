"""Templates de documents produits par LoopForge."""

PRD_TEMPLATE = """# PRD - {titre}

## 1. Problème
<!-- Le besoin, pour qui, pourquoi maintenant -->

## 2. Objectif et critères de succès
<!-- Objectif produit + 2-4 critères mesurables -->

## 3. Utilisateurs cibles
<!-- Personas concrets, cas d'usage principal de chacun -->

## 4. Périmètre v1
### Inclus
### Exclus (explicitement)

## 5. Parcours utilisateur principal
<!-- Étapes numérotées du parcours nominal -->

## 6. Exigences fonctionnelles
<!-- Liste priorisée : P0 (bloquant) / P1 / P2 -->

## 7. Risques et hypothèses
<!-- 3 risques max avec mitigation, hypothèses à valider -->
"""

SPEC_TEMPLATE = """# Spécification technique - {titre}

## 1. Vue d'ensemble de l'architecture
<!-- Composants, flux de données, schéma texte -->

## 2. Stack technique
<!-- Choix + justification en une ligne chacun -->

## 3. Modèle de données
<!-- Entités principales, champs clés, relations -->

## 4. Interfaces / API
<!-- Endpoints ou contrats principaux : méthode, entrée, sortie -->

## 5. Plan d'implémentation
<!-- Étapes ordonnées, chacune avec son critère de vérification -->

## 6. Points d'attention
<!-- Sécurité, performance, cas limites - uniquement le pertinent -->
"""

# nom de fichier -> template
DOCUMENTS: dict[str, str] = {
    "PRD": PRD_TEMPLATE,
    "SPEC": SPEC_TEMPLATE,
}
