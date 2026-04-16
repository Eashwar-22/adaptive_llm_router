import os
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

# Configuration
# Path to the model directory
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "embedding")
# ensure directory exists
os.makedirs(MODEL_DIR, exist_ok=True)

class EmbeddingEngine:
    """
    Local Embedding Engine for Semantic Caching.
    Uses all-MiniLM-L6-v2 (ONNX) for sub-10ms inference.
    """
    def __init__(self):
        self.model_name = "sentence-transformers/all-MiniLM-L6-v2"
        self._tokenizer = None
        self._session = None
        
        # We load lazily to avoid overhead if cache is disabled
        self.initialized = False

    def _initialize(self):
        if self.initialized:
            return
            
        print(f"Initializing Embedding Engine ({self.model_name})...")
        
        # Check if ONNX model exists
        onnx_path = os.path.join(MODEL_DIR, "model.onnx")
        
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            if os.path.exists(onnx_path):
                self._session = ort.InferenceSession(onnx_path, providers=['CoreMLExecutionProvider', 'CPUExecutionProvider'])
                self.initialized = True
                print("Embedding Engine Ready (ONNX).")
            else:
                print(f"ONNX model not found at {onnx_path}. Semantic caching will be unavailable until model is provided.")
                # We don't set initialized to True yet
        except Exception as e:
            print(f"Failed to initialize Embedding Engine: {e}")

    def get_embedding(self, text: str) -> list:
        """
        Generates a 384-dimensional embedding for the given text.
        """
        if not self.initialized:
            self._initialize()
            
        if not self.initialized:
            return []

        # Tokenize
        inputs = self._tokenizer(text, padding=True, truncation=True, return_tensors="np")
        
        # Prepare inputs for ONNX session
        onnx_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64),
            "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"])).astype(np.int64)
        }
        
        outputs = self._session.run(None, onnx_inputs)
        
        # Mean Pooling
        token_embeddings = outputs[0]
        attention_mask = inputs["attention_mask"]
        input_mask_expanded = np.expand_dims(attention_mask, -1).astype(float)
        sum_embeddings = np.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = np.clip(input_mask_expanded.sum(1), a_min=1e-9, a_max=None)
        
        embedding = (sum_embeddings / sum_mask)[0]
        
        # L2 Normalization
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
            
        return embedding.tolist()

# Singleton instance
engine = EmbeddingEngine()
