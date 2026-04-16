import time
import sys
import os

# Add parent directory to path to allow imports from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import supabase
from app.utils.evaluator import QualityEvaluator

def run_worker():
    print("🚀 Starting Continuous Evaluation Worker (Phase 6)...")
    evaluator = QualityEvaluator()
    
    while True:
        try:
            # 1. Fetch unevaluated requests
            # We look for records where quality_score has not been set yet
            res = supabase.table("requests") \
                .select("id", "prompt", "response") \
                .is_("quality_score", "null") \
                .order("id", desc=True) \
                .limit(5) \
                .execute()
            
            records = res.data
            
            if not records:
                print("💤 No pending evaluations. Waiting 10s...")
                time.sleep(10)
                continue
                
            print(f"📊 Found {len(records)} requests to evaluate.")
            
            for rec in records:
                request_id = rec["id"]
                prompt = rec["prompt"]
                response = rec["response"]
                
                if not prompt or not response:
                    # Skip invalid records but mark them so we don't try again
                    supabase.table("requests").update({"quality_score": 0.0}).eq("id", request_id).execute()
                    continue

                print(f"⚖️  Judging request {request_id}...")
                
                # 2. Run Evaluation (using DeepEval + Groq Llama-3-70b)
                eval_result = evaluator.evaluate(prompt, response)
                
                # 3. Update Record in Supabase
                score = eval_result.get("score", 0.0)
                metrics = eval_result.get("metrics", {})
                
                supabase.table("requests") \
                    .update({
                        "quality_score": score,
                        "eval_metrics": metrics
                    }) \
                    .eq("id", request_id) \
                    .execute()
                
                print(f"✅ Updated request {request_id}: Score = {score:.1f}/10")
                
            # Short pause between batches to avoid rate limits
            time.sleep(2)
            
        except Exception as e:
            print(f"❌ Worker Error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    run_worker()
