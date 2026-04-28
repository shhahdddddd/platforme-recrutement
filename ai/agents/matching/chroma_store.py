"""
chroma_store.py

Persistent Vector Store using ChromaDB for candidate matching.
Includes an explicit upsert strategy for candidate CV updates.
"""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import chromadb

logger = logging.getLogger(__name__)


def _default_storage_path() -> str:
    """
    Resolve a stable Chroma storage path independent of process CWD.

    ai/agents/matching/chroma_store.py -> ../../data/chroma (inside ai/)
    """
    base = Path(__file__).resolve().parents[2] / "data" / "chroma"
    base.mkdir(parents=True, exist_ok=True)
    return str(base)


class VectorStore:
    """Persistent ChromaDB vector store."""

    def __init__(self, storage_path: Optional[str] = None, collection_name: str = "candidates") -> None:
        resolved_path = storage_path or _default_storage_path()
        self.client = chromadb.PersistentClient(path=resolved_path)
        self.collection = self.client.get_or_create_collection(name=collection_name)

    def add_or_update_candidate(self, candidate_id: str | int, embedding: List[float], cv_hash: str, profile: Dict[str, Any]):
        """
        EXPLICIT UPSERT STRATEGY:
        Prevents duplicate embeddings and ensures only the latest CV is indexed.
        """
        cid = str(candidate_id)
        
        # Check if candidate already exists
        existing = self.collection.get(ids=[cid])
        
        if existing and existing["ids"]:
            # Check if CV has changed via hash
            old_hash = existing["metadatas"][0].get("cv_hash")
            if old_hash == cv_hash:
                logger.info("Candidate %s embedding is up to date (hash match). Skipping.", cid)
                return
            
            # CV changed: delete old embedding to maintain unique mapping
            logger.info("Candidate %s CV changed (hash mismatch). Updating embedding.", cid)
            self.collection.delete(ids=[cid])

        # Add new embedding
        metadata = profile.copy() if profile else {}
        metadata["candidate_id"] = cid
        metadata["cv_hash"] = cv_hash
        
        # Serialize complex types to JSON for ChromaDB storage
        clean_metadata = {}
        for k, v in metadata.items():
            if isinstance(v, (str, int, float, bool)):
                clean_metadata[k] = v
            elif isinstance(v, (list, dict)):
                # Serialize complex data to JSON string
                clean_metadata[k] = json.dumps(v)
            else:
                # Skip other types
                continue

        self.collection.add(
            embeddings=[embedding],
            metadatas=[clean_metadata],
            ids=[cid]
        )
        logger.info("Stored embedding for candidate %s", cid)

    def get_candidate(self, candidate_id: str | int) -> Dict[str, Any] | None:
        """Get candidate by ID with deserialized metadata."""
        cid = str(candidate_id)
        try:
            result = self.collection.get(ids=[cid], include=["metadatas", "embeddings"])
            if result and result["ids"]:
                metadata = result["metadatas"][0] if result["metadatas"] else {}
                embedding = result["embeddings"][0] if result.get("embeddings") else None
                
                # Deserialize JSON strings back to original types
                deserialized = {}
                for k, v in metadata.items():
                    if isinstance(v, str):
                        # Try to parse as JSON
                        try:
                            deserialized[k] = json.loads(v)
                        except json.JSONDecodeError:
                            # Not JSON, keep as string
                            deserialized[k] = v
                    else:
                        deserialized[k] = v
                
                return {
                    "id": cid,
                    "embedding": embedding,
                    "profile": deserialized,
                    "metadata": deserialized
                }
        except Exception as e:
            logger.warning(f"Failed to get candidate {cid}: {e}")
        return None

    def get_by_candidate_id(self, candidate_id: str | int) -> Dict[str, Any] | None:
        """
        Backward-compatible wrapper used by older matching engines.

        Returns the legacy payload shape:
            {
                "embedding": [...],
                "metadata": {"profile": {...}, ...}
            }
        """
        candidate = self.get_candidate(candidate_id)
        if not candidate:
            return None

        metadata = candidate.get("metadata") or {}
        profile = metadata.get("profile")
        if not isinstance(profile, dict) or not profile:
            profile = {
                key: value
                for key, value in metadata.items()
                if key not in {"candidate_id", "cv_hash"}
            }

        legacy_metadata = dict(metadata)
        legacy_metadata["profile"] = profile
        return {
            "id": candidate.get("id"),
            "embedding": candidate.get("embedding"),
            "metadata": legacy_metadata,
        }

    def search(self, embedding: List[float], top_k: int = 50) -> List[Dict]:
        """Search for top_k nearest candidates."""
        if not embedding:
            return []

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k
        )

        output = []
        if not results or not results["ids"]:
            return []

        for i in range(len(results["ids"][0])):
            metadata = results["metadatas"][0][i]
            
            # Deserialize JSON strings
            deserialized = {}
            for k, v in metadata.items():
                if isinstance(v, str):
                    try:
                        deserialized[k] = json.loads(v)
                    except json.JSONDecodeError:
                        deserialized[k] = v
                else:
                    deserialized[k] = v
            
            output.append({
                "id": results["ids"][0][i],
                "similarity": 1.0 - results["distances"][0][i],
                "profile": deserialized,
                "metadata": deserialized
            })
            
        return output

    def count(self) -> int:
        return self.collection.count()

    def reset(self) -> None:
        """Wipes the collection."""
        self.client.delete_collection(name=self.collection.name)
        self.collection = self.client.get_or_create_collection(name=self.collection.name)
