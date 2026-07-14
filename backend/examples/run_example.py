"""Exemple d'exécution LoopForge en ligne de commande.

Usage :
    python examples/run_example.py

Prérequis : ANTHROPIC_API_KEY dans l'environnement ou un fichier .env
(clé API dédiée pay-per-token - jamais le quota d'abonnement).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from langgraph.types import Command

from loopforge import build_graph

load_dotenv()


def main() -> None:
    objective = input("Objectif produit : ").strip()
    context = input("Contexte (optionnel) : ").strip()

    graph = build_graph()
    config = {"configurable": {"thread_id": "run-1"}}

    result = graph.invoke(
        {
            "objective": objective,
            "context": context,
            "max_iterations": 2,
            "quality_threshold": 8.0,
            "output_dir": "output",
        },
        config,
    )

    # Boucle de clarification : le graphe s'interrompt une question à la fois
    while "__interrupt__" in result:
        question = result["__interrupt__"][0].value["question"]
        answer = input(f"\n? {question}\n> ").strip()
        result = graph.invoke(Command(resume=answer), config)

    print("\nTerminé. Documents dans ./output/")


if __name__ == "__main__":
    main()
