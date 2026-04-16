import os
import time
import json
import tiktoken
import ollama
from app.schemas import ChatCompletionRequest
from app.database import supabase
from app.utils.cost_calc import calculate_token_cost
import datetime
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

# SMARTER URL: Defaults to localhost (Mac Local) and falls back to host.docker.internal (Docker)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
client = ollama.AsyncClient(host=OLLAMA_BASE_URL)

# Use cl100k_base for token counting
tokenizer = tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text))

async def handle_ollama_request(request: ChatCompletionRequest, shadow_model: str = "gpt-5-mini", security_metadata: dict = None):
    start_time = time.time()
    
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    prompt_text = " ".join([m.content for m in request.messages])
    
    full_response_text = ""
    ttft_ms = None
    
    # This tier mirrors gpt-5-mini for simulation purposes
    execution_mirror = "gpt-5-mini"
    
    try:
        async for chunk in await client.chat(
            model="llama3.2:latest",
            messages=messages,
            stream=True,
            options={"keep_alive": -1}
        ):
            if ttft_ms is None:
                ttft_ms = (time.time() - start_time) * 1000
                
            delta = chunk['message']['content'] if 'message' in chunk and 'content' in chunk['message'] else ""
            full_response_text += delta
            
            # Format as SSE
            yield f"data: {json.dumps({'choices': [{'delta': {'content': delta}, 'index': 0, 'finish_reason': None}]})}\n\n"

    except Exception as e:
        error_msg = f"Ollama API Error: {str(e)}"
        print(error_msg)
        # Detailed hint for the user
        if "nodename" in error_msg or "Connection refused" in error_msg:
            error_msg += " | TIP: Ensure Ollama Mac App is running at localhost:11434"
        yield f"data: {json.dumps({'error': error_msg})}\n\n"
        return

    latency_ms = (time.time() - start_time) * 1000
    
    # Post-stream simulation logging
    prompt_tokens = count_tokens(prompt_text)
    completion_tokens = count_tokens(full_response_text)
    
    shadow_cost = calculate_token_cost(prompt_tokens, completion_tokens, model=shadow_model)
    simulated_actual_cost = calculate_token_cost(prompt_tokens, completion_tokens, model=execution_mirror)
    
    try:
        data = {
            "prompt": prompt_text,
            "response": full_response_text,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "routed_provider": "ollama",
            "shadow_model": shadow_model,
            "execution_mirror": execution_mirror,
            "latency_ms": latency_ms,
            "ttft_ms": ttft_ms,
            "actual_cost": simulated_actual_cost,
            "shadow_cost": shadow_cost,
            "security_metadata": security_metadata
        }
        supabase.table("requests").insert(data).execute()
    except Exception as e:
        print(f"Logging error: {e}")

    yield "data: [DONE]\n\n"
