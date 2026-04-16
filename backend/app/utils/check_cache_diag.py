import sys
import os
import asyncio

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))

from app.utils.embeddings import engine
from app.database import supabase
from app.utils.cache_manager import cache_manager
import numpy as np

async def diagnose():
    prompt1 = "how does a nuclear reactor work on soil"
    prompt2 = "explain a nuclear reactor working on soil"
    
    print(f"--- DIAGNOSING SEMANTIC CACHE ---")
    
    # 1. Check local embeddings
    print(f"\n1. Testing Local Embeddings...")
    emb1 = engine.get_embedding(prompt1)
    emb2 = engine.get_embedding(prompt2)
    
    if not emb1 or not emb2:
        print("❌ Error: Could not generate embeddings.")
        return
        
    # Manual similarity (Cosine similarity of normalized vectors is just dot product)
    similarity = np.dot(emb1, emb2)
    print(f"Computed Local Similarity: {similarity:.4f}")
    
    # 2. Check Database Records
    print(f"\n2. Checking 'semantic_cache' table in Supabase...")
    res = supabase.table("semantic_cache").select("*").order("id", desc=True).limit(5).execute()
    
    if res.data:
        print(f"Found {len(res.data)} recent entries in cache:")
        for r in res.data:
            print(f"- [{r['id']}] Provider: {r['provider']} | Prompt: {r['prompt'][:50]}...")
    else:
        print("❌ No entries found in 'semantic_cache'.")
        
    # 3. Test RPC Lookup
    print(f"\n3. Testing RPC Lookup via cache_manager...")
    # First, ensure prompt1 is in cache for testing
    already_in = False
    for r in res.data:
        if r['prompt'] == prompt1:
            already_in = True
            break
            
    if not already_in:
        print(f"Prompt 1 not in cache. Saving for test...")
        await cache_manager.save(prompt1, "SIMULATED RESPONSE")
        
    print(f"Looking up Prompt 2 (threshold={cache_manager.threshold})...")
    hit = await cache_manager.lookup(prompt2)
    if hit:
        print(f"✅ CACHE HIT: {hit}")
    else:
        print(f"❌ CACHE MISS.")

if __name__ == "__main__":
    asyncio.run(diagnose())
