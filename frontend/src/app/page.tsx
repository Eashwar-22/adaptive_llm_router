"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis,
  Tooltip as ChartTooltip,
} from "recharts";
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Eye,
  GitCompareArrows,
  LoaderCircle,
  Play,
  RefreshCw,
  ReceiptText,
  Save,
  Scale,
  SendHorizontal,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Square,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  created_at?: string;
  routed_provider: string;
  shadow_model: string;
  requested_model?: string;
  execution_mirror: string;
  shadow_cost: number;
  actual_cost: number;
  latency_ms: number;
  ttft_ms?: number;
  prompt: string;
  response: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  quality_score?: number;
  eval_metrics?: {
    evaluation_status?: "pending" | "sampled_out" | "evaluated";
    reason?: string;
    routing_receipt?: {
      policy?: string;
      intent?: string;
      classifier_confidence?: number;
      confidence_threshold?: number;
      requested_model?: string;
      selected_provider?: string;
      selected_model?: string;
      inference_candidate_provider?: string | null;
      inference_candidate_model?: string | null;
      reason?: string;
      fallback_reason?: string | null;
      cache_hit?: boolean;
      signals?: Record<string, unknown>;
      cache?: {
        id?: number;
        similarity?: number;
        source_prompt?: string;
        source_provider?: string;
        source_request_id?: string;
        age_seconds?: number;
        version?: string;
      } | null;
      privacy?: {
        pii_redacted?: boolean;
        injection_detected?: boolean;
        redaction_types?: string[];
      };
    };
    counterfactual?: {
      provider?: string;
      model?: string;
      estimated_cost_usd?: number;
      historical_latency_ms?: number | null;
      estimated_quality?: number;
      summary?: string;
    };
    regret?: {
      detected?: boolean;
      score?: number;
      recommended_provider?: string;
    };
    openai_judge?: {
      model?: string;
      estimated_cost_usd?: number;
    };
    llm_judge?: JudgeMetadata;
    llm_evaluation?: LLMEvaluation;
    llm_evaluations?: LLMEvaluation[];
    manual_evaluation?: ManualEvaluation;
    manual_evaluations?: ManualEvaluation[];
  };
  security_metadata?: {
    pii_detected?: boolean;
    injection_detected?: boolean;
    redactions?: string[];
  };
}

interface ProviderEfficiency {
  model: string;
  avg_latency: number;
  tps: number;
  actual_cost: number;
  shadow_cost: number;
  savings: number;
  request_count: number;
  total_tokens: number;
  cost_per_1k: number;
  avg_quality: number;
}

type ProviderName = "ollama" | "groq" | "openai";
type ConsoleMode = "single" | "compare";
type RouteVerdict = "optimal" | "better_local" | "better_groq" | "better_openai" | "unsafe" | "needs_review";
type IssueTag = "accuracy" | "relevance" | "latency" | "cost" | "privacy" | "cache" | "format" | "other";

interface ManualEvaluation {
  quality_score: number;
  route_verdict: RouteVerdict;
  issue_tags: IssueTag[];
  note: string;
  reviewer: string;
  created_at: string;
}

interface EvaluationDraft {
  quality_score: number;
  route_verdict: RouteVerdict;
  issue_tags: IssueTag[];
  note: string;
}

interface JudgeMetadata {
  provider: "ollama" | "groq" | "openai";
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
}

interface LLMEvaluation {
  quality_score: number;
  alternate_quality_estimate: number;
  route_was_optimal: boolean;
  reason: string;
  counterfactual: NonNullable<NonNullable<LogEntry["eval_metrics"]>["counterfactual"]>;
  regret: NonNullable<NonNullable<LogEntry["eval_metrics"]>["regret"]>;
  judge: JudgeMetadata;
  created_at: string;
}

const VERDICT_OPTIONS: { value: RouteVerdict; label: string }[] = [
  { value: "optimal", label: "Route upheld" },
  { value: "better_local", label: "Better local" },
  { value: "better_groq", label: "Better Groq" },
  { value: "better_openai", label: "Better OpenAI" },
  { value: "unsafe", label: "Unsafe" },
  { value: "needs_review", label: "Needs review" },
];

const ISSUE_TAGS: IssueTag[] = [
  "accuracy", "relevance", "latency", "cost", "privacy", "cache", "format", "other",
];

interface RouterUsage {
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  actual_cost_usd: number;
  latency_ms: number;
  ttft_ms?: number;
}

interface RoutePreview {
  effective_provider: string;
  effective_model: string;
  estimated_max_cost_usd: number;
  max_output_tokens: number;
  cache_hit: boolean;
  sensitive_cache_bypass: boolean;
  receipt: NonNullable<NonNullable<LogEntry["eval_metrics"]>["routing_receipt"]>;
}

interface RuntimeStatus {
  providers: Record<ProviderName, {
    configured: boolean;
    available: boolean;
    circuit_open: boolean;
    failures: number;
  }>;
  models: Record<ProviderName, string>;
  runtime: {
    default_requested_model: string;
    openai_provider_enabled: boolean;
    openai_auto_route_complex: boolean;
    openai_eval_enabled: boolean;
  };
  quota: { rpm_limit: number; daily_quota: number; daily_used: number };
  openai_budget: {
    total_calls: number;
    daily_calls: number;
    spend: number;
    budget: number;
    allowed: boolean;
    reason: string;
  };
}

interface ComparisonResult {
  provider: ProviderName;
  status: "running" | "complete" | "error" | "cancelled";
  response: string;
  elapsed_ms: number;
  usage?: RouterUsage;
  error?: string;
}

interface AnalyticsData {
  stats?: {
    total_requests: number;
    total_shadow_cost: number;
    total_actual_cost: number;
    total_savings: number;
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    rpm: number;
    tps: number;
    avg_quality: number;
    cache_hit_rate: number;
    security_events: number;
    monthly_savings_projection: number;
    routing_receipt_coverage?: number;
    evaluated_requests?: number;
    manually_evaluated_requests?: number;
    evaluation_coverage?: number;
    regret_count?: number;
    regret_rate?: number;
    estimated_eval_spend?: number;
    eval_budget_usd?: number;
  };
  efficiency_matrix?: ProviderEfficiency[];
  logs?: LogEntry[];
  gateway_config?: {
    default_requested_model: string;
    models?: Record<string, string>;
    providers?: Record<string, {
      configured?: boolean;
      available?: boolean;
      circuit_open?: boolean;
      failures?: number;
    }>;
    cache?: {
      version?: string;
      ttl_seconds?: number;
      similarity_threshold?: number;
    };
  };
  error?: string;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg:        "#f3f5f8",
  card:      "#ffffff",
  border:    "#e4e8ef",
  row:       "#f8f9fb",
  t1:        "#0f2444",
  t2:        "#374151",
  t3:        "#64748b",
  teal:      "#2d7d8e",
  tealBg:    "#eef7f9",
  green:     "#059669",
  greenBg:   "#ecfdf5",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  purple:    "#6d28d9",
  purpleBg:  "#f5f3ff",
  blue:      "#1e40af",
  shadow:    "0 1px 4px rgba(15,36,68,0.07), 0 1px 2px rgba(15,36,68,0.04)",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData]           = useState<AnalyticsData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "id", direction: "desc" });
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testError, setTestError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [consoleMode, setConsoleMode] = useState<ConsoleMode>("single");
  const [selectedProvider, setSelectedProvider] = useState<"auto" | ProviderName>("auto");
  const [privacyMode, setPrivacyMode] = useState<"standard" | "prefer_local" | "local_only">("standard");
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [allowFallback, setAllowFallback] = useState(true);
  const [latencyTarget, setLatencyTarget] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [maxTokens, setMaxTokens] = useState("200");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [compareProviders, setCompareProviders] = useState<ProviderName[]>(["ollama", "groq"]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [testUsage, setTestUsage] = useState<RouterUsage | null>(null);
  const [evaluationDrafts, setEvaluationDrafts] = useState<Record<string, EvaluationDraft>>({});
  const [evaluationSavingId, setEvaluationSavingId] = useState<string | null>(null);
  const [evaluationMessages, setEvaluationMessages] = useState<Record<string, { error: boolean; text: string }>>({});
  const [policyReplays, setPolicyReplays] = useState<Record<string, RoutePreview>>({});
  const [replayLoadingId, setReplayLoadingId] = useState<string | null>(null);
  const [llmJudgeProviders, setLlmJudgeProviders] = useState<Record<string, "ollama" | "groq">>({});
  const [llmJudgingId, setLlmJudgingId] = useState<string | null>(null);
  const activeControllers = React.useRef<AbortController[]>([]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" | null = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") direction = "asc";
    else if (sortConfig.key === key && sortConfig.direction === "asc") direction = null;
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    let inFlight = false;
    const fetch_ = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        let res = await fetch("/api/gateway/api/analytics", {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          res = await fetch("/analytics_snapshot.json");
        }
        let result = await res.json();
        if (result?.error || !result?.stats) {
          const fallback = await fetch("/analytics_snapshot.json");
          if (fallback.ok) result = await fallback.json();
        }
        setData(result);
      } catch {
      } finally {
        inFlight = false;
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/gateway/api/health/providers", {
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) setRuntimeStatus(await response.json());
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const buildPayload = React.useCallback((provider: "auto" | ProviderName, compare = false) => {
    const model = provider === "auto"
      ? undefined
      : runtimeStatus?.models?.[provider] || data?.gateway_config?.models?.[provider];
    return {
      ...(model ? { model } : {}),
      messages: [{ role: "user", content: testPrompt.trim() }],
      stream: true,
      max_tokens: Math.max(1, Number(maxTokens) || 200),
      routing: {
        privacy_mode: privacyMode,
        cache_enabled: compare ? false : cacheEnabled,
        allow_fallback: compare ? false : allowFallback,
        ...(provider !== "auto" ? { preferred_provider: provider } : {}),
        ...(latencyTarget ? { latency_target_ms: Number(latencyTarget) } : {}),
        ...(maxCost ? { max_cost_usd: Number(maxCost) } : {}),
      },
    };
  }, [allowFallback, cacheEnabled, data?.gateway_config?.models, latencyTarget, maxCost, maxTokens, privacyMode, runtimeStatus?.models, testPrompt]);

  useEffect(() => {
    if (testPrompt.trim().length < 3 || isTesting) {
      setRoutePreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsPreviewing(true);
      try {
        const response = await fetch("/api/gateway/api/route/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(selectedProvider)),
          signal: controller.signal,
        });
        if (response.ok) setRoutePreview(await response.json());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRoutePreview(null);
        }
      } finally {
        setIsPreviewing(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [buildPayload, isTesting, selectedProvider, testPrompt]);

  const submitTest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = testPrompt.trim();
    if (!prompt || isTesting) return;

    setIsTesting(true);
    setTestResponse("");
    setTestError("");
    setTestUsage(null);
    activeControllers.current = [];

    try {
      if (consoleMode === "compare") {
        const providers = compareProviders.filter(provider => runtimeStatus?.providers?.[provider]?.available);
        if (!providers.length) throw new Error("Select at least one available provider");
        setComparisonResults(providers.map(provider => ({ provider, status: "running", response: "", elapsed_ms: 0 })));
        await Promise.all(providers.map(async provider => {
          const controller = new AbortController();
          activeControllers.current.push(controller);
          const started = performance.now();
          try {
            const result = await streamGateway(
              buildPayload(provider, true),
              controller.signal,
              output => setComparisonResults(current => current.map(item => item.provider === provider ? { ...item, response: output } : item)),
            );
            setComparisonResults(current => current.map(item => item.provider === provider ? {
              ...item,
              status: "complete",
              response: result.text,
              elapsed_ms: performance.now() - started,
              usage: result.usage,
            } : item));
          } catch (error) {
            const cancelled = error instanceof DOMException && error.name === "AbortError";
            setComparisonResults(current => current.map(item => item.provider === provider ? {
              ...item,
              status: cancelled ? "cancelled" : "error",
              elapsed_ms: performance.now() - started,
              error: cancelled ? "Cancelled" : error instanceof Error ? error.message : "Request failed",
            } : item));
          }
        }));
      } else {
        const controller = new AbortController();
        activeControllers.current = [controller];
        const result = await streamGateway(
          buildPayload(selectedProvider),
          controller.signal,
          setTestResponse,
        );
        setTestResponse(result.text);
        setTestUsage(result.usage || null);
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Gateway request failed");
    } finally {
      activeControllers.current = [];
      setIsTesting(false);
    }
  };

  const stopTest = () => {
    activeControllers.current.forEach(controller => controller.abort());
    activeControllers.current = [];
  };

  const toggleEvent = (log: LogEntry) => {
    if (expandedId === log.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(log.id);
    setEvaluationDrafts(current => {
      if (current[log.id]) return current;
      const saved = log.eval_metrics?.manual_evaluation;
      return {
        ...current,
        [log.id]: {
          quality_score: saved?.quality_score ?? log.quality_score ?? 8,
          route_verdict: saved?.route_verdict ?? "optimal",
          issue_tags: saved?.issue_tags ?? [],
          note: saved?.note ?? "",
        },
      };
    });
  };

  const updateEvaluationDraft = (id: string, update: Partial<EvaluationDraft>) => {
    setEvaluationDrafts(current => ({
      ...current,
      [id]: { ...current[id], ...update },
    }));
  };

  const saveEvaluation = async (log: LogEntry) => {
    const draft = evaluationDrafts[log.id];
    if (!draft || evaluationSavingId) return;
    setEvaluationSavingId(log.id);
    setEvaluationMessages(current => ({ ...current, [log.id]: { error: false, text: "" } }));
    try {
      const response = await fetch(`/api/gateway/api/events/${log.id}/evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Evaluation could not be saved");
      setData(current => current ? {
        ...current,
        logs: current.logs?.map(item => item.id === log.id ? {
          ...item,
          quality_score: result.quality_score,
          eval_metrics: {
            ...item.eval_metrics,
            manual_evaluation: result.manual_evaluation,
            manual_evaluations: result.manual_evaluations,
          },
        } : item),
      } : current);
      setEvaluationMessages(current => ({ ...current, [log.id]: { error: false, text: "Evaluation saved" } }));
    } catch (error) {
      setEvaluationMessages(current => ({
        ...current,
        [log.id]: { error: true, text: error instanceof Error ? error.message : "Evaluation could not be saved" },
      }));
    } finally {
      setEvaluationSavingId(null);
    }
  };

  const replayPolicy = async (log: LogEntry) => {
    if (replayLoadingId) return;
    setReplayLoadingId(log.id);
    setEvaluationMessages(current => ({ ...current, [log.id]: { error: false, text: "" } }));
    const privacySignal = log.eval_metrics?.routing_receipt?.signals?.privacy_mode;
    const privacy = privacySignal === "prefer_local" || privacySignal === "local_only" ? privacySignal : "standard";
    try {
      const response = await fetch("/api/gateway/api/route/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: log.prompt }],
          stream: false,
          max_tokens: Math.max(1, log.completion_tokens || 200),
          routing: { privacy_mode: privacy, cache_enabled: false, allow_fallback: true },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Policy replay failed");
      setPolicyReplays(current => ({ ...current, [log.id]: result }));
    } catch (error) {
      setEvaluationMessages(current => ({
        ...current,
        [log.id]: { error: true, text: error instanceof Error ? error.message : "Policy replay failed" },
      }));
    } finally {
      setReplayLoadingId(null);
    }
  };

  const runLlmJudge = async (log: LogEntry) => {
    if (llmJudgingId) return;
    const provider = llmJudgeProviders[log.id] || (runtimeStatus?.providers?.groq?.available ? "groq" : "ollama");
    setLlmJudgingId(log.id);
    setEvaluationMessages(current => ({ ...current, [log.id]: { error: false, text: "" } }));
    try {
      const response = await fetch(`/api/gateway/api/events/${log.id}/llm-evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "LLM evaluation failed");
      setData(current => current ? {
        ...current,
        logs: current.logs?.map(item => item.id === log.id ? {
          ...item,
          quality_score: result.quality_score,
          eval_metrics: {
            ...item.eval_metrics,
            evaluation_status: "evaluated",
            quality: result.llm_evaluation.quality_score,
            reason: result.llm_evaluation.reason,
            counterfactual: result.llm_evaluation.counterfactual,
            regret: result.llm_evaluation.regret,
            llm_judge: result.llm_evaluation.judge,
            llm_evaluation: result.llm_evaluation,
            llm_evaluations: result.llm_evaluations,
          },
        } : item),
      } : current);
      setEvaluationMessages(current => ({ ...current, [log.id]: { error: false, text: `${providerLabel(provider)} evaluation saved` } }));
    } catch (error) {
      setEvaluationMessages(current => ({
        ...current,
        [log.id]: { error: true, text: error instanceof Error ? error.message : "LLM evaluation failed" },
      }));
    } finally {
      setLlmJudgingId(null);
    }
  };

  const stats = data?.stats;
  const logs = React.useMemo(() => data?.logs || [], [data?.logs]);
  const efficiency = React.useMemo(
    () => data?.efficiency_matrix || [],
    [data?.efficiency_matrix],
  );

  const sortedLogs = React.useMemo(() => {
    if (!sortConfig.direction) return logs;
    return [...logs].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortConfig.key === "id")          { av = parseInt(a.id);                          bv = parseInt(b.id); }
      else if (sortConfig.key === "timestamp") { av = a.created_at || "";                   bv = b.created_at || ""; }
      else if (sortConfig.key === "latency"){ av = a.latency_ms;                             bv = b.latency_ms; }
      else if (sortConfig.key === "target") { av = a.shadow_cost  || 0;                      bv = b.shadow_cost  || 0; }
      else if (sortConfig.key === "saving") { av = (a.shadow_cost || 0) - (a.actual_cost || 0); bv = (b.shadow_cost || 0) - (b.actual_cost || 0); }
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ?  1 : -1;
      return 0;
    });
  }, [logs, sortConfig]);

  const routingDistribution = React.useMemo(() => {
    const counts = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.routed_provider] = (acc[log.routed_provider] || 0) + 1;
      return acc;
    }, {});
    return [
      { name: "Cloud (Groq)",   value: counts.groq || 0,   color: C.t1 },
      { name: "OpenAI",         value: counts.openai || 0, color: C.purple },
      { name: "Local (Ollama)", value: counts.ollama || 0, color: C.teal },
      { name: "Cache Hit",      value: counts.cache || 0,  color: C.t3 },
    ].filter(d => d.value > 0);
  }, [logs]);

  const qualityTimeline = React.useMemo(() =>
    [...logs].reverse().filter(l => l.quality_score != null).slice(-25)
      .map(l => ({ id: String(l.id), score: Number(l.quality_score) }))
  , [logs]);

  // Formatted strings
  const savingsStr    = stats ? `$${stats.total_savings.toFixed(4)}`              : "$0.0000";
  const burnStr       = stats ? `$${stats.total_shadow_cost.toFixed(4)}`           : "$0.0000";
  const qualStr       = stats ? `${stats.avg_quality.toFixed(1)}`                  : "0.0";
  const reqStr        = stats ? `${stats.total_requests}`                           : "0";
  const projectionStr = stats && stats.monthly_savings_projection > 0 ? `$${stats.monthly_savings_projection.toFixed(2)}` : "—";
  const p50Str        = stats ? `${stats.p50_latency_ms.toFixed(0)}`               : "0";
  const p95Str        = stats ? `${stats.p95_latency_ms.toFixed(0)}`               : "0";
  const tpsStr        = stats ? `${stats.tps.toFixed(1)}`                          : "0.0";
  const cacheStr      = stats ? `${stats.cache_hit_rate.toFixed(1)}`               : "0.0";
  const rpmStr        = stats ? `${stats.rpm}`                                      : "0";
  const secStr        = stats ? `${stats.security_events || 0}`                    : "0";
  const regretStr     = stats ? `${(stats.regret_rate || 0).toFixed(1)}%`           : "0.0%";
  const receiptStr    = stats ? `${(stats.routing_receipt_coverage || 0).toFixed(1)}%` : "0.0%";
  const evalSpendStr  = stats ? `$${(stats.estimated_eval_spend || 0).toFixed(4)}`  : "$0.0000";
  const evalBudgetStr = stats ? `$${(stats.eval_budget_usd || 1).toFixed(2)}`       : "$1.00";
  const actualSpendStr = stats ? `$${(stats.total_actual_cost || 0).toFixed(4)}`    : "$0.0000";

  const card: React.CSSProperties = { backgroundColor: C.card, borderRadius: 8, padding: 28, boxShadow: C.shadow };
  const control: React.CSSProperties = { width: "100%", height: 38, border: `1px solid ${C.border}`, borderRadius: 6, padding: "0 10px", color: C.t1, backgroundColor: C.row, outline: "none", fontSize: 12 };
  const auditColumns = "148px 52px minmax(140px, 1fr) minmax(190px, 1.35fr) 78px 76px 86px 96px 106px 68px";

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg }}>
      <main className="gateway-main" style={{ padding: "40px 48px", maxWidth: 1440, margin: "0 auto" }}>

        {/* Header */}
        <header className="gateway-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: C.t1, margin: 0, letterSpacing: "-0.5px" }}>LLM Gateway</h1>
            <p style={{ fontSize: 14, color: C.t3, margin: "4px 0 0" }}>Routing · Cost Optimization · Quality Assurance</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ height: 7, width: 7, borderRadius: "50%", backgroundColor: C.teal }} />
            <span style={{ fontSize: 12, color: C.t3, fontWeight: 500 }}>Live</span>
          </div>
        </header>

        <section style={{ ...card, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          {Object.entries(runtimeStatus?.providers || data?.gateway_config?.providers || {}).map(([provider, status]) => (
            <div key={provider} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: status.available ? C.green : status.configured ? C.red : C.t3 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, textTransform: "capitalize" }}>{provider}</span>
              <span style={{ fontSize: 11, color: C.t3 }}>{status.available ? "ready" : status.configured ? "unavailable" : "disabled"}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 11, color: C.t3 }}>
            {runtimeStatus && (
              <>
                <span>Quota <strong style={{ color: C.t1 }}>{runtimeStatus.quota.daily_used}/{runtimeStatus.quota.daily_quota}</strong></span>
                <span>OpenAI <strong style={{ color: runtimeStatus.openai_budget.allowed ? C.green : C.red }}>${runtimeStatus.openai_budget.spend.toFixed(4)}/${runtimeStatus.openai_budget.budget.toFixed(2)}</strong></span>
              </>
            )}
            <span>Actual provider spend <strong style={{ color: C.t1 }}>{actualSpendStr}</strong></span>
          </div>
        </section>

        {/* Gateway operator console */}
        <section style={{ ...card, padding: 0, marginBottom: 16, overflow: "hidden" }}>
          <div className="operator-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.t1 }}>
              <SlidersHorizontal size={16} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>Routing Lab</span>
            </div>
            <div style={{ display: "flex", padding: 3, backgroundColor: C.row, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              {(["single", "compare"] as ConsoleMode[]).map(mode => (
                <button key={mode} type="button" onClick={() => setConsoleMode(mode)} style={{ height: 30, border: 0, borderRadius: 4, padding: "0 11px", display: "flex", alignItems: "center", gap: 6, backgroundColor: consoleMode === mode ? C.card : "transparent", color: consoleMode === mode ? C.t1 : C.t3, boxShadow: consoleMode === mode ? C.shadow : "none", fontSize: 11, fontWeight: 700, textTransform: "capitalize", cursor: "pointer" }}>
                  {mode === "single" ? <Play size={12} /> : <GitCompareArrows size={12} />}{mode}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submitTest}>
            <div style={{ padding: 20 }}>
              <textarea
                aria-label="Test prompt"
                value={testPrompt}
                onChange={event => setTestPrompt(event.target.value)}
                disabled={isTesting}
                placeholder="Ask the gateway..."
                rows={3}
                style={{ width: "100%", minWidth: 0, resize: "vertical", minHeight: 78, border: `1px solid ${C.border}`, borderRadius: 6, padding: "11px 13px", color: C.t1, backgroundColor: C.row, outline: "none", fontSize: 14, lineHeight: 1.5 }}
              />

              <div className="operator-controls" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
                <ControlField label="Provider">
                  <select aria-label="Provider" value={selectedProvider} onChange={event => setSelectedProvider(event.target.value as "auto" | ProviderName)} disabled={consoleMode === "compare" || isTesting} style={control}>
                    <option value="auto">Auto policy</option>
                    {(["ollama", "groq", "openai"] as ProviderName[]).map(provider => (
                      <option key={provider} value={provider} disabled={runtimeStatus ? !runtimeStatus.providers[provider]?.configured : false}>
                        {providerLabel(provider)}{runtimeStatus && !runtimeStatus.providers[provider]?.configured ? " (disabled)" : ""}
                      </option>
                    ))}
                  </select>
                </ControlField>
                <ControlField label="Privacy">
                  <select aria-label="Privacy policy" value={privacyMode} onChange={event => setPrivacyMode(event.target.value as typeof privacyMode)} disabled={isTesting} style={control}>
                    <option value="standard">Standard</option>
                    <option value="prefer_local">Prefer local</option>
                    <option value="local_only">Local only</option>
                  </select>
                </ControlField>
                <ControlField label="Max output">
                  <input aria-label="Maximum output tokens" type="number" min={1} max={4000} value={maxTokens} onChange={event => setMaxTokens(event.target.value)} disabled={isTesting} style={control} />
                </ControlField>
                <ControlField label="Latency target">
                  <input aria-label="Latency target milliseconds" type="number" min={50} max={120000} value={latencyTarget} onChange={event => setLatencyTarget(event.target.value)} disabled={isTesting} placeholder="Any" style={control} />
                </ControlField>
                <ControlField label="Cost ceiling">
                  <input aria-label="Maximum cost USD" type="number" min={0} max={100} step="0.001" value={maxCost} onChange={event => setMaxCost(event.target.value)} disabled={isTesting} placeholder="Any" style={control} />
                </ControlField>
              </div>

              <div className="operator-actions" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                {consoleMode === "compare" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {(["ollama", "groq", "openai"] as ProviderName[]).map(provider => {
                      const available = runtimeStatus?.providers?.[provider]?.available ?? true;
                      const checked = compareProviders.includes(provider);
                      return (
                        <label key={provider} style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 9px", border: `1px solid ${checked ? C.teal : C.border}`, borderRadius: 6, color: available ? C.t1 : C.t3, backgroundColor: checked ? C.tealBg : C.card, fontSize: 11, fontWeight: 700, cursor: available && !isTesting ? "pointer" : "not-allowed", opacity: available ? 1 : 0.5 }}>
                          <input type="checkbox" checked={checked} disabled={!available || isTesting} onChange={() => setCompareProviders(current => checked ? current.filter(item => item !== provider) : [...current, provider])} />
                          {providerLabel(provider)}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <Toggle label="Cache" checked={cacheEnabled} disabled={isTesting} onChange={setCacheEnabled} />
                    <Toggle label="Fallback" checked={allowFallback} disabled={isTesting} onChange={setAllowFallback} />
                  </>
                )}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {isTesting && (
                    <button type="button" onClick={stopTest} aria-label="Stop active requests" title="Stop active requests" style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: `1px solid ${C.border}`, borderRadius: 6, color: C.red, backgroundColor: C.card, cursor: "pointer" }}>
                      <Square size={14} fill="currentColor" />
                    </button>
                  )}
                  <button type="submit" disabled={!testPrompt.trim() || isTesting || (consoleMode === "compare" && !compareProviders.length)} style={{ minWidth: consoleMode === "compare" ? 142 : 108, height: 38, border: 0, borderRadius: 6, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.t1, color: C.card, cursor: isTesting ? "wait" : "pointer", opacity: !testPrompt.trim() || isTesting ? 0.5 : 1, fontSize: 12, fontWeight: 700 }}>
                    {isTesting ? <LoaderCircle className="spin" size={14} /> : consoleMode === "compare" ? <GitCompareArrows size={14} /> : <SendHorizontal size={14} />}
                    {consoleMode === "compare" ? "Run comparison" : "Run prompt"}
                  </button>
                </div>
              </div>
            </div>

            {(routePreview || isPreviewing) && consoleMode === "single" && (
              <div className="route-preview" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", borderTop: `1px solid ${C.border}`, backgroundColor: C.row }}>
                <PreviewMetric label="Route" value={isPreviewing ? "Checking" : routePreview?.effective_provider?.toUpperCase() || "-"} icon={<Eye size={12} />} />
                <PreviewMetric label="Model" value={routePreview?.effective_model || "-"} />
                <PreviewMetric label="Max cost" value={`$${Number(routePreview?.estimated_max_cost_usd || 0).toFixed(6)}`} />
                <PreviewMetric label="Policy" value={routePreview?.receipt.reason || "Analyzing route"} />
              </div>
            )}
          </form>

          {consoleMode === "single" && (testResponse || testError) && (
            <div style={{ padding: 20, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: testError ? C.red : C.t3 }}>{testError ? "Error" : "Response"}</div>
                {testUsage && <UsageLine usage={testUsage} />}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: testError ? C.red : C.t1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{testError || testResponse}</div>
            </div>
          )}

          {consoleMode === "compare" && comparisonResults.length > 0 && (
            <div className="comparison-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${comparisonResults.length}, minmax(0, 1fr))`, borderTop: `1px solid ${C.border}` }}>
              {comparisonResults.map((result, index) => (
                <div key={result.provider} style={{ minWidth: 0, padding: 20, borderLeft: index ? `1px solid ${C.border}` : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <strong style={{ fontSize: 12, color: C.t1 }}>{providerLabel(result.provider)}</strong>
                    <Pill color={result.status === "complete" ? C.green : result.status === "error" ? C.red : C.t3} bg={result.status === "complete" ? C.greenBg : result.status === "error" ? C.redBg : C.row}>{result.status}</Pill>
                  </div>
                  {result.usage && <UsageLine usage={result.usage} />}
                  <div style={{ minHeight: 84, marginTop: 10, fontSize: 12, lineHeight: 1.55, color: result.error ? C.red : C.t2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{result.error || result.response || (result.status === "running" ? "Streaming..." : "-")}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Hero KPIs ── */}
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Savings */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.t3, marginBottom: 14 }}>Total Savings</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: stats && stats.total_savings >= 0 ? C.teal : C.red, lineHeight: 1, marginBottom: 10, letterSpacing: "-1px" }}>{savingsStr}</div>
            <div style={{ fontSize: 14, color: C.t3 }}>vs <span style={{ color: C.t2, fontWeight: 500 }}>{burnStr}</span> theoretical cloud spend</div>
          </div>

          {/* Quality */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.t3, marginBottom: 14 }}>Quality Index</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: C.t1, lineHeight: 1, letterSpacing: "-1px" }}>{qualStr}</span>
              <span style={{ fontSize: 18, color: C.t3, fontWeight: 400 }}>/10</span>
            </div>
            <div style={{ fontSize: 14, color: C.t3 }}>Reviewed response avg · <span style={{ color: C.t2, fontWeight: 500 }}>{stats?.manually_evaluated_requests || 0} human-reviewed · {reqStr} total</span></div>
          </div>

          {/* Projection */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.t3, marginBottom: 14 }}>Monthly Projection</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: C.t1, lineHeight: 1, marginBottom: 10, letterSpacing: "-1px" }}>{projectionStr}</div>
            <div style={{ fontSize: 14, color: C.t3 }}>At current <span style={{ color: C.t2, fontWeight: 500 }}>{rpmStr} RPM</span> sustained 24/7</div>
          </div>
        </div>

        {/* ── Secondary stats strip ── */}
        <div style={{ ...card, padding: "18px 28px", marginBottom: 16 }}>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {[
              { label: "p50 Latency",     value: p50Str,   unit: "ms",    alert: false },
              { label: "p95 Latency",     value: p95Str,   unit: "ms",    alert: (stats?.p95_latency_ms ?? 0) > 10000 },
              { label: "Throughput",      value: tpsStr,   unit: "tok/s", alert: false },
              { label: "Cache Hit Rate",  value: cacheStr, unit: "%",     alert: false },
              { label: "RPM",             value: rpmStr,   unit: "",      alert: false },
              { label: "Security Events", value: secStr,   unit: "",      alert: Number(secStr) > 0 },
            ].map(({ label, value, unit, alert }) => (
              <div key={label} style={{ textAlign: "center", padding: "4px 0" }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.t3, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: alert ? C.red : C.t1, lineHeight: 1 }}>
                  {value}
                  {unit && <span style={{ fontSize: 12, color: C.t3, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, marginBottom: 16 }}>

          {/* Routing distribution */}
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Routing Distribution</div>
            <div style={{ fontSize: 14, color: C.t2, marginBottom: 20 }}>Cloud · Local · Cache</div>
            {routingDistribution.length === 0
              ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.t3, fontStyle: "italic" }}>No data yet</div>
              : (
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <ResponsiveContainer width="55%" height={160}>
                    <PieChart>
                      <Pie data={routingDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3}>
                        {routingDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <ChartTooltip contentStyle={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {routingDistribution.map((e, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ height: 8, width: 8, borderRadius: "50%", backgroundColor: e.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{e.name}</div>
                          <div style={{ fontSize: 11, color: C.t3 }}>{e.value} · {stats ? ((e.value / stats.total_requests) * 100).toFixed(0) : 0}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          </div>

          {/* Quality timeline */}
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Quality Timeline</div>
            <div style={{ fontSize: 14, color: C.t2, marginBottom: 20 }}>Last 25 reviewed responses (score /10)</div>
            {qualityTimeline.length === 0
              ? <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.t3, fontStyle: "italic" }}>No reviewed responses yet</div>
              : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={qualityTimeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="id" tick={{ fontSize: 10, fill: C.t3 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: C.t3 }} tickLine={false} axisLine={false} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <ChartTooltip contentStyle={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `${Number(v).toFixed(1)}/10`} />
                    <Line type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2} dot={{ fill: C.teal, r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        {/* Routing intelligence */}
        <div style={{ ...card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.t1 }}>
              <BrainCircuit size={17} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>Routing Intelligence</span>
            </div>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Decision transparency with human and sampled automated review</div>
          </div>
          <div className="intelligence-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {[
              {
                icon: <ReceiptText size={16} />,
                label: "Receipt Coverage",
                value: receiptStr,
                detail: "Requests with an explainable routing decision",
                color: C.teal,
              },
              {
                icon: <Scale size={16} />,
                label: "Policy Regret",
                value: regretStr,
                detail: `${stats?.regret_count || 0} flagged across ${stats?.evaluated_requests || 0} sampled reviews`,
                color: (stats?.regret_rate || 0) > 20 ? C.red : C.green,
              },
              {
                icon: <ShieldCheck size={16} />,
                label: "Judge Budget",
                value: evalSpendStr,
                detail: `${(stats?.evaluation_coverage || 0).toFixed(1)}% evaluated · ${evalBudgetStr} hard ceiling`,
                color: C.purple,
              },
            ].map((metric, index) => (
              <div className="intelligence-metric" key={metric.label} style={{ padding: "20px 24px", borderLeft: index ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.t3, fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 9 }}>
                  {metric.icon}{metric.label}
                </div>
                <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 800, color: metric.color, marginBottom: 8 }}>{metric.value}</div>
                <div style={{ fontSize: 12, color: C.t3 }}>{metric.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Efficiency Matrix ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Model Efficiency Matrix</div>
          <div style={{ fontSize: 14, color: C.t2, marginBottom: 20 }}>Performance and cost breakdown by provider</div>
          <div className="dashboard-table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Model", "Requests", "Avg Latency", "TPS", "Total Tokens", "Net Savings", "Quality", "Actual Cost"].map((h, i) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : i === 7 ? "right" : "center", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.t3, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {efficiency.map((e, idx) => (
                <tr key={e.model}
                  style={{ borderBottom: idx < efficiency.length - 1 ? `1px solid ${C.border}` : "none" }}
                  onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = C.row)}
                  onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "14px 12px" }}><span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{e.model}</span></td>
                  <td style={{ padding: "14px 12px", textAlign: "center" }}><span style={{ fontSize: 14, color: C.t2 }}>{e.request_count}</span></td>
                  <td style={{ padding: "14px 12px", textAlign: "center" }}><span style={{ fontSize: 14, color: C.t2 }}>{e.avg_latency}ms</span></td>
                  <td style={{ padding: "14px 12px", textAlign: "center" }}><span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{e.tps}</span></td>
                  <td style={{ padding: "14px 12px", textAlign: "center" }}><span style={{ fontSize: 14, color: C.t2 }}>{e.total_tokens.toLocaleString()}</span></td>
                  <td style={{ padding: "14px 12px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: e.savings >= 0 ? C.green : C.red }}>
                      {e.savings >= 0 ? "+" : "-"}${Math.abs(e.savings).toFixed(6)}
                    </span>
                  </td>
                  <td style={{ padding: "14px 12px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: (e.avg_quality ?? 0) > 8 ? C.green : (e.avg_quality ?? 0) < 6 ? C.red : C.t1 }}>
                      {(e.avg_quality ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: "14px 12px", textAlign: "right" }}><span style={{ fontSize: 14, color: C.t2 }}>${e.actual_cost.toFixed(6)}</span></td>
                </tr>
              ))}
              {efficiency.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", fontSize: 14, color: C.t3, fontStyle: "italic" }}>Collecting benchmark metadata...</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* ── Routing Audit Log ── */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ height: 6, width: 6, borderRadius: "50%", backgroundColor: C.teal }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.t1 }}>Routing Audit Log</span>
          </div>
          <div style={{ fontSize: 14, color: C.t2, marginBottom: 20 }}>Live request stream</div>

          <div className="audit-scroll">
          {/* Column headers */}
          <div className="audit-grid" style={{ display: "grid", gridTemplateColumns: auditColumns, gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}>
            {[
              { label: "Timestamp",       key: "timestamp", align: "left" },
              { label: "ID",              key: "id",        align: "left" },
              { label: "Model requested", key: null,          align: "left" },
              { label: "Model used",      key: null,          align: "left" },
              { label: "Cache used",      key: null,          align: "center" },
              { label: "TTFT",            key: null,          align: "center" },
              { label: "Latency",         key: "latency",    align: "center" },
              { label: "Target",          key: "target",     align: "center" },
              { label: "Savings",         key: "saving",     align: "center" },
              { label: "Quality",         key: null,          align: "center" },
            ].map(({ label, key, align }) => (
              <div key={label}
                onClick={() => key && requestSort(key)}
                style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.t3, textAlign: align, cursor: key ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 2 } as React.CSSProperties}
              >
                {label}
                {key && sortConfig.key === key && (sortConfig.direction === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div>
            {sortedLogs.map(log => {
              const rowSaving = (log.shadow_cost || 0) - (log.actual_cost || 0);
              const isCache   = log.routed_provider === "cache";
              const isWin     = rowSaving > 0 && !isCache;
              const isLoss    = rowSaving < 0;
              const hasSec    = log.security_metadata?.pii_detected || log.security_metadata?.injection_detected;
              const receipt   = log.eval_metrics?.routing_receipt;
              const counterfactual = log.eval_metrics?.counterfactual;
              const regret    = log.eval_metrics?.regret;
              const modelUsed = isCache ? "-" : (log.execution_mirror || "-");
              const manualEvaluation = log.eval_metrics?.manual_evaluation;
              const evaluationHistory = log.eval_metrics?.manual_evaluations || [];
              const llmEvaluation = log.eval_metrics?.llm_evaluation;
              const llmEvaluationHistory = log.eval_metrics?.llm_evaluations || [];
              const evaluationDraft = evaluationDrafts[log.id];
              const evaluationMessage = evaluationMessages[log.id];
              const replay = policyReplays[log.id];
              const selectedJudgeProvider = llmJudgeProviders[log.id] || (runtimeStatus?.providers?.groq?.available ? "groq" : "ollama");

              return (
                <div key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div
                    className="audit-grid"
                    style={{ display: "grid", gridTemplateColumns: auditColumns, gap: 8, padding: "12px", cursor: "pointer", borderRadius: 8, transition: "background-color 0.1s", alignItems: "center" }}
                    onClick={() => toggleEvent(log)}
                    onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = C.row)}
                    onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div title={log.created_at || ""} style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}>{formatTimestamp(log.created_at)}</div>
                    <div style={{ fontSize: 12, color: C.t3, fontFamily: "monospace" }}>{log.id}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, overflowWrap: "anywhere" }}>{log.requested_model || "-"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-start", flexWrap: "wrap", minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isCache ? C.t3 : C.t1, overflowWrap: "anywhere" }}>{modelUsed}</span>
                      {isWin   && <Pill color={C.green}  bg={C.greenBg}>Saved</Pill>}
                      {hasSec  && <Pill color={C.red}    bg={C.redBg}>Secured</Pill>}
                      {regret?.detected && <Pill color={C.red} bg={C.redBg}>Regret</Pill>}
                    </div>

                    <div style={{ textAlign: "center" }}>
                      <Pill color={isCache ? C.purple : C.t3} bg={isCache ? C.purpleBg : C.row}>{isCache ? "Yes" : "No"}</Pill>
                    </div>

                    <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: (log.ttft_ms ?? 9999) < 500 ? C.green : C.t1 }}>
                      {log.ttft_ms ? `${log.ttft_ms.toFixed(0)}ms` : "—"}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: C.t1 }}>{log.latency_ms?.toFixed(0)}ms</div>
                    <div style={{ textAlign: "center", fontSize: 14, color: C.t2 }}>${log.shadow_cost?.toFixed(6)}</div>
                    <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: isCache ? C.purple : isWin ? C.green : isLoss ? C.red : C.t1 }}>
                      {isLoss ? "-" : "+"}${Math.abs(rowSaving).toFixed(6)}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      {log.quality_score != null
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: log.quality_score > 8 ? C.green : log.quality_score < 5 ? C.red : C.t1 }}>{Number(log.quality_score).toFixed(1)}</span>
                        : <span style={{ fontSize: 11, color: C.t3 }}>—</span>
                      }
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === log.id && (
                    <div style={{ margin: "0 8px 12px", padding: 20, borderRadius: 12, backgroundColor: C.row, border: `1px solid ${C.border}` }}>

                      {/* Meta bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 20 }}>
                          <span style={{ fontSize: 12, color: C.t2 }}>Target: <strong style={{ color: C.t1 }}>${log.shadow_cost?.toFixed(6)}</strong></span>
                          <span style={{ fontSize: 12, color: C.t2 }}>Engine: <strong style={{ color: C.t1 }}>{isCache ? "CACHE" : `${log.routed_provider.toUpperCase()} · ${modelUsed}`} (${log.actual_cost?.toFixed(6)})</strong></span>
                          <span style={{ fontSize: 12, color: C.t2 }}>Time: <strong style={{ color: C.t1 }}>{formatTimestamp(log.created_at)}</strong></span>
                        </div>
                        <div style={{ display: "flex", gap: 20 }}>
                          {[
                            { l: "Input Tokens",  v: log.prompt_tokens     || "—" },
                            { l: "Output Tokens", v: log.completion_tokens  || "—" },
                            { l: "TTFT",          v: log.ttft_ms  ? `${log.ttft_ms.toFixed(0)}ms`  : "—" },
                            { l: "Latency",       v: `${log.latency_ms?.toFixed(0)}ms` },
                          ].map(({ l, v }) => (
                            <div key={l} style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: C.t3, marginBottom: 2 }}>{l}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Security banner */}
                      {hasSec && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: C.redBg, border: `1px solid #fecaca`, marginBottom: 16 }}>
                          <Shield size={14} color={C.red} />
                          <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>
                            {log.security_metadata?.pii_detected && `PII Redacted (${log.security_metadata.redactions?.join(", ")}) `}
                            {log.security_metadata?.injection_detected && "| Injection Blocked"}
                          </span>
                        </div>
                      )}

                      {/* Explainable routing receipt */}
                      {receipt && (
                        <div style={{ marginBottom: 18, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                          <div className="receipt-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr", alignItems: "stretch" }}>
                            <div style={{ padding: "16px 16px 16px 0" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                                <ReceiptText size={13} /> Routing Receipt
                              </div>
                              <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.55 }}>{receipt.reason}</div>
                              {receipt.fallback_reason && (
                                <div style={{ display: "flex", gap: 6, alignItems: "center", color: C.red, fontSize: 12, marginTop: 8 }}>
                                  <AlertTriangle size={12} /> {receipt.fallback_reason}
                                </div>
                              )}
                              {receipt.cache && (
                                <div style={{ marginTop: 10, padding: 10, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, textTransform: "uppercase", marginBottom: 5 }}>Cache provenance</div>
                                  <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.55 }}>
                                    {(Number(receipt.cache.similarity || 0) * 100).toFixed(1)}% match from {receipt.cache.source_provider || "unknown"} · entry #{receipt.cache.id} · {receipt.cache.version}
                                  </div>
                                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3, overflowWrap: "anywhere" }}>&ldquo;{receipt.cache.source_prompt}&rdquo;</div>
                                </div>
                              )}
                            </div>
                            <div style={{ padding: 16, borderLeft: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Intent Confidence</div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                                <span style={{ fontSize: 22, fontWeight: 800, color: C.t1 }}>{((receipt.classifier_confidence || 0) * 100).toFixed(0)}%</span>
                                <span style={{ fontSize: 11, color: C.t3 }}>{receipt.intent || "unknown"}</span>
                              </div>
                              <div style={{ height: 4, backgroundColor: C.border, marginTop: 8, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min((receipt.classifier_confidence || 0) * 100, 100)}%`, backgroundColor: C.teal }} />
                              </div>
                            </div>
                            <div style={{ padding: "16px 0 16px 16px", borderLeft: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Selected Execution</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{receipt.selected_provider?.toUpperCase()}</div>
                              <div style={{ fontSize: 11, color: C.t3, marginTop: 3, overflowWrap: "anywhere" }}>{receipt.selected_model}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Prompt / Response */}
                      <div className="prompt-response-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.t3, marginBottom: 8 }}>Input</div>
                          <div style={{ fontSize: 13, color: C.t2, padding: 14, borderRadius: 8, backgroundColor: C.card, border: `1px solid ${C.border}`, fontStyle: "italic", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            &ldquo;{log.prompt}&rdquo;
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: isWin || isCache ? C.green : C.red, marginBottom: 8 }}>Response</div>
                          <div style={{ fontSize: 13, color: C.t1, padding: 14, borderRadius: 8, backgroundColor: C.card, border: `1px solid ${C.border}`, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {log.response}
                          </div>
                        </div>
                      </div>

                      {/* Human evaluation and no-cost policy replay */}
                      {evaluationDraft && (
                        <div className="event-evaluation-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)", marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ paddingRight: 22 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                              <div>
                                <div style={{ color: C.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Human Evaluation</div>
                                <div style={{ color: C.t3, fontSize: 11, marginTop: 3 }}>Review response quality and the routing decision</div>
                              </div>
                              {manualEvaluation && (
                                <div style={{ textAlign: "right", color: C.t3, fontSize: 10 }}>
                                  <div>{formatTimestamp(manualEvaluation.created_at)}</div>
                                  <div>{evaluationHistory.length} saved review{evaluationHistory.length === 1 ? "" : "s"}</div>
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                              <label htmlFor={`quality-${log.id}`} style={{ minWidth: 74, color: C.t2, fontSize: 11, fontWeight: 700 }}>Quality</label>
                              <input
                                id={`quality-${log.id}`}
                                aria-label="Quality score"
                                type="range"
                                min="0"
                                max="10"
                                step="0.5"
                                value={evaluationDraft.quality_score}
                                onChange={event => updateEvaluationDraft(log.id, { quality_score: Number(event.target.value) })}
                                style={{ flex: 1, accentColor: C.teal }}
                              />
                              <strong style={{ minWidth: 45, textAlign: "right", color: C.t1, fontSize: 16 }}>{evaluationDraft.quality_score.toFixed(1)}</strong>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                              <div style={{ color: C.t2, fontSize: 11, fontWeight: 700, marginBottom: 7 }}>Route verdict</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {VERDICT_OPTIONS.map(option => {
                                  const selected = evaluationDraft.route_verdict === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => updateEvaluationDraft(log.id, { route_verdict: option.value })}
                                      style={{ padding: "6px 9px", borderRadius: 6, border: `1px solid ${selected ? C.teal : C.border}`, backgroundColor: selected ? C.greenBg : C.card, color: selected ? C.teal : C.t2, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                              <div style={{ color: C.t2, fontSize: 11, fontWeight: 700, marginBottom: 7 }}>Issues</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 12px" }}>
                                {ISSUE_TAGS.map(tag => (
                                  <label key={tag} style={{ display: "flex", alignItems: "center", gap: 5, color: C.t2, fontSize: 10, textTransform: "capitalize", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={evaluationDraft.issue_tags.includes(tag)}
                                      onChange={() => updateEvaluationDraft(log.id, {
                                        issue_tags: evaluationDraft.issue_tags.includes(tag)
                                          ? evaluationDraft.issue_tags.filter(item => item !== tag)
                                          : [...evaluationDraft.issue_tags, tag],
                                      })}
                                    />
                                    {tag}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <label style={{ display: "block", marginBottom: 12 }}>
                              <span style={{ display: "block", color: C.t2, fontSize: 11, fontWeight: 700, marginBottom: 7 }}>Reviewer note</span>
                              <textarea
                                value={evaluationDraft.note}
                                maxLength={1000}
                                rows={3}
                                placeholder="What worked, failed, or should change?"
                                onChange={event => updateEvaluationDraft(log.id, { note: event.target.value })}
                                style={{ width: "100%", resize: "vertical", boxSizing: "border-box", padding: 10, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.t1, font: "inherit", fontSize: 11, lineHeight: 1.5 }}
                              />
                            </label>

                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => saveEvaluation(log)}
                                disabled={evaluationSavingId === log.id}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px", border: 0, borderRadius: 6, backgroundColor: C.teal, color: "white", fontSize: 11, fontWeight: 700, cursor: evaluationSavingId === log.id ? "wait" : "pointer", opacity: evaluationSavingId === log.id ? 0.7 : 1 }}
                              >
                                {evaluationSavingId === log.id ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />}
                                Save evaluation
                              </button>
                              {evaluationMessage?.text && (
                                <span style={{ color: evaluationMessage.error ? C.red : C.green, fontSize: 11 }}>{evaluationMessage.text}</span>
                              )}
                            </div>
                          </div>

                          <div style={{ paddingLeft: 22, borderLeft: `1px solid ${C.border}` }}>
                            <div style={{ color: C.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>LLM Judge</div>
                            <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>Evaluate answer quality and routing with a local or Groq model.</div>
                            <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
                              {(["ollama", "groq"] as const).map(provider => {
                                const selected = selectedJudgeProvider === provider;
                                const available = runtimeStatus?.providers?.[provider]?.available ?? provider === "ollama";
                                return (
                                  <button
                                    key={provider}
                                    type="button"
                                    disabled={!available || llmJudgingId === log.id}
                                    onClick={() => setLlmJudgeProviders(current => ({ ...current, [log.id]: provider }))}
                                    title={available ? `${providerLabel(provider)} judge` : `${providerLabel(provider)} unavailable`}
                                    style={{ flex: 1, height: 30, borderRadius: 6, border: `1px solid ${selected ? C.teal : C.border}`, backgroundColor: selected ? C.greenBg : C.card, color: available ? (selected ? C.teal : C.t2) : C.t3, fontSize: 10, fontWeight: 700, cursor: available ? "pointer" : "not-allowed", opacity: available ? 1 : 0.55 }}
                                  >
                                    {providerLabel(provider)}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => runLlmJudge(log)}
                              disabled={llmJudgingId === log.id || !(runtimeStatus?.providers?.[selectedJudgeProvider]?.available ?? selectedJudgeProvider === "ollama")}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", height: 32, padding: "0 11px", borderRadius: 6, border: 0, backgroundColor: C.teal, color: "white", fontSize: 11, fontWeight: 700, cursor: llmJudgingId === log.id ? "wait" : "pointer", opacity: llmJudgingId === log.id ? 0.7 : 1 }}
                            >
                              {llmJudgingId === log.id ? <LoaderCircle className="spin" size={13} /> : <BrainCircuit size={13} />}
                              {llmJudgingId === log.id ? "Evaluating..." : "Run LLM judge"}
                            </button>

                            {llmEvaluation && (
                              <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                                  <strong style={{ color: C.t1, fontSize: 20 }}>{llmEvaluation.quality_score.toFixed(1)}<span style={{ color: C.t3, fontSize: 10, fontWeight: 500 }}>/10</span></strong>
                                  <Pill color={llmEvaluation.regret.detected ? C.red : C.green} bg={llmEvaluation.regret.detected ? C.redBg : C.greenBg}>
                                    {llmEvaluation.regret.detected ? "Route regret" : "Route upheld"}
                                  </Pill>
                                </div>
                                <div style={{ color: C.t2, fontSize: 11, lineHeight: 1.5 }}>{llmEvaluation.reason}</div>
                                <div style={{ color: C.t3, fontSize: 9, lineHeight: 1.5, marginTop: 7, overflowWrap: "anywhere" }}>
                                  {llmEvaluation.judge.model} · {llmEvaluation.judge.input_tokens + llmEvaluation.judge.output_tokens} tokens · ${llmEvaluation.judge.estimated_cost_usd.toFixed(6)} · {llmEvaluationHistory.length} run{llmEvaluationHistory.length === 1 ? "" : "s"}
                                </div>
                              </div>
                            )}

                            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ color: C.purple, fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Policy Replay</div>
                            <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.5, marginBottom: 14 }}>Re-run today&apos;s routing policy with cache bypassed. No model is called and no event is created.</div>
                            <button
                              type="button"
                              onClick={() => replayPolicy(log)}
                              disabled={replayLoadingId === log.id}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.t1, fontSize: 11, fontWeight: 700, cursor: replayLoadingId === log.id ? "wait" : "pointer" }}
                            >
                              <RefreshCw className={replayLoadingId === log.id ? "spin" : ""} size={13} />
                              Replay current policy
                            </button>

                            {replay && (
                              <div style={{ marginTop: 15, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                                <ReplayLine label="Original" value={`${(receipt?.selected_provider || log.routed_provider).toUpperCase()} · ${receipt?.selected_model || modelUsed}`} />
                                <ReplayLine label="Current" value={`${replay.effective_provider.toUpperCase()} · ${replay.effective_model}`} />
                                <ReplayLine label="Max cost" value={`$${replay.estimated_max_cost_usd.toFixed(6)}`} />
                                <ReplayLine label="Reason" value={replay.receipt.reason || "Policy decision preview"} />
                                <div style={{ marginTop: 9 }}>
                                  <Pill color={replay.effective_provider === (receipt?.selected_provider || log.routed_provider) ? C.green : C.purple} bg={replay.effective_provider === (receipt?.selected_provider || log.routed_provider) ? C.greenBg : C.purpleBg}>
                                    {replay.effective_provider === (receipt?.selected_provider || log.routed_provider) ? "Policy unchanged" : "Route changed"}
                                  </Pill>
                                </div>
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Counterfactual and regret */}
                      {counterfactual && regret && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.purple, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                              <Scale size={13} /> Counterfactual Replay
                            </div>
                            <Pill color={regret.detected ? C.red : C.green} bg={regret.detected ? C.redBg : C.greenBg}>
                              {regret.detected ? `Regret ${(Number(regret.score || 0) * 100).toFixed(0)}%` : "Route upheld"}
                            </Pill>
                          </div>
                          <div className="counterfactual-grid" style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 18 }}>
                            <div style={{ borderRight: `1px solid ${C.border}`, paddingRight: 18 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 5 }}>Alternate Route</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{counterfactual.provider?.toUpperCase()}</div>
                              <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{Number(counterfactual.estimated_quality || 0).toFixed(1)}/10 estimated quality</div>
                              <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>${Number(counterfactual.estimated_cost_usd || 0).toFixed(6)} estimated cost</div>
                              {counterfactual.historical_latency_ms != null && (
                                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{Number(counterfactual.historical_latency_ms).toFixed(0)}ms historical avg</div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{counterfactual.summary}</div>
                              <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>
                                Recommended policy: <strong style={{ color: regret.detected ? C.red : C.t1 }}>{regret.recommended_provider?.toUpperCase()}</strong>
                                {(log.eval_metrics?.llm_judge?.model || log.eval_metrics?.openai_judge?.model) && ` · judged by ${log.eval_metrics?.llm_judge?.model || log.eval_metrics?.openai_judge?.model}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Judge reasoning */}
                      {log.eval_metrics?.reason && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.purple, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                            <ShieldCheck size={11} /> Judge Analysis ({log.eval_metrics.llm_judge?.model || log.eval_metrics.openai_judge?.model || "LLM"})
                          </div>
                          <div style={{ fontSize: 13, color: C.t2, padding: 14, borderRadius: 8, backgroundColor: C.card, border: "1px solid #ede9fe", fontStyle: "italic", lineHeight: 1.6 }}>
                            {log.eval_metrics.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {sortedLogs.length === 0 && (
              <div style={{ padding: 48, textAlign: "center", fontSize: 14, color: C.t3, fontStyle: "italic" }}>
                No requests yet.
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Error toast */}
        {data?.error && (
          <div style={{ position: "fixed", bottom: 24, right: 24, padding: "14px 18px", borderRadius: 12, backgroundColor: C.card, border: "1px solid #fecaca", color: C.red, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ height: 8, width: 8, borderRadius: "50%", backgroundColor: C.red }} />
            {data.error}
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function streamGateway(
  body: Record<string, unknown>,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<{ text: string; usage?: RouterUsage }> {
  const response = await fetch("/api/gateway/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = `Gateway returned HTTP ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let usage: RouterUsage | undefined;

  const consume = (event: string) => {
    const line = event.split("\n").find(part => part.startsWith("data: "));
    if (!line) return;
    const raw = line.slice(6);
    if (raw === "[DONE]") return;
    const payload = JSON.parse(raw);
    if (payload.error) throw new Error(payload.error);
    if (payload.router_usage) usage = payload.router_usage;
    const content = payload.choices?.[0]?.delta?.content || "";
    if (content) {
      output += content;
      onText(output);
    }
  };

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    events.forEach(consume);
    if (chunk.done) break;
  }
  if (buffer.trim()) consume(buffer);
  return { text: output, usage };
}

function providerLabel(provider: ProviderName) {
  return provider === "openai" ? "OpenAI" : provider === "groq" ? "Groq" : "Ollama";
}

function ControlField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ minWidth: 0 }}>
      <span style={{ display: "block", marginBottom: 5, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.t3 }}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, color: C.t2, fontSize: 11, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function PreviewMetric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0, padding: "12px 16px", borderLeft: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, color: C.t3, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{icon}{label}</div>
      <div title={value} style={{ color: C.t1, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

function UsageLine({ usage }: { usage: RouterUsage }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", color: C.t3, fontSize: 10 }}>
      <span>{usage.model}</span>
      <span>{usage.latency_ms.toFixed(0)}ms</span>
      <span>{usage.prompt_tokens + usage.completion_tokens} tok</span>
      <strong style={{ color: C.t1 }}>${usage.actual_cost_usd.toFixed(6)}</strong>
    </div>
  );
}

function ReplayLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: C.t3, fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div title={value} style={{ color: C.t1, fontSize: 11, fontWeight: 600, lineHeight: 1.45, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function Pill({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, backgroundColor: bg, color }}>
      {children}
    </span>
  );
}

function formatTimestamp(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
