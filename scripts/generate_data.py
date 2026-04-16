import os
import csv
import json
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Categories for the simulation
# 0: SIMPLE (Ollama/Mini mirror)
# 1: COMPLEX (Groq/Premium mirror)

SYSTEM_PROMPT = """
You are a synthetic data generator for an LLM Router. 
Generate a list of diverse user prompts that an AI might receive.
Each prompt must be labeled as follows:
0: SIMPLE (Tasks that a small model like Llama 3.2 or GPT-4o-mini can handle. E.g. greetings, typos, simple facts, short basic translations, basic greetings).
1: COMPLEX (Tasks that require a large model like Llama 3.3 70B or GPT-4o. E.g. complex coding, logical reasoning, detailed analysis, creative writing, nuanced legal or financial advice).

OUTPUT FORMAT (JSON list):
[
  {"prompt": "Fix this: hello world", "label": 0},
  {"prompt": "Write a multi-threaded web scraper in Rust with error handling", "label": 1}
]

CRITICAL: Be extremely diverse. Cover medicine, law, casual chat, coding, poetry, and math. 
Produce 50 prompts per request.
"""

def generate_batch(count=50):
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": SYSTEM_PROMPT},
                      {"role": "user", "content": f"Generate {count} diverse prompts and labels."}],
            response_format={"type": "json_object"}
        )
        content = completion.choices[0].message.content
        # Groq might return {"prompts": [...]} or just the list
        data = json.loads(content)
        if isinstance(data, dict):
            # Try to find the list in the dict
            for key in data:
                if isinstance(data[key], list):
                    return data[key]
        return data
    except Exception as e:
        print(f"Error generating batch: {e}")
        return []

def main():
    target_count = 600
    all_data = []
    
    print(f"Starting synthetic data generation (Target: {target_count})...")
    
    while len(all_data) < target_count:
        batch = generate_batch(50)
        if batch:
            all_data.extend(batch)
            print(f"Generated {len(all_data)} / {target_count} prompts...")
        time.sleep(1) # Rate limit protection
    
    # Save to CSV
    output_file = "data/dataset.csv"
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["prompt", "label"])
        writer.writeheader()
        writer.writerows(all_data[:target_count])
    
    print(f"✨ Success! Saved {target_count} prompts to {output_file}")

if __name__ == "__main__":
    main()
