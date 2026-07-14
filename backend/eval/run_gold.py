"""Harnais d'évaluation LoopForge - Phase 0 du plan v2.

Rejoue chaque cas du jeu doré (eval/gold/*.json), puis note les documents
produits avec deux évaluateurs externes indépendants du critique interne :
- juge rubrique (4 axes : fidélité, cohérence, actionnabilité, concision)
- implémenteur simulé (compte les ambiguïtés bloquantes du SPEC)

Usage :
    python eval/run_gold.py                          # run + rapport baseline
    python eval/run_gold.py --only plateforme-v2     # un seul cas
    python eval/run_gold.py --baseline eval/reports/report_XXX.json
        # compare au rapport donné ; exit 1 si régression
        # (score global -0.5 ou ambiguïtés en hausse sur un cas)

Le rapport est écrit dans eval/reports/ (JSON + markdown), étiqueté par le
hash des prompts (prompts.py + templates.py) pour tracer les régressions.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from statistics import mean

PROJECT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT))

from dotenv import load_dotenv

load_dotenv(PROJECT / ".env")

GOLD_DIR = PROJECT / "eval" / "gold"
RUNS_DIR = PROJECT / "eval" / "runs"
REPORTS_DIR = PROJECT / "eval" / "reports"

AXES = ["fidelite", "coherence", "actionnabilite", "concision"]

EVAL_JUDGE = """Tu es le juge d'évaluation EXTERNE du harnais LoopForge - indépendant du
critique interne de la boucle. On te fournit la définition du besoin
(objectif, contexte, questions/réponses) et les documents produits.

Note chaque axe de 0 à 10, sévérité revue senior :
- fidelite : chaque exigence exprimée est couverte, rien d'inventé
- coherence : chiffres et périmètre identiques entre documents, aucune
  contradiction interne (une contradiction franche plafonne l'axe à 4)
- actionnabilite : un développeur démarre avec la SPEC telle quelle
- concision : zéro section de remplissage

Réponds UNIQUEMENT avec un objet JSON :
{"fidelite": <0-10>, "coherence": <0-10>, "actionnabilite": <0-10>,
 "concision": <0-10>, "commentaire": "<2 phrases max>"}"""

EVAL_IMPLEMENTER = """Tu es un agent développeur chargé d'implémenter le projet décrit par les
documents fournis, SANS accès à leur auteur. Liste UNIQUEMENT les ambiguïtés
BLOQUANTES : les points où tu devrais soit deviner une décision structurante,
soit t'arrêter pour demander.

Règles :
- Une contradiction interne (deux sections incompatibles) est toujours bloquante.
- Ignore tout détail que tu peux trancher seul par convention standard.
- Maximum 6 ambiguïtés, les plus graves d'abord.
- Concis : probleme et question en une phrase courte chacun.

Réponds UNIQUEMENT avec un objet JSON :
{"ambiguites": [{"localisation": "<section>", "probleme": "<quoi>",
                 "question": "<à poser à l'auteur>"}]}"""


def prompt_hash() -> str:
    h = hashlib.sha256()
    for name in ("prompts.py", "templates.py"):
        h.update((PROJECT / "loopforge" / name).read_bytes())
    return h.hexdigest()[:8]


def parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1])


def auto_answer(question: str, case: dict) -> str:
    q = question.lower()
    best, best_hits = None, 0
    for item in case.get("answers", []):
        hits = sum(1 for k in item["keywords"] if k in q)
        if hits > best_hits:
            best, best_hits = item["answer"], hits
    return best or case["default_answer"]


def run_case(case: dict, out_dir: Path) -> tuple[dict, list, float]:
    """Rejoue un cas doré. Retourne (état final, journal Q/R, durée s)."""
    from langgraph.types import Command

    from loopforge import build_graph

    graph = build_graph()
    config = {"configurable": {"thread_id": f"eval-{case['id']}"}}
    t0 = time.time()
    result = graph.invoke(
        {
            "objective": case["objective"],
            "context": case.get("context", ""),
            "max_iterations": case.get("max_iterations", 2),
            "quality_threshold": case.get("quality_threshold", 8.0),
            "output_dir": str(out_dir),
        },
        config,
    )
    qa = []
    while "__interrupt__" in result:
        question = result["__interrupt__"][0].value["question"]
        answer = auto_answer(question, case)
        qa.append({"question": question, "answer": answer})
        result = graph.invoke(Command(resume=answer), config)
    return result, qa, round(time.time() - t0, 1)


def eval_call(system: str, payload: str, retries: int = 1) -> tuple[dict, float]:
    """Appel évaluateur externe (architecte). Retourne (JSON, coût cumulé).

    Note : `temperature` est déprécié sur Opus 4.8 - le juge n'est donc pas
    déterministe ; la comparaison baseline tolère ±0.5 de bruit.
    Retry en cas de JSON invalide (réponse tronquée ou malformée)."""
    from langchain_anthropic import ChatAnthropic

    from loopforge.llm import cost_usd, model_for

    model = model_for("architect")
    llm = ChatAnthropic(model=model, max_tokens=3000)
    total = 0.0
    for attempt in range(retries + 1):
        response = llm.invoke([("system", system), ("human", payload)])
        meta = getattr(response, "usage_metadata", None) or {}
        total += cost_usd(
            model, meta.get("input_tokens", 0), meta.get("output_tokens", 0)
        )
        content = response.content
        if not isinstance(content, str):
            content = "".join(
                p.get("text", "") for p in content if isinstance(p, dict)
            )
        try:
            return parse_json(content), round(total, 6)
        except (ValueError, json.JSONDecodeError):
            if attempt == retries:
                raise
    raise RuntimeError("unreachable")


def score_case(case: dict, state: dict, qa: list) -> tuple[dict, float]:
    """Note les documents produits. Retourne (métriques, coût éval)."""
    transcript = f"OBJECTIF : {case['objective']}\nCONTEXTE : {case.get('context', '')}"
    for item in qa:
        transcript += f"\nQ : {item['question']}\nR : {item['answer']}"
    docs = "\n\n".join(f"=== {k} ===\n{v}" for k, v in state["documents"].items())

    judge, cost_j = eval_call(EVAL_JUDGE, f"{transcript}\n\n{docs}")
    impl, cost_i = eval_call(EVAL_IMPLEMENTER, docs)

    ambiguites = impl.get("ambiguites", [])
    scores = {axe: float(judge.get(axe, 0)) for axe in AXES}
    from loopforge.llm import total_cost

    metrics = {
        **scores,
        "eval_global": round(mean(scores.values()), 2),
        "commentaire_juge": judge.get("commentaire", ""),
        "n_ambiguites_bloquantes": len(ambiguites),
        "ambiguites": ambiguites,
        "score_interne": state["critiques"][-1]["score"],
        "iterations_refine": state.get("iteration", 0),
        "questions_posees": len(qa),
        "cout_run_usd": total_cost(state),
    }
    return metrics, round(cost_j + cost_i, 6)


def compare(report: dict, baseline: dict) -> tuple[list[str], bool]:
    """Compare deux rapports. Retourne (lignes de delta, régression?)."""
    lines, regression = [], False
    for case_id, m in report["cases"].items():
        b = baseline.get("cases", {}).get(case_id)
        if not b:
            lines.append(f"- {case_id} : absent de la baseline (nouveau cas)")
            continue
        d_score = round(m["eval_global"] - b["eval_global"], 2)
        d_amb = m["n_ambiguites_bloquantes"] - b["n_ambiguites_bloquantes"]
        flag = ""
        if d_score < -0.5 or d_amb > 0:
            regression = True
            flag = " **REGRESSION**"
        lines.append(
            f"- {case_id} : score {b['eval_global']} -> {m['eval_global']} "
            f"({d_score:+}), ambiguïtés {b['n_ambiguites_bloquantes']} -> "
            f"{m['n_ambiguites_bloquantes']} ({d_amb:+}){flag}"
        )
    return lines, regression


def write_report(report: dict, delta_lines: list[str] | None) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = report["timestamp"]
    json_path = REPORTS_DIR / f"report_{stamp}.json"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = [
        f"# Rapport d'évaluation - {stamp}",
        f"\nPrompts : `{report['prompt_hash']}` | Coût total : "
        f"{report['cout_total_usd']} $ (runs {report['cout_runs_usd']} $ "
        f"+ éval {report['cout_eval_usd']} $)\n",
        "| Cas | Global | Fid. | Coh. | Act. | Conc. | Ambig. | Interne | Refines | Q | Coût $ | Durée s |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for case_id, m in report["cases"].items():
        lines.append(
            f"| {case_id} | **{m['eval_global']}** | {m['fidelite']} | "
            f"{m['coherence']} | {m['actionnabilite']} | {m['concision']} | "
            f"{m['n_ambiguites_bloquantes']} | {m['score_interne']} | "
            f"{m['iterations_refine']} | {m['questions_posees']} | "
            f"{m['cout_run_usd']} | {m['duree_s']} |"
        )
    for case_id, m in report["cases"].items():
        if m["ambiguites"]:
            lines.append(f"\n## Ambiguïtés bloquantes - {case_id}\n")
            for a in m["ambiguites"]:
                lines.append(
                    f"- **{a.get('localisation', '?')}** : {a.get('probleme', '')} "
                    f"-> _{a.get('question', '')}_"
                )
        if m.get("commentaire_juge"):
            lines.append(f"\n**Juge ({case_id})** : {m['commentaire_juge']}")
    if delta_lines:
        lines.append("\n## Comparaison baseline\n")
        lines.extend(delta_lines)
    (REPORTS_DIR / f"report_{stamp}.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )
    return json_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="ne rejouer qu'un cas (id)")
    parser.add_argument("--baseline", help="rapport JSON de référence à comparer")
    args = parser.parse_args()

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    os.environ["LOOPFORGE_RUNLOG_DB"] = str(PROJECT / "eval" / "runlog.sqlite")
    os.environ["LOOPFORGE_MEMORY_PATH"] = str(RUNS_DIR / stamp / "_memory")

    cases = sorted(GOLD_DIR.glob("*.json"))
    if args.only:
        cases = [c for c in cases if c.stem == args.only]
    if not cases:
        print("Aucun cas doré trouvé.")
        return 2

    report = {
        "timestamp": stamp,
        "prompt_hash": prompt_hash(),
        "cases": {},
        "cout_runs_usd": 0.0,
        "cout_eval_usd": 0.0,
    }

    for path in cases:
        case = json.loads(path.read_text(encoding="utf-8"))
        print(f"\n=== {case['id']} ===")
        os.environ["LOOPFORGE_RUN_ID"] = f"{stamp}:{case['id']}"
        out_dir = RUNS_DIR / stamp / case["id"]
        out_dir.mkdir(parents=True, exist_ok=True)

        state, qa, duree = run_case(case, out_dir)
        metrics, cost_eval = score_case(case, state, qa)
        metrics["duree_s"] = duree
        report["cases"][case["id"]] = metrics
        report["cout_runs_usd"] = round(
            report["cout_runs_usd"] + metrics["cout_run_usd"], 4
        )
        report["cout_eval_usd"] = round(report["cout_eval_usd"] + cost_eval, 4)
        print(
            f"    global {metrics['eval_global']}/10, "
            f"{metrics['n_ambiguites_bloquantes']} ambiguïté(s) bloquante(s), "
            f"interne {metrics['score_interne']}/10, "
            f"run {metrics['cout_run_usd']} $"
        )

    report["cout_total_usd"] = round(
        report["cout_runs_usd"] + report["cout_eval_usd"], 4
    )

    delta_lines, regression = None, False
    if args.baseline:
        baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
        delta_lines, regression = compare(report, baseline)

    json_path = write_report(report, delta_lines)
    print(f"\nRapport : {json_path}")
    if delta_lines:
        print("\n".join(delta_lines))
    if regression:
        print("\nREGRESSION détectée - voir le rapport.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
