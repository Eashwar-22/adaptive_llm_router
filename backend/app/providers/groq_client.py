import os
import time
import json
import tiktoken
from groq import AsyncGroq
from app.schemas import ChatCompletionRequest
from app.database import supabase
from app.utils.cost_calc import calculate_token_cost
import datetime
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = AsyncGroq(api_key=GROQ_API_KEY)

# Use cl100k_base for token counting
tokenizer = tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text))

async def handle_groq_request(request: ChatCompletionRequest, shadow_model: str = "gpt-4o", security_metadata: dict = None):
    start_time = time.time()
    
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    prompt_text = " ".join([m.content for m in request.messages])
    
    full_response_text = ""
    ttft_ms = None
    
    # Groq tier mirrors gpt-4o for simulation purposes
    execution_mirror = "gpt-4o"
    
    try:
        response_stream = await client.chat.completions.create(
            # Using the correct current model name
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True,
        )

        async for chunk in response_stream:
            if not chunk.choices:
                continue
            if ttft_ms is None:
                ttft_ms = (time.time() - start_time) * 1000
                
            delta = chunk.choices[0].delta.content if chunk.choices[0].delta.content else ""
            full_response_text += delta
            
            # Format as SSE
            yield f"data: {json.dumps({'choices': [{'delta': {'content': delta}, 'index': 0, 'finish_reason': chunk.choices[0].finish_reason}]})}\n\n"

    except Exception as e:
        error_msg = f"Groq API Error: {str(e)}"
        print(error_msg)
        yield f"data: {json.dumps({'error': error_msg})}\n\n"
        return

    latency_ms = (time.time() - start_time) * 1000
    
    # Post-stream simulation logging
    prompt_tokens = count_tokens(prompt_text)
    completion_tokens = count_tokens(full_response_text)
    
    # Shadow Cost: What the app asked for (e.g., GPT-4o)
    shadow_cost = calculate_token_cost(prompt_tokens, completion_tokens, shadow_model)
    
    # Actual Cost: What our router chose (Groq mirrors GPT-4O pricing tier)
    simulated_actual_cost = calculate_token_cost(prompt_tokens, completion_tokens, execution_mirror)
    
    try:
        data = {
            "prompt": prompt_text,
            "response": full_response_text,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "routed_provider": "groq",
            "shadow_model": shadow_model,
            "execution_mirror": execution_mirror, # Recording the "To" part of re-routing
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
