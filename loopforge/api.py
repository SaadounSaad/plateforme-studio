"""API FastAPI pour LoopForge — wrapper autour du graphe LangGraph.

État en mémoire (dict run_id -> RunEntry). Usage solo : un seul run simultané.
Les interrupts sont exposés comme statut `waiting_answer` + question.
"""

import asyncio
import os
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from loopforge.graph import build_graph
from loopforge.llm import total_cost
from loopforge.state import LoopForgeState

# Charger les variables d'environnement depuis .env
load_dotenv()

app = FastAPI(title="LoopForge API", version="0.1.0")

# CORS — frontend Prompt Perfect (Vercel + dev local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clé API — protège les endpoints qui déclenchent des appels Anthropic payants.
# Si LOOPFORGE_API_KEY n'est pas définie, l'API reste ouverte (dev local sans .env).
_API_KEY = os.environ.get("LOOPFORGE_API_KEY")


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if _API_KEY and x_api_key != _API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide ou manquante")


# ------------------------------------------------------------------ modèles Pydantic

class CreateRunRequest(BaseModel):
    objective: str
    context: str = ""
    max_iterations: int = 2
    quality_threshold: float = 8.0


class AnswerRequest(BaseModel):
    answer: str


# ------------------------------------------------------------------ état runtime

class RunEntry:
    """Encapsule un run en cours : graph, config, et dernier statut."""

    def __init__(self, run_id: str, graph, config: dict):
        self.run_id = run_id
        self.graph = graph
        self.config = config
        self._status: dict = {"status": "starting", "phase": "initialisation"}
        self._lock = asyncio.Lock()
        self._pending_question: str | None = None
        self._final_state: dict | None = None
        self._error: str | None = None
        self._task: asyncio.Task | None = None

    async def set_status(self, **kwargs) -> None:
        async with self._lock:
            self._status.update(kwargs)

    async def get_status(self) -> dict:
        async with self._lock:
            return dict(self._status)

    def _build_initial_state(self) -> dict:
        return {
            "objective": self.config["objective"],
            "context": self.config["context"],
            "max_iterations": self.config.get("max_iterations", 2),
            "quality_threshold": self.config.get("quality_threshold", 8.0),
            "output_dir": f"output/{self.run_id}",
        }

    async def _check_interrupt(self) -> dict | None:
        """Vérifie si le graphe est bloqué sur un interrupt. Retourne le dict
        interrupt ou None."""
        try:
            state = self.graph.get_state(
                config={"configurable": {"thread_id": self.run_id}}
            )
        except Exception:
            return None

        # LangGraph 0.2+ : les interrupts sont dans state.tasks
        if hasattr(state, "tasks") and state.tasks:
            for task in state.tasks:
                interrupts = getattr(task, "interrupts", None)
                if interrupts:
                    # interrupts est une liste d'objets Interrupt
                    # Chaque interrupt a un attribut .value
                    val = interrupts[0].value if hasattr(interrupts[0], "value") else interrupts[0]
                    if isinstance(val, dict) and "question" in val:
                        return val
        return None

    async def _update_status_from_state(self, state: dict) -> None:
        """Met à jour le statut à partir de l'état du graphe."""
        phase = state.get("phase", "inconnu")
        cost = total_cost(state)
        iteration = state.get("iteration", 0)
        n_ambiguites = len(state.get("implementer_issues", []))
        await self.set_status(
            status="running",
            phase=phase,
            cost_usd=cost,
            iteration=iteration,
            n_ambiguites=n_ambiguites,
        )

    async def _run(self) -> None:
        """Coroutine principale : lance le graphe et gère les interrupts."""
        import traceback
        try:
            await self.set_status(status="running", phase="clarification")

            # Premier lancement
            async for event in self.graph.astream(
                self._build_initial_state(),
                config={"configurable": {"thread_id": self.run_id}},
            ):
                for node_name, update in event.items():
                    if isinstance(update, dict):
                        phase = update.get("phase")
                        if phase:
                            await self.set_status(phase=phase)

            # Vérifier interrupt
            interrupt = await self._check_interrupt()
            if interrupt:
                self._pending_question = interrupt["question"]
                await self.set_status(
                    status="waiting_answer",
                    phase="clarification",
                    question=interrupt["question"],
                    options=interrupt.get("options"),
                )
                return  # Attendre la réponse via POST /answer

            # Terminé
            await self._finalize()

        except Exception as e:
            tb = traceback.format_exc()
            self._error = f"{e}\n{tb}"
            await self.set_status(status="error", phase="erreur", error=str(e), traceback=tb[:500])

    async def _finalize(self) -> None:
        """Récupère l'état final et met à jour le statut."""
        try:
            state_obj = self.graph.get_state(
                config={"configurable": {"thread_id": self.run_id}}
            )
            final_state = state_obj.values if hasattr(state_obj, "values") else state_obj
        except Exception:
            final_state = {}

        self._final_state = final_state
        await self.set_status(
            status="done",
            phase=final_state.get("phase", "terminé"),
            cost_usd=total_cost(final_state),
            iteration=final_state.get("iteration", 0),
            n_ambiguites=len(final_state.get("implementer_issues", [])),
        )

    async def resume(self, answer: str) -> None:
        """Reprend le graphe après un interrupt avec la réponse humaine."""
        from langgraph.types import Command

        try:
            await self.set_status(status="running", phase="clarification")
            self._pending_question = None

            async for event in self.graph.astream(
                Command(resume=answer.strip()),
                config={"configurable": {"thread_id": self.run_id}},
            ):
                for node_name, update in event.items():
                    if isinstance(update, dict):
                        phase = update.get("phase")
                        if phase:
                            await self.set_status(phase=phase)

            # Vérifier si encore un interrupt
            interrupt = await self._check_interrupt()
            if interrupt:
                self._pending_question = interrupt["question"]
                await self.set_status(
                    status="waiting_answer",
                    phase="clarification",
                    question=interrupt["question"],
                    options=interrupt.get("options"),
                )
                return

            # Terminé
            await self._finalize()

        except Exception as e:
            self._error = str(e)
            await self.set_status(status="error", phase="erreur", error=str(e))


# run_id -> RunEntry
_RUNS: dict[str, RunEntry] = {}


# ------------------------------------------------------------------ endpoints

@app.post("/runs", dependencies=[Depends(require_api_key)])
async def create_run(req: CreateRunRequest) -> dict:
    """Démarre un nouveau run."""
    run_id = str(uuid.uuid4())[:8]
    graph = build_graph()
    entry = RunEntry(
        run_id=run_id,
        graph=graph,
        config={
            "objective": req.objective,
            "context": req.context,
            "max_iterations": req.max_iterations,
            "quality_threshold": req.quality_threshold,
        },
    )
    _RUNS[run_id] = entry

    # Lancer la coroutine en tâche de fond
    entry._task = asyncio.create_task(entry._run())

    return {"run_id": run_id}


@app.get("/runs/{run_id}", dependencies=[Depends(require_api_key)])
async def get_run(run_id: str) -> dict:
    """Retourne le statut courant du run."""
    entry = _RUNS.get(run_id)
    if not entry:
        return {"status": "error", "error": "Run not found"}

    status = await entry.get_status()
    # Enrichir avec les données dynamiques
    if entry._final_state:
        status["cost_usd"] = total_cost(entry._final_state)
        status["iteration"] = entry._final_state.get("iteration", 0)
        status["n_ambiguites"] = len(entry._final_state.get("implementer_issues", []))
    elif entry._error:
        status["error"] = entry._error

    return status


@app.post("/runs/{run_id}/answer", dependencies=[Depends(require_api_key)])
async def answer_run(run_id: str, req: AnswerRequest) -> dict:
    """Résout l'interrupt courant avec la réponse humaine."""
    entry = _RUNS.get(run_id)
    if not entry:
        return {"status": "error", "error": "Run not found"}

    current_status = await entry.get_status()
    if current_status.get("status") != "waiting_answer":
        return {"status": "error", "error": "Run is not waiting for an answer"}

    # Lancer la reprise en tâche de fond
    entry._task = asyncio.create_task(entry.resume(req.answer.strip()))

    return {"status": "running"}


@app.get("/runs/{run_id}/documents", dependencies=[Depends(require_api_key)])
async def get_documents(run_id: str) -> dict:
    """Retourne les documents finaux (PRD, SPEC) du run."""
    entry = _RUNS.get(run_id)
    if not entry:
        return {"PRD": "", "SPEC": "", "error": "Run not found"}

    state = entry._final_state
    if not state:
        # Run en cours — retourner best_documents si disponible
        try:
            state_obj = entry.graph.get_state(
                config={"configurable": {"thread_id": entry.run_id}}
            )
            state = state_obj.values if hasattr(state_obj, "values") else state_obj
        except Exception:
            state = None

    if not state:
        return {"PRD": "", "SPEC": "", "error": "Run not ready"}

    docs = state.get("best_documents") or state.get("documents") or {}
    return {
        "PRD": docs.get("PRD", ""),
        "SPEC": docs.get("SPEC", ""),
    }


# ------------------------------------------------------------------ health check

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "runs": len(_RUNS)}


# ------------------------------------------------------------------ entry point

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8123)))
