import os
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

# Configuration
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
ONNX_PATH = os.path.join(MODEL_DIR, "classifier.onnx")

class IntentClassifier:
    def __init__(self):
        print(f"Initializing Intent Classifier from {ONNX_PATH}...")
        
        # Load the tokenizer from the same directory
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        
        # Using CoreML for Apple Silicon acceleration, failing back to CPU
        self.session = ort.InferenceSession(ONNX_PATH, providers=['CoreMLExecutionProvider', 'CPUExecutionProvider'])
        
        self.input_names = [i.name for i in self.session.get_inputs()]
        self.output_names = [o.name for o in self.session.get_outputs()]

    def predict(self, text: str) -> int:
        """Categorizes text as SIMPLE (0) or COMPLEX (1)."""
        inputs = self.tokenizer(
            text, 
            padding="max_length", 
            truncation=True, 
            max_length=128, 
            return_tensors="np"
        )
        
        onnx_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64)
        }
        
        logits = self.session.run(self.output_names, onnx_inputs)[0]
        prediction = int(np.argmax(logits, axis=1)[0])
        
        label = "COMPLEX" if prediction == 1 else "SIMPLE"
        print(f"Inference: {label} ({text[:50]}...)")
        
        return prediction

# Singleton instance
classifier = IntentClassifier()
