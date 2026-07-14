"""Points d'extension LoopForge.

Les fonctionnalités futures de la roadmap (voir README) se branchent ici sans
modifier le noyau : soit via un hook, soit en ajoutant un noeud dans graph.py.

Hooks disponibles (appelés avec (state, updates)) :
- post_research : enrichir la note de cadrage (web search, veille marché...)
- post_draft    : générer des artefacts additionnels (diagrammes, wireframes...)
- pre_output    : gouvernance, conformité, déclenchement d'agents de code...
"""

from collections import defaultdict
from typing import Callable

_HOOKS: dict[str, list[Callable]] = defaultdict(list)


def register(hook_name: str):
    """Décorateur : @register("post_research")"""
    def decorator(fn: Callable) -> Callable:
        _HOOKS[hook_name].append(fn)
        return fn
    return decorator


def run_hooks(hook_name: str, state, updates: dict) -> None:
    for fn in _HOOKS[hook_name]:
        fn(state, updates)
