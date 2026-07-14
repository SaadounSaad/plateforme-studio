"""Routage des modèles par rôle - optimisation coût / performance / complexité.

Principe : le modèle le plus intelligent uniquement là où le raisonnement est
indispensable (clarification, critique) ; les tâches de production sur Sonnet ;
les tâches mécaniques sur Haiku. Surchargeable par variable d'environnement
LOOPFORGE_MODEL_<ROLE> (permet de brancher un autre provider via un wrapper).
"""

import os

from langchain_anthropic import ChatAnthropic

# Prix $/1M tokens (input, output)
PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
}

# rôle -> modèle par défaut
ROLES: dict[str, str] = {
    "architect": "claude-opus-4-8",   # questions de clarification, critique qualité
    "worker": "claude-sonnet-5",      # rédaction PRD/spec, synthèse recherche
    "utility": "claude-haiku-4-5",    # extraction, formatage, classification
}


def model_for(role: str) -> str:
    return os.getenv(f"LOOPFORGE_MODEL_{role.upper()}", ROLES[role])


def get_llm(role: str, max_tokens: int = 4096) -> ChatAnthropic:
    return ChatAnthropic(model=model_for(role), max_tokens=max_tokens)


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    p_in, p_out = PRICING.get(model, (0.0, 0.0))
    return (input_tokens * p_in + output_tokens * p_out) / 1_000_000


def track_usage(updates: dict, role: str, response) -> None:
    """Enregistre la consommation d'un appel LLM dans le delta de state."""
    meta = getattr(response, "usage_metadata", None) or {}
    model = model_for(role)
    entry = {
        "model": model,
        "input_tokens": meta.get("input_tokens", 0),
        "output_tokens": meta.get("output_tokens", 0),
    }
    entry["cost_usd"] = round(
        cost_usd(model, entry["input_tokens"], entry["output_tokens"]), 6
    )
    updates.setdefault("usage", []).append(entry)

    # Télémétrie RunLog (Phase 0) - no-op si LOOPFORGE_RUNLOG_DB absent
    from .runlog import log_usage
    log_usage(updates.get("phase", ""), entry)


def total_cost(state) -> float:
    return round(sum(u["cost_usd"] for u in state.get("usage", [])), 4)
