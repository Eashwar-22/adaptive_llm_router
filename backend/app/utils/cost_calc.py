# 2026 Pricing Benchmarks (Projected)
# Rates per 1,000,000 tokens in USD

PRICING = {
    # Premium Tier (Shadow Targets)
    "gpt-5": {
        "input": 2.50,
        "output": 10.00
    },
    "claude-4-opus": {
        "input": 3.00,
        "output": 15.00
    },
    "gemini-2-ultra": {
        "input": 2.00,
        "output": 8.00
    },
    # Standard Tier (Shadow Targets / Mirror for Complex Requests)
    "gpt-4o": {
        "input": 1.25,
        "output": 5.00
    },
    "claude-4-sonnet": {
        "input": 1.00,
        "output": 4.00
    },
    # Economy Tier (Mirror for Simple Requests)
    "gpt-4o-mini": {
        "input": 0.15,
        "output": 0.60
    },
    "gpt-5-mini": {
        "input": 0.10,
        "output": 0.40
    }
}

def calculate_token_cost(prompt_tokens: int, completion_tokens: int, model: str) -> float:
    """
    Calculates the cost for a given model based on the pricing table.
    """
    # Find the closest match or default to gpt-4o
    model_price = PRICING.get(model, PRICING["gpt-4o"])
        
    input_cost = (prompt_tokens / 1_000_000) * model_price["input"]
    output_cost = (completion_tokens / 1_000_000) * model_price["output"]
    
    return float(input_cost + output_cost)

def calculate_shadow_cost(prompt_tokens: int, completion_tokens: int, model: str = "gpt-4o") -> float:
    """
    Legacy wrapper for calculate_token_cost.
    """
    return calculate_token_cost(prompt_tokens, completion_tokens, model)
