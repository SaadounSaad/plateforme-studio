"""Noeuds du graphe LoopForge."""

import json
import re
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import interrupt

from .extensions import run_hooks
from .llm import get_llm, total_cost, track_usage
from .prompts import (CLARIFIER, CRITIC, DRAFTER, IMPLEMENTER_CRITIC,
                       REFINER, RESEARCHER)
from .templates import DOCUMENTS

MAX_QUESTIONS = 5  # plafond dur de la boucle de clarification


# ---------------------------------------------------------------- utilitaires

def _text(response) -> str:
    """Contenu texte d'une réponse LangChain (tolère les blocs multiples)."""
    c = response.content
    if isinstance(c, str):
        return c
    return "".join(p.get("text", "") for p in c if isinstance(p, dict))


def _parse_json(text: str) -> dict:
    """Extrait le premier objet JSON d'une réponse LLM (tolère les fences)."""
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1])


def _transcript(state) -> str:
    lines = [f"OBJECTIF : {state['objective']}"]
    if state.get("context"):
        lines.append(f"CONTEXTE : {state['context']}")
    for c in state.get("clarifications", []):
        lines.append(f"Q : {c['question']}\nR : {c['answer']}")
    return "\n".join(lines)


# ------------------------------------------------------------- clarification

def ask_node(state):
    """L'architecte décide : poser une question de plus, ou clore la phase."""
    updates = {"phase": "clarification"}
    llm = get_llm("architect", max_tokens=300)
    response = llm.invoke(
        [SystemMessage(content=CLARIFIER), HumanMessage(content=_transcript(state))]
    )
    track_usage(updates, "architect", response)
    try:
        data = _parse_json(_text(response))
    except (ValueError, json.JSONDecodeError):
        data = {"done": True}
    if data.get("done") or len(state.get("clarifications", [])) >= MAX_QUESTIONS:
        updates["clarification_done"] = True
    else:
        updates["pending_question"] = data["question"]
        options = data.get("options")
        updates["pending_options"] = options if isinstance(options, list) and options else None
    return updates


def answer_node(state):
    """Interrompt le graphe et attend la réponse humaine (une seule question)."""
    answer = interrupt({
        "question": state["pending_question"],
        "options": state.get("pending_options"),
    })
    return {
        "clarifications": [
            {"question": state["pending_question"], "answer": str(answer).strip()}
        ]
    }


# ----------------------------------------------------------------- recherche

def research_node(state):
    updates = {"phase": "recherche"}
    # Rappel RAG des projets antérieurs (optionnel : chromadb absent -> ignoré)
    memory_context = ""
    try:
        from .memory import VectorMemory
        memory_context = VectorMemory().recall(state["objective"])
    except Exception:
        pass
    updates["memory_context"] = memory_context

    payload = _transcript(state)
    if memory_context:
        payload += f"\n\nCONTEXTE MÉMOIRE (projets antérieurs) :\n{memory_context}"

    llm = get_llm("worker", max_tokens=2000)
    response = llm.invoke(
        [SystemMessage(content=RESEARCHER), HumanMessage(content=payload)]
    )
    track_usage(updates, "worker", response)
    updates["research_findings"] = _text(response)
    run_hooks("post_research", state, updates)
    return updates


# ----------------------------------------------------------------- rédaction

def draft_node(state):
    updates = {"phase": "rédaction", "documents": {}}
    # 10000 : un SPEC complexe raffiné dépasse 6000 tokens -> troncature en fin
    # de document (constaté sur le cas doré plateforme-v2)
    llm = get_llm("worker", max_tokens=10000)
    base = (
        f"{_transcript(state)}\n\nNOTE DE CADRAGE :\n{state['research_findings']}"
    )
    for name, template in DOCUMENTS.items():
        response = llm.invoke([
            SystemMessage(content=DRAFTER),
            HumanMessage(content=f"DOCUMENT À PRODUIRE : {name}\n\nTEMPLATE :\n{template}\n\n{base}"),
        ])
        track_usage(updates, "worker", response)
        updates["documents"][name] = _text(response)
    run_hooks("post_draft", state, updates)
    return updates


# ------------------------------------------------------------------ critique

def critique_node(state):
    updates = {"phase": "critique"}
    llm = get_llm("architect", max_tokens=1500)
    docs = "\n\n".join(f"=== {k} ===\n{v}" for k, v in state["documents"].items())
    response = llm.invoke([
        SystemMessage(content=CRITIC),
        HumanMessage(content=f"{_transcript(state)}\n\n{docs}"),
    ])
    track_usage(updates, "architect", response)
    try:
        data = _parse_json(_text(response))
    except (ValueError, json.JSONDecodeError):
        # Échec de parsing -> on accepte plutôt que de boucler à l'infini
        data = {"score": 10.0, "issues": []}
    score = float(data.get("score", 0))
    verdict = "accept" if score >= state.get("quality_threshold", 8.0) else "revise"
    updates["critiques"] = [{
        "iteration": state.get("iteration", 0),
        "score": score,
        "verdict": verdict,
        "issues": data.get("issues", []),
    }]
    return updates


# ------------------------------------------------ critique par consommation

def implementer_critique_node(state):
    """Lit les documents comme un implémenteur sans accès à l'auteur - relève
    les ambiguïtés bloquantes que le critique rubrique (trop clément) rate."""
    updates = {"phase": "critique_implementation"}
    llm = get_llm("architect", max_tokens=1500)
    docs = "\n\n".join(f"=== {k} ===\n{v}" for k, v in state["documents"].items())
    response = llm.invoke([
        SystemMessage(content=IMPLEMENTER_CRITIC),
        HumanMessage(content=docs),
    ])
    track_usage(updates, "architect", response)
    try:
        data = _parse_json(_text(response))
    except (ValueError, json.JSONDecodeError):
        data = {"ambiguites": []}
    issues = data.get("ambiguites", [])
    updates["implementer_issues"] = issues

    # Garder-le-meilleur : composite = score rubrique - 2 par ambiguïté bloquante.
    # Le refine peut dégrader (sur-raffinement, sortie cassée) ; on ne garde jamais
    # une passe pire que la meilleure vue. Égalité -> on garde la première (>).
    composite = state["critiques"][-1]["score"] - 2.0 * len(issues)
    if composite > state.get("best_composite", float("-inf")):
        updates["best_composite"] = composite
        updates["best_documents"] = dict(state["documents"])
    return updates


# --------------------------------------------------------------- raffinement

def refine_node(state):
    updates = {"phase": "raffinement", "documents": dict(state["documents"])}
    issues = state["critiques"][-1]["issues"]
    issues_text = "\n".join(f"- {i}" for i in issues)
    implementer_issues = state.get("implementer_issues", [])
    if implementer_issues:
        issues_text += "\n" + "\n".join(
            f"- {i['localisation']} : {i['probleme']} -> {i['question']}"
            for i in implementer_issues
        )
    llm = get_llm("worker", max_tokens=10000)
    for name, doc in state["documents"].items():
        response = llm.invoke([
            SystemMessage(content=REFINER),
            HumanMessage(content=f"DOCUMENT ({name}) :\n{doc}\n\nPROBLÈMES RELEVÉS :\n{issues_text}"),
        ])
        track_usage(updates, "worker", response)
        refined = _text(response)
        # Garde : une correction ciblée ne réduit pas un document de moitié.
        # Sortie vide/tronquée (erreur transitoire, max_tokens) -> on garde l'ancien.
        if len(refined) >= 0.5 * len(doc):
            updates["documents"][name] = refined
    updates["iteration"] = state.get("iteration", 0) + 1
    return updates


# -------------------------------------------------------------------- sortie

def output_node(state):
    updates = {"phase": "terminé"}
    run_hooks("pre_output", state, updates)

    out_dir = Path(state.get("output_dir", "output"))
    out_dir.mkdir(parents=True, exist_ok=True)
    # On promeut la meilleure version vue (garder-le-meilleur) en documents
    # finaux, pour que fichiers écrits ET état retourné soient cohérents.
    documents = state.get("best_documents") or state["documents"]
    updates["documents"] = documents
    for name, doc in documents.items():
        (out_dir / f"{name}.md").write_text(doc, encoding="utf-8")

    # Mémorisation du projet pour les runs futurs (RAG)
    try:
        from .memory import VectorMemory
        summary = f"{state['objective']}\n{state['research_findings']}"
        VectorMemory().store(doc_id=state["objective"][:64], text=summary)
    except Exception:
        pass

    last = state["critiques"][-1]
    print(f"\n[LoopForge] Documents écrits dans {out_dir.resolve()}")
    print(f"[LoopForge] Score final : {last['score']}/10 "
          f"({state.get('iteration', 0)} raffinement(s))")
    print(f"[LoopForge] Coût total estimé : {total_cost(state)} $")
    return updates
