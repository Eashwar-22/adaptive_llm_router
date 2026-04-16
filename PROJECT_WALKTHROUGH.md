# Intelligent LLM Gateway: Comprehensive Project Documentation

This document provides a thorough technical breakdown of the 7 phases implemented to create the **Intelligent LLM Gateway**— a hardware-accelerated, enterprise-grade AI proxy designed to optimize costs, ensure quality, and protect data privacy.

---

## 🏗️ Core Architecture Overview
The system is built on a **FastAPI** backend that acts as an intelligent intermediary between client applications and LLM providers. It leverages **CoreML** for hardware-accelerated local inference on Apple Silicon, ensuring that the "Gateway Overhead" is kept under 20ms.

---

## Phase 1: High-Performance Proxy & Multi-Model Integration
**Goal**: Build an OpenAI-compatible proxy that supports both high-end cloud models and zero-cost local models.
- **Technical Decisions**:
    - Integrated **Groq SDK** for ultra-low latency cloud inference (<100ms TTFT).
    - Integrated **Ollama** for local model execution (Llama-3.2).
    - Implemented a **Streaming Interceptor** that captures full responses piece-by-piece for token counting and logging without blocking the user experience.
- **Outcome**: A single endpoint (`/v1/chat/completions`) that can seamlessly switch between providers.

## Phase 2: Analytics & "Shadow Billing"
**Goal**: Create a financial proof-of-value system.
- **Implementation**:
    - Built a PostgreSQL schema in **Supabase** to track every request.
    - **Shadow Billing Logic**: Calculated what a request *would have cost* if sent to GPT-4o versus what it *actually cost* (often $0.00 for local/Groq).
- **Outcome**: Real-time ROI tracking was established, providing a clear dollar-value of the gateway's routing decisions.

## Phase 3: AI-Native Analytics Dashboard
**Goal**: Provide high-fidelity observability into routing and savings.
- **Implementation**:
    - Built a **Next.js** dashboard featuring **Recharts** for cost and latency visualization.
    - **Efficiency Matrix**: A correlated view showing Avg Latency, TPS (Tokens per Second), and Net Savings per model.
    - **Noir Aesthetic**: Implemented a modern, dark-themed UI using glassmorphism and subtle micro-animations.
- **Outcome**: Full transparency into system health and financial performance.

## Phase 4: The ML Brain (ModernBERT Classifier)
**Goal**: Replace manual keyword routing with deterministic ML-based classification.
- **Implementation**:
    - Fine-tuned a **ModernBERT/mmBERT** model on a custom dataset of 1,000 prompts categorized by complexity.
    - Exported the model to **ONNX** for universal compatibility.
    - **Hardware Acceleration**: Configured `CoreMLExecutionProvider` to run the classifier on the Apple Neural Engine, achieving <10ms inference.
- **Outcome**: The gateway now understands the *intent* of a prompt and routes "Simple" tasks (e.g., formatting, grammar) to Ollama and "Complex" tasks (e.g., coding, analysis) to Groq.

## Phase 5: Semantic Caching (`pg_semantic_cache`)
**Goal**: Eliminate redundant LLM costs by caching semantically similar prompts.
- **Implementation**:
    - Used the `all-MiniLM-L6-v2` embedding model to transform prompts into vectors.
    - Leveraged **CoreML** to accelerate the embedding generation.
    - Implemented vector similarity matching (threshold > 0.95) using `pgvector` in Supabase.
- **Outcome**: Repeated or similar prompts return instantly (<200ms) with $0 marginal cost.

## Phase 6: Continuous Evaluation (LLM-as-a-Judge)
**Goal**: Ensure that routing to local models doesn't compromise quality.
- **Implementation**:
    - Developed a **Quality Evaluator** using **DeepEval** and **Llama-3.3-70b**.
    - Configured the Judge with `temperature: 0` for deterministic, evidence-based grading.
    - Integrated **TTFT (Time to First Token)** diagnostics to measure the true responsiveness of every model.
- **Outcome**: Every response is graded 1-10, with visual "Judge's Analysis" displayed in the dashboard audit log.

## Phase 7: Security Layer & PII Masking
**Goal**: Protect sensitive enterprise data and prevent prompt injection attacks.
- **Implementation**:
    - **PII Scrubbing**: Integrated **Microsoft Presidio** to detect and mask Emails, Phone Numbers, and Addresses before they hit the cloud.
    - **Regex Shielding**: Added custom high-confidence patterns for Credit Card detection.
    - **Injection Guardian**: Implemented heuristic detection for "System Override" attempts (e.g., "Ignore previous instructions").
    - **Secured Badging**: Updated the UI to display a "Secured" status and redaction reports for every request.
- **Outcome**: The system is now production-safe, ensuring that user PII never leaves the local network unmasked.

---

## 🚀 Key Performance Indicators (Final State)
- **Local Routing Latency**: <15ms (Classifier + Scaling)
- **Cache Hit Latency**: <200ms
- **Avg Cloud TTFT**: ~40ms (Groq)
- **Avg Local TTFT**: ~150ms (Ollama with VRAM Pinning)
- **Security Overhead**: <50ms

---
## 🛠️ Usage & Maintenance
1. **Backend**: Run with `./router_new/bin/python3 run_backend.py`.
2. **Dashboard**: Run with `npm run dev` in the `frontend` directory.
3. **Database**: Managed via Supabase (PostgreSQL 18).
4. **Hardware**: Optimised for Apple Silicon Neural Engine via ONNX + CoreML.
