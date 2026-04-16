from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import ChatCompletionRequest
from app.router import route_request
from app.providers.groq_client import handle_groq_request
from app.providers.ollama_client import handle_ollama_request
from app.database import supabase
from app.utils.cache_manager import cache_manager
from app.utils.security_manager import security_manager
import uvicorn
import json
import asyncio
from collections import defaultdict
import datetime

app = FastAPI(title="Intelligent LLM Gateway")

@app.on_event("startup")
async def startup_event():
    print("Pre-warming local ML engines (CoreML)...")
    try:
        from app.utils.cache_manager import cache_manager
        from app.classifier import classifier
        # Prime ML engines for CoreML acceleration
        await cache_manager.lookup("warmup") 
        classifier.predict("warmup")
        print("Hardware-accelerations primed and ready.")
    except Exception as e:
        print(f"Startup warm-up failed: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/analytics")
async def get_analytics():
    """
    Returns Integrated Health & Operational Analytics.
    Includes:
    - Real-time Throughput (RPM/TPS)
    - Financial Totals & Savings
    - Provider Efficiency Matrix (Benchmarking)
    - Recent Logs
    """
    try:
        # Fetch all stats with timestamps
        res = supabase.table("requests") \
            .select("shadow_model", "shadow_cost", "actual_cost", "latency_ms", "routed_provider", "prompt_tokens", "completion_tokens", "created_at", "quality_score", "security_metadata") \
            .order("created_at", desc=True) \
            .execute()
        
        stats_data = res.data
        total_requests = len(stats_data)
        
        if total_requests == 0:
            return {"stats": None, "logs": [], "efficiency_matrix": []}
            
        total_savings = sum(max(0, item.get("shadow_cost", 0.0) - item.get("actual_cost", 0.0)) for item in stats_data)
        avg_latency = sum(item.get("latency_ms", 0.0) for item in stats_data) / total_requests
        
        cache_hits = sum(1 for item in stats_data if item.get("routed_provider") == "cache")
        cache_hit_rate = (cache_hits / total_requests) * 100 if total_requests > 0 else 0.0
        
        valid_quality_scores = [item.get("quality_score") for item in stats_data if item.get("quality_score") is not None]
        avg_quality = sum(valid_quality_scores) / len(valid_quality_scores) if valid_quality_scores else 0.0
        
        pii_blocked_count = sum(1 for item in stats_data if (item.get("security_metadata") or {}).get("pii_detected"))
        injections_blocked_count = sum(1 for item in stats_data if (item.get("security_metadata") or {}).get("injection_detected"))
        
        # Operational Health (RPM & TPS - 60s Window)
        now = datetime.datetime.now(datetime.timezone.utc)
        minute_ago = now - datetime.timedelta(seconds=60)
        
        recent_requests = []
        for item in stats_data:
            try:
                dt = datetime.datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
                if dt >= minute_ago:
                    recent_requests.append(item)
                else:
                    break # Data is ordered desc
            except:
                continue
                
        rpm = len(recent_requests)
        total_completion_tokens = sum(item.get("completion_tokens", 0) for item in recent_requests)
        total_latency_seconds = sum(item.get("latency_ms", 0.0) for item in recent_requests) / 1000
        tps = total_completion_tokens / total_latency_seconds if total_latency_seconds > 0 else 0
        
        # 3. Model Intelligence & Efficiency Matrix
        model_data = defaultdict(lambda: {"total_latency": 0.0, "total_actual_cost": 0.0, "total_shadow_cost": 0.0, "count": 0, "total_tokens": 0, "quality_scores": []})
        for item in stats_data:
            m = item.get("shadow_model", "unknown")
            model_data[m]["total_latency"] += item.get("latency_ms", 0.0)
            model_data[m]["total_actual_cost"] += item.get("actual_cost", 0.0)
            model_data[m]["total_shadow_cost"] += item.get("shadow_cost", 0.0)
            model_data[m]["total_tokens"] += (item.get("completion_tokens") or 0) + (item.get("prompt_tokens") or 0)
            model_data[m]["count"] += 1
            if item.get("quality_score") is not None:
                model_data[m]["quality_scores"].append(item.get("quality_score"))
            
        efficiency_matrix = [
            {
                "model": str(name).upper(),
                "avg_latency": round(data["total_latency"] / data["count"], 0) if data["count"] > 0 else 0,
                "tps": round((data["total_tokens"] / (data["total_latency"] / 1000)), 1) if data["total_latency"] > 0 else 0,
                "actual_cost": round(data["total_actual_cost"], 6),
                "shadow_cost": round(data["total_shadow_cost"], 6),
                "savings": round(data["total_shadow_cost"] - data["total_actual_cost"], 6),
                "request_count": data["count"],
                "total_tokens": data["total_tokens"],
                "cost_per_1k": round((data["total_actual_cost"] / (data["total_tokens"] / 1000)), 4) if data["total_tokens"] > 0 else 0,
                "avg_quality": round(sum(data["quality_scores"]) / len(data["quality_scores"]), 2) if data["quality_scores"] else 0.0,
            }
            for name, data in sorted(model_data.items(), key=lambda x: x[1]["count"], reverse=True)
        ]
        
        # Recent logs (last 50)
        logs_res = supabase.table("requests") \
            .select("id", "routed_provider", "shadow_model", "execution_mirror", "shadow_cost", "actual_cost", "latency_ms", "ttft_ms", "prompt", "response", "quality_score", "eval_metrics", "security_metadata", "prompt_tokens", "completion_tokens") \
            .order("id", desc=True) \
            .limit(50) \
            .execute()
        
        return {
            "stats": {
                "total_requests": total_requests,
                "total_shadow_cost": round(total_shadow_cost, 6),
                "total_savings": round(total_savings, 6),
                "avg_latency_ms": round(avg_latency, 2),
                "rpm": rpm,
                "tps": round(tps, 2),
                "avg_quality": round(avg_quality, 2),
                "cache_hit_rate": round(cache_hit_rate, 1),
                "security_events": pii_blocked_count + injections_blocked_count
            },
            "efficiency_matrix": efficiency_matrix,
            "logs": logs_res.data
        }
    except Exception as e:
        print(f"Analytics Error: {e}")
        return {"error": str(e), "stats": None, "logs": []}

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    original_prompt = " ".join([m.content for m in request.messages])
    
    # Security Layer
    request_id = str(datetime.datetime.now().timestamp())
    masked_prompt, security_triggered, security_metadata = security_manager.process_prompt(request_id, original_prompt)
    
    # Primary message masking
    for message in request.messages:
        message.content = masked_prompt
    
    full_prompt = masked_prompt
    
    # Semantic Caching
    cache_start = asyncio.get_event_loop().time()
    cached_response = await cache_manager.lookup(full_prompt)
    if cached_response:
        cache_latency = (asyncio.get_event_loop().time() - cache_start) * 1000
        
        # Log the hit to analytics in background
        async def log_hit():
            try:
                # We still need to know the shadow model for savings calculation
                _, shadow_model = route_request(request) 
                
                # Simple token count for the cached response
                from app.providers.ollama_client import count_tokens
                from app.utils.cost_calc import calculate_token_cost
                
                pt = count_tokens(full_prompt)
                ct = count_tokens(cached_response)
                sc = calculate_token_cost(pt, ct, shadow_model)
                
                supabase.table("requests").insert({
                    "prompt": full_prompt,
                    "response": cached_response,
                    "prompt_tokens": pt,
                    "completion_tokens": ct,
                    "routed_provider": "cache",
                    "shadow_model": shadow_model,
                    "execution_mirror": "semantic-cache",
                    "latency_ms": cache_latency,
                    "ttft_ms": cache_latency,
                    "actual_cost": 0.0,
                    "shadow_cost": sc,
                    "security_metadata": security_metadata
                }).execute()
            except Exception as e:
                print(f"Cache logging error: {e}")
        
        asyncio.create_task(log_hit())
        async def cached_generator():
            # Mimic SSE streaming for the cached response
            # Split by common sense or just send chunks to feel "live"
            chunks = [cached_response[i:i+32] for i in range(0, len(cached_response), 32)]
            for chunk in chunks:
                data = {
                    "choices": [{"delta": {"content": chunk}, "index": 0, "finish_reason": None}],
                    "model": "semantic-cache"
                }
                yield f"data: {json.dumps(data)}\n\n"
                await asyncio.sleep(0.01) # Small delay for UX
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(cached_generator(), media_type="text/event-stream")

    # Provider Routing
    provider, shadow_model = route_request(request)
    
    async def response_capturing_wrapper(gen):
        full_response = []
        async for chunk in gen:
            yield chunk
            # Extract content from SSE data string
            if chunk.startswith("data: ") and not chunk.startswith("data: [DONE]"):
                try:
                    payload = json.loads(chunk[6:])
                    content = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                        full_response.append(content)
                except:
                    pass
        
        # After stream ends, save to cache in background ONLY if it's a meaningful response
        full_text = "".join(full_response)
        if len(full_text) > 20:
            asyncio.create_task(cache_manager.save(full_prompt, full_text, provider))
        else:
            print(f"Skipping cache for short/trivial response ({len(full_text)} chars).")

    if provider == "ollama":
        gen = handle_ollama_request(request, shadow_model=shadow_model, security_metadata=security_metadata)
        return StreamingResponse(response_capturing_wrapper(gen), media_type="text/event-stream")
    else:
        gen = handle_groq_request(request, shadow_model=shadow_model, security_metadata=security_metadata)
        return StreamingResponse(response_capturing_wrapper(gen), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
