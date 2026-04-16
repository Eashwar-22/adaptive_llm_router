import onnxruntime as ort
import os

# Check Classifier
model_dir = "backend/app/model"
onnx_path = os.path.join(model_dir, "classifier.onnx")

print(f"Checking {onnx_path}...")
try:
    session = ort.InferenceSession(onnx_path, providers=['CoreMLExecutionProvider', 'CPUExecutionProvider'])
    providers = session.get_providers()
    print(f"Classifier session providers: {providers}")
    if 'CoreMLExecutionProvider' in providers:
        print("SUCCESS: CoreML is active for the Classifier.")
    else:
        print("WARNING: CoreML NOT active for the Classifier.")
except Exception as e:
    print(f"ERROR: {e}")

# Check Embedding
embed_onnx = "backend/app/model/embedding/model.onnx"
print(f"\nChecking {embed_onnx}...")
try:
    session_embed = ort.InferenceSession(embed_onnx, providers=['CoreMLExecutionProvider', 'CPUExecutionProvider'])
    providers_embed = session_embed.get_providers()
    print(f"Embedding session providers: {providers_embed}")
    if 'CoreMLExecutionProvider' in providers_embed:
        print("SUCCESS: CoreML is active for the Embedding Engine.")
    else:
        print("WARNING: CoreML NOT active for the Embedding Engine.")
except Exception as e:
    print(f"ERROR: {e}")
