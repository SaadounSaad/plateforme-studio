"""Mémoire vectorielle persistante (RAG) - ChromaDB local.

Embeddings par défaut de Chroma (MiniLM local) : gratuits, aucun appel API.
Chaque projet finalisé est stocké ; les runs suivants rappellent le contexte
pertinent au moment de la recherche.
"""

from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / ".loopforge_memory"


class VectorMemory:
    def __init__(self, path: Path = DB_PATH):
        import chromadb  # import paresseux : dépendance optionnelle
        self._client = chromadb.PersistentClient(path=str(path))
        self._col = self._client.get_or_create_collection("loopforge")

    def store(self, doc_id: str, text: str, metadata: dict | None = None) -> None:
        self._col.upsert(
            ids=[doc_id],
            documents=[text[:8000]],  # Chroma : documents courts = rappel net
            metadatas=[metadata or {"source": "loopforge"}],
        )

    def recall(self, query: str, k: int = 3) -> str:
        if self._col.count() == 0:
            return ""
        res = self._col.query(query_texts=[query], n_results=min(k, self._col.count()))
        return "\n---\n".join(res["documents"][0])
