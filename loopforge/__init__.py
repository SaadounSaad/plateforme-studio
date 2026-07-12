"""LoopForge - transforme un objectif + contexte minimal en produit documenté
(PRD + spec technique) via une boucle agentique LangGraph.

Noyau v1 : clarification -> recherche -> rédaction -> critique -> raffinement.
Extensions futures : voir extensions.py et la roadmap du README.
"""

from .graph import build_graph
from .state import LoopForgeState

__all__ = ["build_graph", "LoopForgeState"]
__version__ = "0.1.0"
