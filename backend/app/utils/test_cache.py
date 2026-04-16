import requests
import json
import time

URL = "http://localhost:8000/v1/chat/completions"

def send_prompt(prompt, label):
    print(f"\n--- {label}: '{prompt}' ---")
    start = time.time()
    
    # We use stream=True to handle the backend's SSE format
    try:
        resp = requests.post(URL, json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "stream": True 
        }, stream=True)
        
        full_response = ""
        for line in resp.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: ") and not line_text.startswith("data: [DONE]"):
                    try:
                        data = json.loads(line_text[6:])
                        content = data['choices'][0]['delta'].get('content', "")
                        full_response += content
                    except:
                        pass
                        
        end = time.time()
        print(f"Latency: {(end - start)*1000:.2f}ms")
        print(f"Response: {full_response[:100]}...")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    # 1. Prime the Cache (if not already primed)
    send_prompt("What is the capital of France?", "FIRST REQUEST")

    # 2. Wait a second for background logging to settle
    time.sleep(2)

    # 3. Test Semantic Hit
    send_prompt("Tell me what the capital city of France is.", "SECOND REQUEST (Semantic Hit)")
