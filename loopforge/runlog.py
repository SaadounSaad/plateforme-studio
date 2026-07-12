"""Journal des appels LLM - SQLite (Phase 0 du plan v2).

Activé uniquement si LOOPFORGE_RUNLOG_DB est défini (chemin du fichier .sqlite).
LOOPFORGE_RUN_ID identifie le run courant (défaut : "adhoc").
latency_ms et cache_hit sont réservés aux phases 4+ (nullables).
"""

import os
import sqlite3
import time

_SCHEMA = """CREATE TABLE IF NOT EXISTS runlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    ts REAL NOT NULL,
    node TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    latency_ms REAL,
    cache_hit INTEGER
)"""


def log_usage(node: str, entry: dict) -> None:
    """Insère un appel LLM dans le journal. Silencieux si non configuré."""
    db_path = os.getenv("LOOPFORGE_RUNLOG_DB")
    if not db_path:
        return
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute(_SCHEMA)
            conn.execute(
                "INSERT INTO runlog (run_id, ts, node, model, input_tokens, "
                "output_tokens, cost_usd, latency_ms, cache_hit) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
                (
                    os.getenv("LOOPFORGE_RUN_ID", "adhoc"),
                    time.time(),
                    node,
                    entry.get("model"),
                    entry.get("input_tokens", 0),
                    entry.get("output_tokens", 0),
                    entry.get("cost_usd", 0.0),
                ),
            )
    except sqlite3.Error:
        pass  # la télémétrie ne doit jamais casser un run
