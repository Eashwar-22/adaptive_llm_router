import os
import sys
import uvicorn

# 1. Add the 'backend' directory to the Python path
# This allows 'from app.main import ...' to work regardless of where you run it from.
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
sys.path.append(backend_dir)

if __name__ == "__main__":
    print("Starting LLM Router Backend...")
    print(f"Source directory: {backend_dir}")
    
    # Run the FastAPI app
    # 'app.main:app' looks inside the 'backend' folder we just added to path
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
