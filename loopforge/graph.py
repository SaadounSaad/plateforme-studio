r"""Assemblage du graphe LangGraph.

        START
          |
        [ask] <------------.
        /    \             |
 (done) |     '--> [answer]   <- interrupt : une question humaine à la fois
        v
    [research]
        v
     [draft]
        v
    [critique] <---.
      /     \      |
 (accept    '--> [refine]
  ou max)
      v
   [output]
      |
     END
"""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from .nodes import (answer_node, ask_node, critique_node, draft_node,
                    output_node, refine_node, research_node)
from .state import LoopForgeState


def _after_ask(state) -> str:
    return "research" if state.get("clarification_done") else "answer"


def _after_critique(state) -> str:
    last = state["critiques"][-1]
    max_iter = state.get("max_iterations", 2)
    if last["verdict"] == "accept" or state.get("iteration", 0) >= max_iter:
        return "output"
    return "refine"


def build_graph(checkpointer=None):
    """Compile le graphe. Un checkpointer est requis pour les interruptions
    (clarification humaine) - MemorySaver par défaut."""
    builder = StateGraph(LoopForgeState)

    builder.add_node("ask", ask_node)
    builder.add_node("answer", answer_node)
    builder.add_node("research", research_node)
    builder.add_node("draft", draft_node)
    builder.add_node("critique", critique_node)
    builder.add_node("refine", refine_node)
    builder.add_node("output", output_node)

    builder.add_edge(START, "ask")
    builder.add_conditional_edges("ask", _after_ask, ["answer", "research"])
    builder.add_edge("answer", "ask")
    builder.add_edge("research", "draft")
    builder.add_edge("draft", "critique")
    builder.add_conditional_edges("critique", _after_critique, ["refine", "output"])
    builder.add_edge("refine", "critique")
    builder.add_edge("output", END)

    return builder.compile(checkpointer=checkpointer or MemorySaver())
