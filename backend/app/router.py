import os
from .classifier import classifier
from .schemas import ChatCompletionRequest

def route_request(request: ChatCompletionRequest):
    """
    Dynamic routing using the ML Intent Classifier.
    """
    full_text = " ".join([m.content for m in request.messages])
    prediction = classifier.predict(full_text)
    
    if prediction == 0:
        provider = "ollama"
        shadow_model = request.model if request.model else "gpt-5-mini"
    else:
        provider = "groq"
        shadow_model = request.model if request.model else "gpt-4o"
        
    return provider, shadow_model
