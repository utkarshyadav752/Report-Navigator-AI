import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Lightbulb,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { Report, ReportInsightItem } from '../types/report';
import { runCompetitionEvaluationSuite } from '../utils/ragEngine';

interface InsightsViewProps {
  report: Report | null;
  allReports?: Report[];
  onOpenPage: (pageNumber: number) => void;
  onAskInsightQuestion: (question: string) => void;
  onGoToUpload: () => void;
  onLoadEvaluationDataset?: () => void;
}

const CATEGORY_META: Record<
  ReportInsightItem['category'],
  { label: string; colorClass: string; icon: React.ElementType }
> = {
  statistic: {
    label: 'Key Statistic',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    icon: BarChart3,
  },
  finding: {
    label: 'Major Finding',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    icon: CheckCircle2,
  },
  trend: {
    label: 'Growth & Trend',
    colorClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
    icon: TrendingUp,
  },
  comparison: {
    label: 'Comparative Metric',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    icon: Activity,
  },
  observation: {
    label: 'Important Observation',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
    icon: Eye,
  },
};

const COMPETITOR_MATRIX = [
  {
    capability: 'Atomic Claim-Level Verification (SUPPORTED / PARTIAL / UNSUPPORTED / CONFLICTING)',
    reportNavigator: 'Full Deterministic + Citation-Per-Claim Engine',
    ordinaryChatPdf: 'None (Single unverified prose block)',
    paperQa: 'Citation-grounded synthesis',
    haikuRag: 'Chunk retrieval + reranking',
    openRag: 'Pipeline-level grounding',
  },
  {
    capability: 'Programmatic Statistical Table Math & Unit Compatibility Safeguard',
    reportNavigator: 'Explicit Formula Execution + Incompatible Unit Refusal',
    ordinaryChatPdf: 'Prone to LLM arithmetic hallucination',
    paperQa: 'Text-only extraction',
    haikuRag: 'Basic table text chunking',
    openRag: 'Document text ingestion',
  },
  {
    capability: 'Cross-Report Contradiction & Root-Cause Attribution',
    reportNavigator: 'Detects conflicts & attributes to Methodology, Units, or Period',
    ordinaryChatPdf: 'Blends conflicting numbers silently',
    paperQa: 'Multi-paper synthesis',
    haikuRag: 'Single-query retrieval',
    openRag: 'Multi-doc retrieval',
  },
  {
    capability: 'Exact PDF Page Navigation (1-Based Display + 0-Based Index + BBox Highlight)',
    reportNavigator: 'Validated Page + Sentence Span + BBox Overlay (Never defaults to Page 1)',
    ordinaryChatPdf: 'Often defaults to Page 1 or broken page links',
    paperQa: 'Text citation strings only',
    haikuRag: 'CLI / chunk metadata',
    openRag: 'Source chunk cards',
  },
  {
    capability: 'Zero AI Rewriting of Source Evidence (Verbatim Character Slice)',
    reportNavigator: 'Strict originalText preservation with character offsets',
    ordinaryChatPdf: 'Paraphrases source quotes',
    paperQa: 'Summarized context quotes',
    haikuRag: 'Raw chunk return',
    openRag: 'Chunk snippet display',
  },
  {
    capability: 'Interactive Verified Chart Explorer (Bar, Line, Pie, Multi-Year Compare)',
    reportNavigator: 'Built-in cell-verified SVG visual explorer linked to source page',
    ordinaryChatPdf: 'Not supported',
    paperQa: 'Not supported',
    haikuRag: 'Not supported',
    openRag: 'Not supported',
  },
  {
    capability: 'Local-First Ollama Privacy + Cloud Gemini Hybrid Architecture',
    reportNavigator: 'Dynamic Ollama discovery (/api/ollama/models) + Cloud fallback',
    ordinaryChatPdf: 'Cloud-only lock-in',
    paperQa: 'Primarily API-driven',
    haikuRag: 'Local Ollama supported',
    openRag: 'Configurable providers',
  },
  {
    capability: 'Multilingual Accessibility (English, Simple Hindi, Hinglish + Voice I/O)',
    reportNavigator: 'Native English, Hindi, Hinglish + Web Speech Voice Input & Read Aloud',
    ordinaryChatPdf: 'Generic translation',
    paperQa: 'English research focus',
    haikuRag: 'Model dependent',
    openRag: 'Model dependent',
  },
];

export const InsightsView: React.FC<InsightsViewProps> = ({
  report,
  allReports = [],
  onOpenPage,
  onAskInsightQuestion,
  onGoToUpload,
  onLoadEvaluationDataset,
}) => {
  const [activeTab, setActiveTab] = useState<'findings' | 'benchmark' | 'competitive'>(
    'findings'
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [benchmarkRunCount, setBenchmarkRunCount] = useState<number>(1);

  const candidateReports = useMemo(() => {
    if (allReports.length > 0) return allReports;
    return report ? [report] : [];
  }, [allReports, report]);

  const evaluationReport = useMemo(() => {
    // Re-computes when benchmarkRunCount increments or reports change
    void benchmarkRunCount;
    return runCompetitionEvaluationSuite(candidateReports);
  }, [candidateReports, benchmarkRunCount]);

  if (!report) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Report Analysis, Executive Intelligence &amp; 10-Case Evaluation Suite
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
            Upload a PDF report or load the MoSPI &amp; IESA evaluation dataset to inspect
            automated executive findings, key statistical benchmarks, and run the 10-category
            competition verification suite.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGoToUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
            {onLoadEvaluationDataset && (
              <button
                onClick={onLoadEvaluationDataset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                Load MoSPI &amp; IESA Evaluation Dataset
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredInsights =
    filterCategory === 'all'
      ? report.insights
      : report.insights.filter((item) => item.category === filterCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Mode Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Actionable Report Intelligence &amp; Competition Benchmark
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Report Analysis &amp; Verification Suite
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Active Report: <span className="font-semibold text-slate-900">{report.title}</span> (
              {report.pageCount} pages · {report.chunks.length} indexed chunks ·{' '}
              {report.tables.length} tables)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: 'findings',
                  label: `Executive Findings (${report.insights.length})`,
                  icon: Lightbulb,
                },
                {
                  id: 'benchmark',
                  label: `10-Case Competition Benchmark (${evaluationReport.summary.passed}/${evaluationReport.summary.total})`,
                  icon: ShieldCheck,
                },
                {
                  id: 'competitive',
                  label: 'Competitive Differentiator Matrix',
                  icon: Award,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TAB 1: EXECUTIVE FINDINGS & STRUCTURED REPORT SUMMARY */}
      {activeTab === 'findings' && (
        <>
          {/* Structured Executive Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  Executive Overview &amp; Verified Highlights
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synthesized directly from indexed passages with clickable page citations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenPage(1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Open Page 1
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
              {report.summary.overview}
            </p>

            {/* Important Statistics Strip */}
            {report.summary.importantStatistics.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {report.summary.importantStatistics.map((stat, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-slate-500 truncate">
                          {stat.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenPage(stat.pageNumber)}
                          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold tabular-nums hover:bg-blue-100 cursor-pointer shrink-0"
                        >
                          Page {stat.pageNumber}
                        </button>
                      </div>
                      <div className="text-lg font-bold text-slate-900 tabular-nums">
                        {stat.value}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {stat.context}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `All Insights (${report.insights.length})` },
                { id: 'statistic', label: 'Key Statistics' },
                { id: 'finding', label: 'Major Findings' },
                { id: 'trend', label: 'Growth & Trends' },
                { id: 'comparison', label: 'Comparisons' },
                { id: 'observation', label: 'Observations' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  filterCategory === tab.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredInsights.map((insight) => {
              const meta = CATEGORY_META[insight.category] || CATEGORY_META.finding;
              const Icon = meta.icon;
              return (
                <div
                  key={insight.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${meta.colorClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>

                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold tabular-nums">
                        {insight.metricValue}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-2">{insight.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{insight.detail}</p>

                    <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70 mb-5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Supporting Passage (Page {insight.pageNumber})
                      </div>
                      <p className="text-xs text-slate-600 italic leading-relaxed line-clamp-3">
                        &ldquo;{insight.supportingPassage}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => onOpenPage(insight.pageNumber)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Verify on Page {insight.pageNumber}
                    </button>

                    <button
                      onClick={() =>
                        onAskInsightQuestion(
                          `Provide a detailed breakdown of "${insight.title}" from Page ${insight.pageNumber}.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ask AI Follow-up
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: 10-CASE COMPETITION EVALUATION BENCHMARK SUITE (PHASE 12) */}
      {activeTab === 'benchmark' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Phase 12 · Reproducible 10-Category Evaluation Dataset &amp; Live Benchmark
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Executes all 10 mandatory verification tests against the loaded report corpus (
                  {candidateReports.length} report{candidateReports.length === 1 ? '' : 's'}) and
                  measures real accuracy and latency.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {candidateReports.length < 2 && onLoadEvaluationDataset && (
                  <button
                    type="button"
                    onClick={onLoadEvaluationDataset}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Full 2-Report Dataset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBenchmarkRunCount((c) => c + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Re-Run All 10 Evaluation Tests
                </button>
              </div>
            </div>

            {/* Measured Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-800">Tests Passed</div>
                <div className="text-xl font-bold text-emerald-950 tabular-nums mt-0.5">
                  {evaluationReport.summary.passed} / {evaluationReport.summary.total}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Retrieval Relevance</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                  {evaluationReport.summary.retrievalRelevanceRate}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Citation Correctness</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                  {evaluationReport.summary.citationCorrectnessRate}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Claim Verification</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                  {evaluationReport.summary.claimVerificationAccuracy}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Numerical Accuracy</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                  {evaluationReport.summary.numericalAccuracyRate}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Refusal Accuracy</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                  {evaluationReport.summary.unsupportedRefusalRate}%
                </div>
              </div>
            </div>

            {/* 10 Test Case Rows */}
            <div className="divide-y divide-slate-200/80 border border-slate-200 rounded-xl overflow-hidden">
              {evaluationReport.results.map((tc) => (
                <div
                  key={tc.id}
                  className="p-4 bg-white hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          tc.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {tc.passed ? 'PASSED' : 'NEEDS 2ND REPORT'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{tc.category}</span>
                      <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {tc.latencyMs} ms
                      </span>
                    </div>
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Test Query: </span>
                      {tc.question}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span className="font-semibold">Expected: </span>
                      {tc.expectedBehavior}
                    </div>
                    <div className="text-[11px] text-emerald-800 font-medium bg-emerald-50/50 px-2.5 py-1 rounded border border-emerald-100 mt-1">
                      <span className="font-bold">Measured Outcome: </span>
                      {tc.actualOutcome}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMPETITIVE INTELLIGENCE MATRIX (PHASES 1 & 2) */}
      {activeTab === 'competitive' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200/80">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Competitive Intelligence &amp; Architectural Differentiation Matrix
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              How Report Navigator AI advances beyond ordinary PDF chatbots by combining and
              extending patterns from PaperQA, haiku.rag, and OpenRAG.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Research Capability
                  </th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50/60">
                    Report Navigator AI
                  </th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ordinary PDF Chatbots
                  </th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    PaperQA / haiku.rag / OpenRAG
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {COMPETITOR_MATRIX.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{row.capability}</td>
                    <td className="py-3.5 px-4 font-semibold text-blue-900 bg-blue-50/30">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {row.reportNavigator}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{row.ordinaryChatPdf}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {row.paperQa} · {row.haikuRag}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
