"""State central de LoopForge - TypedDict avancé partagé par tous les noeuds.

Les champs annotés avec `operator.add` sont des accumulateurs : chaque noeud
retourne un delta, LangGraph concatène.
"""

from operator import add
from typing import Annotated, Literal, TypedDict


class Clarification(TypedDict):
    question: str
    answer: str


class Critique(TypedDict):
    iteration: int
    score: float                       # 0-10
    verdict: Literal["accept", "revise"]
    issues: list[str]


class Usage(TypedDict):
    """Télémétrie d'un appel LLM - permet le suivi de coût par run."""
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


class LoopForgeState(TypedDict, total=False):
    # --- Entrée utilisateur ---
    objective: str                     # obligatoire
    context: str                       # optionnel

    # --- Phase clarification (une question à la fois) ---
    pending_question: str
    clarifications: Annotated[list[Clarification], add]
    clarification_done: bool

    # --- Phase recherche ---
    memory_context: str                # rappel RAG des projets antérieurs
    research_findings: str

    # --- Phase production ---
    documents: dict[str, str]          # nom -> contenu markdown (PRD, SPEC...)

    # --- Boucle critique / raffinement ---
    critiques: Annotated[list[Critique], add]
    iteration: int                     # nb de passes de raffinement effectuées
    max_iterations: int                # plafond (défaut : 2)
    quality_threshold: float           # score d'acceptation (défaut : 8.0)

    # --- Sortie / télémétrie ---
    phase: str
    output_dir: str
    usage: Annotated[list[Usage], add]
