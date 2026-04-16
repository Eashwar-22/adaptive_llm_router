"use client";

import React, { useEffect, useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Cell,
  Tooltip as ChartTooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  LabelList
} from "recharts";
import { 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Activity, 
  TrendingUp, 
  Cpu, 
  History, 
  Shield,
  ShieldCheck, 
  Search,
  Zap,
  LayoutDashboard,
  Server
} from "lucide-react";

interface LogEntry {
  id: string;
  routed_provider: string;
  shadow_model: string;
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
    reason?: string;
    [key: string]: any;
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

interface AnalyticsData {
  stats?: {
    total_requests: number;
    total_shadow_cost: number;
    total_savings: number;
    avg_latency_ms: number;
    rpm: number;
    tps: number;
    avg_quality: number;
    cache_hit_rate: number;
    security_events: number;
  };
  efficiency_matrix?: ProviderEfficiency[];
  logs?: LogEntry[];
  error?: string;
}

export default function Dashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'id',
    direction: 'desc'
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/analytics");
      if (!res.ok) return;
      const result = await res.json();
      setData(result);
    } catch (err) { }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 2000);
    return () => clearInterval(interval);
  }, []);

  const stats = data?.stats;
  const logs = data?.logs || [];
  
  const sortedLogs = React.useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return logs;
    return [...logs].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      if (sortConfig.key === 'id') {
        aValue = parseInt(a.id);
        bValue = parseInt(b.id);
      } else if (sortConfig.key === 'latency') {
        aValue = a.latency_ms;
        bValue = b.latency_ms;
      } else if (sortConfig.key === 'target_cloud') {
        aValue = a.shadow_cost || 0;
        bValue = b.shadow_cost || 0;
      } else if (sortConfig.key === 'saving') {
        aValue = (a.shadow_cost || 0) - (a.actual_cost || 0);
        bValue = (b.shadow_cost || 0) - (b.actual_cost || 0);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [logs, sortConfig]);

  const efficiency = data?.efficiency_matrix || [];

  const secStr = stats ? `${stats.security_events || 0}` : "0";

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0b0e18' }}>
      <main className="p-6 md:p-10 space-y-6 max-w-[1440px] mx-auto">
        
        {/* ─── Header ─── */}
        <header className="flex items-center justify-between pb-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#ffffff' }}>OBSERVABILITY</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>For AI Routing, Cost Optimization and Quality Assurance</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full pulse-soft" style={{ backgroundColor: '#10b981' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Live</span>
          </div>
        </header>

        {/* ─── Top Metric Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Model Switch Savings" value={savingsStr} color={stats && stats.total_savings >= 0 ? '#10b981' : '#f43f5e'} sub="Simulation Strategy ROI" />
          <MetricCard label="Theoretical Burn" value={burnStr} color="#ffffff" sub="Estimated Cloud Spend" />
          <MetricCard label="Throughput" value={tpsStr} unit="tok/s" color="#ffffff" sub="Net System Yield" />
          <MetricCard label="Avg Latency" value={latStr} unit="ms" color="#ffffff" sub="Gateway Turnaround" />
        </div>

        {/* ─── Secondary Metric Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard label="Total Requests" value={reqStr} icon={<Activity size={12} />} color="#ffffff" sub="All-Time Volume" />
          <MetricCard label="Operational RPM" value={rpmStr} icon={<Zap size={12} />} color={stats?.rpm === 0 ? '#8892b0' : '#ffffff'} sub="Reqs / Minute" />
          <MetricCard label="Quality Index" value={qualStr} icon={<Search size={12} />} unit="/10" color={stats?.avg_quality && stats.avg_quality > 8 ? '#10b981' : stats?.avg_quality && stats.avg_quality < 5 ? '#f43f5e' : '#ffffff'} sub="Judge Score" />
          <MetricCard label="Cache Hit Rate" value={cacheStr} icon={<Server size={12} />} unit="%" color={stats?.cache_hit_rate && stats.cache_hit_rate > 50 ? '#10b981' : '#ffffff'} sub="Semantic Yield" />
          <MetricCard label="Security Activity" value={secStr} icon={<Shield size={12} />} color="#f43f5e" sub="PII / Injections" />
        </div>

        {/* ─── Efficiency Matrix ─── */}
        <div className="rounded-xl p-6" style={{ backgroundColor: '#131728', border: '1px solid #1e2540' }}>
          <div className="mb-5">
            <h2 className="text-sm font-bold" style={{ color: '#ffffff' }}>Model Intelligence & Efficiency Matrix</h2>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Correlated Volume, Performance, and Savings</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2540' }}>
                  {["Model", "Load (Reqs)", "Latency (ms)", "Bandwidth (TPS)", "Total Vol (Tok)", "Net Savings", "Quality", "Actual Cost"].map((h, i) => (
                    <th key={h} className="pb-3 px-3 text-left" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1', borderBottom: '1px solid #1e2540', textAlign: i === 0 ? 'left' : i === 7 ? 'right' : 'center' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {efficiency.map((e) => (
                  <tr key={e.model} className="transition-colors" style={{ borderBottom: '1px solid rgba(30,37,64,0.5)' }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = '#1a1f35')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="py-3.5 px-3"><span className="text-sm font-bold uppercase" style={{ color: '#ffffff' }}>{e.model}</span></td>
                    <td className="py-3.5 px-3 text-center"><span className="text-sm" style={{ color: '#8892b0', fontVariantNumeric: 'tabular-nums' }}>{e.request_count}</span></td>
                    <td className="py-3.5 px-3 text-center"><span className="text-sm" style={{ color: '#8892b0', fontVariantNumeric: 'tabular-nums' }}>{e.avg_latency}</span></td>
                    <td className="py-3.5 px-3 text-center"><span className="text-sm font-semibold" style={{ color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{e.tps}</span></td>
                    <td className="py-3.5 px-3 text-center"><span className="text-sm" style={{ color: '#8892b0', fontVariantNumeric: 'tabular-nums' }}>{e.total_tokens.toLocaleString()}</span></td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="text-sm font-semibold" style={{ color: e.savings >= 0 ? '#10b981' : '#f43f5e', fontVariantNumeric: 'tabular-nums' }}>
                        {e.savings >= 0 ? "+" : "-"}${Math.abs(e.savings).toFixed(6)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="text-sm font-semibold" style={{ color: (e.avg_quality ?? 0) > 8 ? '#10b981' : (e.avg_quality ?? 0) < 6 ? '#f43f5e' : '#ffffff' }}>
                        {(e.avg_quality ?? 0).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right"><span className="text-sm" style={{ color: '#8892b0', fontVariantNumeric: 'tabular-nums' }}>${e.actual_cost.toFixed(6)}</span></td>
                  </tr>
                ))}
                {efficiency.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-xs italic" style={{ color: '#5a6380' }}>Collecting benchmark metadata...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Routing Audit Log ─── */}
        <div className="rounded-xl p-6" style={{ backgroundColor: '#131728', border: '1px solid #1e2540' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-2 w-2 rounded-full pulse-soft" style={{ backgroundColor: '#10b981' }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#ffffff' }}>Routing Audit Log</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Active System Stream</p>
            </div>
          </div>

          {/* Log Header */}
          <div className="grid grid-cols-[45px_1fr_85px_85px_85px_100px_65px] items-center px-4 pb-3 mb-1" style={{ borderBottom: '1px solid #1e2540' }}>
          <HeaderBtn label="ID" sortKey="id" sortConfig={sortConfig} onClick={requestSort} />
          <div className="text-center" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1' }}>Route</div>
          <div className="text-center" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1' }}>TTFT</div>
          <HeaderBtn label="Latency" sortKey="latency" sortConfig={sortConfig} onClick={requestSort} />
          <HeaderBtn label="Target" sortKey="target_cloud" sortConfig={sortConfig} onClick={requestSort} />
          <HeaderBtn label="Savings" sortKey="saving" sortConfig={sortConfig} onClick={requestSort} />
          <div className="text-center" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1' }}>Quality</div>
        </div>

          {/* Log Rows */}
          <div>
            {sortedLogs.map((log) => {
              const rowSaving = (log.shadow_cost || 0) - (log.actual_cost || 0);
              const isCache = log.routed_provider === "cache";
              const isWin = rowSaving > 0 && !isCache;
              const isLoss = rowSaving < 0;
              
              return (
                <div key={log.id} style={{ borderBottom: '1px solid rgba(30,37,64,0.4)' }}>
                  <div 
                className="grid grid-cols-[45px_1fr_85px_85px_85px_100px_65px] items-center py-3 cursor-pointer rounded-lg px-4 transition-colors"
                style={{ transition: 'background-color 0.15s' }}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = '#1a1f35')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* ID */}
                    <div className="text-xs font-mono" style={{ color: '#5a6380' }}>{log.id}</div>
                    
                    {/* Route */}
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs font-semibold uppercase" style={{ color: '#8892b0' }}>{log.shadow_model}</span>
                      <ArrowRight className="h-3 w-3" style={{ color: '#3d4670' }} />
                      <span className="text-xs font-bold uppercase" style={{ color: isCache ? '#8b5cf6' : isWin ? '#10b981' : isLoss ? '#f43f5e' : '#8892b0' }}>
                        {isCache ? "CACHE" : (log.execution_mirror || "Direct")}
                      </span>
                      {isCache && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase" style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>Cache Hit</span>}
                      {isWin && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>Optimized</span>}
                      {(log.security_metadata?.pii_detected || log.security_metadata?.injection_detected) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase" style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}>Secured</span>
                      )}
                    </div>
                    
                    {/* TTFT */}
                    <div className="text-center">
                      <span className="text-sm font-semibold" style={{ color: log.ttft_ms && log.ttft_ms < 500 ? '#10b981' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                        {log.ttft_ms ? log.ttft_ms.toFixed(0) : "---"}
                      </span>
                      <span className="text-[0.6rem] ml-0.5" style={{ color: '#94a3b8' }}>ms</span>
                    </div>

                    {/* Latency */}
                    <div className="text-center">
                      <span className="text-sm font-semibold" style={{ color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{log.latency_ms?.toFixed(0)}</span>
                      <span className="text-[0.6rem] ml-0.5" style={{ color: '#94a3b8' }}>ms</span>
                    </div>

                    {/* Target */}
                    <div className="text-center">
                      <span className="text-sm" style={{ color: '#8892b0', fontVariantNumeric: 'tabular-nums' }}>${log.shadow_cost?.toFixed(6)}</span>
                    </div>

                    {/* Savings */}
                    <div className="text-center">
                      <span className="text-sm font-semibold" style={{ color: isCache ? '#8b5cf6' : isWin ? '#10b981' : isLoss ? '#f43f5e' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                        {isLoss ? "-" : "+"}${Math.abs(rowSaving).toFixed(6)}
                      </span>
                    </div>

                    {/* Quality */}
                    <div className="text-center">
                      {log.quality_score != null ? (
                        <span className="text-sm font-bold" style={{ color: log.quality_score > 8 ? '#10b981' : log.quality_score < 5 ? '#f43f5e' : '#ffffff' }}>
                          {Number(log.quality_score).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[0.6rem] italic" style={{ color: '#5a6380' }}>Pending</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Detail */}
                  {expandedId === log.id && (
                    <div className="mx-3 mb-4 p-6 rounded-xl space-y-5" style={{ backgroundColor: '#0b0e18', border: '1px solid #1e2540' }}>
                      <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid #1e2540' }}>
                        <div className="flex gap-6 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                          <span>Target Cloud: ${log.shadow_cost?.toFixed(6)}</span>
                          <span>Execution Engine: {log.routed_provider.toUpperCase()} (${log.actual_cost?.toFixed(6)})</span>
                        </div>
                        <div className="flex gap-4">
                           <div className="flex flex-col items-end">
                              <span className="text-[0.6rem] uppercase font-bold" style={{ color: '#94a3b8' }}>Input Tokens</span>
                              <span className="text-sm font-bold text-white">{log.prompt_tokens || "---"}</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-[0.6rem] uppercase font-bold" style={{ color: '#94a3b8' }}>Output Tokens</span>
                              <span className="text-sm font-bold text-white">{log.completion_tokens || "---"}</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-[0.6rem] uppercase font-bold" style={{ color: '#94a3b8' }}>TTFT (Inference)</span>
                              <span className="text-sm font-bold text-white">{log.ttft_ms?.toFixed(0) || "---"}ms</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-[0.6rem] uppercase font-bold" style={{ color: '#94a3b8' }}>Total Latency</span>
                              <span className="text-sm font-bold text-white">{log.latency_ms?.toFixed(0)}ms</span>
                           </div>
                        </div>
                      </div>
                      
                      {/* Security Report */}
                      {(log.security_metadata?.pii_detected || log.security_metadata?.injection_detected) && (
                        <div className="p-3 rounded-lg flex items-center gap-3" style={{ backgroundColor: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
                          <Shield size={16} style={{ color: '#f43f5e' }} />
                          <div className="text-xs">
                            <span className="font-bold text-[#f43f5e] uppercase mr-2">Security Guard Active: </span>
                            <span style={{ color: '#cbd5e1' }}>
                              {log.security_metadata?.pii_detected && `PII Redacted (${log.security_metadata.redactions?.join(', ') || 'Detected'}) `}
                              {log.security_metadata?.injection_detected && "| Prompt Injection Neutralized"}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#5a6380' }}>
                              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#3b82f6' }}/> Input Context
                            </div>
                            <div className="text-sm p-5 rounded-lg leading-relaxed italic whitespace-pre-wrap break-words" style={{ color: '#8892b0', backgroundColor: '#131728', border: '1px solid #1e2540' }}>
                              &ldquo;{log.prompt}&rdquo;
                            </div>
                         </div>
                         <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: isWin || isCache ? '#10b981' : '#f43f5e' }}>
                              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isWin || isCache ? '#10b981' : '#f43f5e' }}/> Gateway Response
                            </div>
                            <div className="text-sm p-5 rounded-lg leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#e2e8f0', backgroundColor: '#131728', border: '1px solid #1e2540' }}>
                              {log.response}
                            </div>
                         </div>
                      </div>

                      {/* Judge Reasoning */}
                      {log.eval_metrics?.reason && (
                        <div className="pt-5" style={{ borderTop: '1px solid #1e2540' }}>
                          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-3" style={{ color: '#8b5cf6' }}>
                            <ShieldCheck className="h-3.5 w-3.5" /> Judge&apos;s Quality Analysis (Llama-3-70b)
                          </div>
                          <div className="text-sm p-5 rounded-lg leading-relaxed italic" style={{ color: '#8892b0', backgroundColor: '#131728', border: '1px solid rgba(139,92,246,0.25)' }}>
                            {log.eval_metrics.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Toast */}
        {data?.error && (
          <div className="fixed bottom-6 right-6 p-5 rounded-xl text-xs font-semibold flex items-center gap-3 shadow-2xl" style={{ backgroundColor: '#131728', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}>
            <div className="h-2.5 w-2.5 rounded-full pulse-soft" style={{ backgroundColor: '#f43f5e' }} />
            SYSTEM CRITICAL: {data.error}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Metric Card Component ─── */
function MetricCard({ label, value, color, sub, unit, icon }: { label: string; value: string; color: string; sub?: string; unit?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 transition-colors" style={{ backgroundColor: '#131728', border: '1px solid #1e2540' }}
      onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = '#2d3460'; ev.currentTarget.style.backgroundColor = '#1a1f35'; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = '#1e2540'; ev.currentTarget.style.backgroundColor = '#131728'; }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: '#cbd5e1' }}>{label}</div>
        {icon && <div style={{ color: '#5a6380' }}>{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit && <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{unit}</span>}
      </div>
      {sub && <div className="text-[0.6rem] mt-1.5 font-medium" style={{ color: '#94a3b8' }}>{sub}</div>}
    </div>
  );
}

/* ─── Header Button Component ─── */
function HeaderBtn({ label, sortKey, sortConfig, onClick }: { label: string; sortKey: string; sortConfig: { key: string; direction: 'asc' | 'desc' | null }; onClick: (k: string) => void }) {
  return (
    <button
      onClick={() => onClick(sortKey)}
      className="flex items-center justify-center gap-1 transition-colors"
      style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1' }}
      onMouseEnter={(ev) => (ev.currentTarget.style.color = '#ffffff')}
      onMouseLeave={(ev) => (ev.currentTarget.style.color = '#cbd5e1')}
    >
      {label} {sortConfig.key === sortKey && (sortConfig.direction === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>)}
    </button>
  );
}
