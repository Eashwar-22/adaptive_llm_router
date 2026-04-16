from app.database import supabase
from app.utils.embeddings import engine
import json

class SemanticCacheManager:
    """
    Manages semantic caching using pgvector and embeddings.
    """
    def __init__(self, threshold: float = 0.95):
        self.threshold = threshold

    async def lookup(self, prompt: str):
        """
        Searches the semantic cache for a similar prompt.
        Returns the cached response if similarity > threshold.
        """
        try:
            # 1. Generate embedding for the incoming prompt
            embedding = engine.get_embedding(prompt)
            if not embedding:
                return None

            # 2. Call Supabase RPC for semantic similarity search
            # We use 1 - distance for similarity. threshold 0.95 means distance < 0.05
            # RPC must be created in Supabase first (see SQL setup)
            res = supabase.rpc("match_semantic_cache", {
                "query_embedding": embedding,
                "match_threshold": self.threshold,
                "match_count": 1
            }).execute()

            if res.data and len(res.data) > 0:
                match = res.data[0]
                print(f"SEMANTIC CACHE HIT! (Similarity: {match.get('similarity', 0):.4f})")
                return match.get("original_response")

            return None
        except Exception as e:
            print(f"Cache Lookup Error: {e}")
            return None

    async def save(self, prompt: str, response: str, provider: str = "cache"):
        """
        Stores a new prompt-response pair in the semantic cache.
        """
        try:
            embedding = engine.get_embedding(prompt)
            if not embedding:
                return

            supabase.table("semantic_cache").insert({
                "prompt": prompt,
                "embedding": embedding,
                "original_response": response,
                "provider": provider
            }).execute()
            print("Saved to Semantic Cache.")
        except Exception as e:
            print(f"Cache Save Error: {e}")

# Singleton
cache_manager = SemanticCacheManager(threshold=0.85)
