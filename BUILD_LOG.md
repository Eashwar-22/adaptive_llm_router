# Intelligent LLM Gateway

A high-performance production system designed to optimize AI API costs through intelligent routing and "Shadow Billing" analytics.

## Executive Summary
The Intelligent LLM Gateway acts as a smart proxy that intercepts application prompts, classifies their complexity using a local Small Language Model (SLM), and routes them to the most cost-effective provider (Groq or Ollama). It provides real-time observability and financial proof of value via "Shadow Billing."

## Core Technology Stack
- **Backend**: FastAPI (Python) - Sub-millisecond overhead architecture accelerated via **CoreML**.
- **Database**: Supabase (PostgreSQL 18) with `pgvector` and `pg_semantic_cache`.
- **LLM Providers**: 
  - **Groq API**: Cloud LPU for low-latency (<50ms TTFT) inference.
  - **Ollama**: Local execution for zero marginal cost (Llama-3.2 pinned in VRAM).
- **ML/Routing**: ModernBERT / mmBERT exported to ONNX for <10ms **Hardware Accelerated** inference.
- **Frontend**: Next.js 16 (App Router, Tailwind CSS, Vercel AI SDK "AI Elements").
- **Infrastructure**: Docker & Docker Compose.

## Shadow Billing Concept
"Shadow Billing" is the mechanism used to demonstrate the system's ROI. For every request routed to a free or local provider (Ollama/Groq), the system calculates what that same request would have cost if it were sent to a premium provider (e.g., GPT-4o or GPT-5-mini) based on 2026 pricing benchmarks. 
- **Actual Cost**: $0.00 (Local/Groq)
- **Shadow Cost**: Estimated premium cost.
- **Savings**: `Shadow Cost - Actual Cost`.

## Implementation Roadmap

### Phase 1: High-Performance Proxy (FastAPI, Groq & Ollama)
- Implement `/v1/chat/completions` endpoint (OpenAI compatible).
- Integrate Groq SDK and Ollama.
- Basic keyword-based routing (e.g., "typo", "fix", "grammar" -> Ollama).
- SSE streaming support with internal buffering for token counting and DB logging.

### Phase 2: Analytics & "Shadow Billing" (PostgreSQL 18)
- Setup Supabase/PostgreSQL schema (`requests` table).
- Implement shadow billing calculation logic based on 2026 pricing benchmarks.
- Log latency and savings metrics.

### Phase 3: AI-Native Analytics Dashboard (Next.js & AI Elements)
- Initialize Next.js project with Tailwind and Vercel AI SDK.
- Create FastAPI analytics endpoint.
- Build premium dashboard with real-time logs and cost-saving visualizations.

### Phase 4: The ML Brain (mmBERT Classifier via ONNX)
- Generate synthetic dataset (1,000 prompts) using Groq.
- Fine-tune ModernBERT/mmBERT for intent classification.
- Export to ONNX and integrate into FastAPI for <10ms **Hardware Accelerated** inference (CoreML).

### Phase 5: Semantic Caching (pg_semantic_cache)
- Implement embedding-based caching using `all-MiniLM-L6-v2`.
- Use `pg_semantic_cache` for similarity matching (>0.95 threshold).
- Instant cache returns with near-zero latency overhead (**CoreML accelerated**).

### [COMPLETED] Phase 6: Continuous Evaluation (LLM-as-a-Judge & DeepEval)
- Periodic background worker using DeepEval.
- Judge-based quality scoring (Groq Llama-3-70b) with deterministic **Temperature 0** grading.
- Quality analytics, **TTFT (Time to First Token)** diagnostics, and judge reasoning transparency integrated into the dashboard.

### [IN PROGRESS] Phase 7: Security Layer & PII Masking
- Implement **PII Redaction** using Microsoft Presidio (Emails, Phones, CCs).
- **Prompt Injection** detection to neutralize system instruction overrides.
- Security-aware audit logs with "Secured" badging.

---

## Execution Rules
1. **Phase-by-Phase**: Work is strictly contained within the current phase.
2. **Mandatory Approval**: No progression to the next phase without explicit "Approved" message from the user.
3. **Weekly Progress**: Summarize and seek approval after completing each phase.
