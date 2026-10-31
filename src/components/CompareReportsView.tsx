import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Filter,
  GitCompare,
  Layers,
  MessageSquare,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { Citation, CrossReportComparisonItem, NavigationSection, Report } from '../types/report';
import { compareMultipleReports } from '../utils/ragEngine';

interface CompareReportsViewProps {
  reports: Report[];
  onOpenCitation: (citation: Citation) => void;
  onNavigate: (section: NavigationSection) => void;
  onAskCrossReportQuestion: (question: string, selectedReportIds: string[]) => void;
  onLoadEvaluationDataset?: () => void;
}

const CAUSE_LABELS: Record<
  NonNullable<CrossReportComparisonItem['discrepancyCause']>,
  { label: string; badgeClass: string }
> = {
  methodology: {
    label: 'Cause: Methodology & Boundary Scope',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  units: {
    label: 'Cause: Measurement Units Difference',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  definitions: {
    label: 'Cause: Sub-National vs Macro Definition',
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  reporting_period: {
    label: 'Cause: Reporting Period / Coverage Window',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  none: {
    label: 'Aligned Across Sources',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

const CATEGORY_META: Record<
  CrossReportComparisonItem['category'],
  { label: string; badgeClass: string }
> = {
  contradiction: {
    label: 'Direct Statistical Conflict',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  methodology_difference: {
    label: 'Discrepancy / Methodology Variance',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  trend_evolution: {
    label: 'Multi-Year Trend Comparison',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  common_finding: {
    label: 'Common Verified Finding',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  missing_in_one: {
    label: 'Scope Coverage Gap (Missing in One)',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

export const CompareReportsView: React.FC<CompareReportsViewProps> = ({
  reports,
  onOpenCitation,
  onNavigate,
  onAskCrossReportQuestion,
  onLoadEvaluationDataset,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    reports.map((r) => r.reportId)
  );
  const [customQuery, setCustomQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | CrossReportComparisonItem['category']
  >('all');

  // Keep selectedIds synced if new reports are uploaded or loaded
  const effectiveSelectedIds = useMemo(() => {
    const valid = selectedIds.filter((id) => reports.some((r) => r.reportId === id));
    if (valid.length === 0 && reports.length > 0) {
      return reports.map((r) => r.reportId);
    }
    return valid;
  }, [reports, selectedIds]);

  const selectedReports = useMemo(
    () => reports.filter((r) => effectiveSelectedIds.includes(r.reportId)),
    [reports, effectiveSelectedIds]
  );

  const comparisonItems = useMemo(
    () => compareMultipleReports(selectedReports, submittedQuery),
    [selectedReports, submittedQuery]
  );

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return comparisonItems;
    return comparisonItems.filter((item) => item.category === categoryFilter);
  }, [comparisonItems, categoryFilter]);

  const toggleReportSelection = (reportId: string) => {
    setSelectedIds((prev) => {
      const current = prev.length > 0 ? prev : reports.map((r) => r.reportId);
      if (current.includes(reportId)) {
        if (current.length <= 1) return current;
        return current.filter((id) => id !== reportId);
      }
      return [...current, reportId];
    });
  };

  if (reports.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
            <GitCompare className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Multi-Report Research Intelligence
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed mb-6">
            Select two or more reports to compare multi-year trends, detect cross-report statistical
            contradictions (with automatic attribution to reporting period, units, definitions, or
            methodology), and identify findings present in one report but missing in another.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload PDF Reports
            </button>
            {onLoadEvaluationDataset && (
              <button
                onClick={onLoadEvaluationDataset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                Load MoSPI &amp; IESA Evaluation Reports (2 Reports)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
              <GitCompare className="w-3.5 h-3.5" />
              Multi-Report Comparison &amp; Discrepancy Attribution Engine
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Compare Reports &amp; Cross-Document Evidence
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Compare statistical tables, multi-year trajectories, and methodology boundaries across{' '}
              <span className="font-semibold text-slate-900 tabular-nums">
                {selectedReports.length}
              </span>{' '}
              selected report{selectedReports.length === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {reports.length < 2 && onLoadEvaluationDataset && (
              <button
                onClick={onLoadEvaluationDataset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                Load 2-Report Evaluation Dataset (MoSPI + IESA)
              </button>
            )}
            <button
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Add Another Report
            </button>
            <button
              onClick={() =>
                onAskCrossReportQuestion(
                  submittedQuery ||
                    "Compare India's 2026 installed solar photovoltaic capacity and renewable energy findings across all uploaded reports.",
                  effectiveSelectedIds
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Open in AI Research Assistant
            </button>
          </div>
        </div>

        {/* Report Selector Strip */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Select Reports to Compare ({selectedReports.length} of {reports.length} active)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.map((rep) => {
              const isSelected = effectiveSelectedIds.includes(rep.reportId);
              return (
                <button
                  key={rep.reportId}
                  type="button"
                  onClick={() => toggleReportSelection(rep.reportId)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-600 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 opacity-75'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-300 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{rep.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 tabular-nums">
                      <span>{rep.agency || 'Official Report'}</span>
                      <span>·</span>
                      <span>{rep.pageCount} pages</span>
                      <span>·</span>
                      <span>{rep.tables.length} tables</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cross-Report Query & Category Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQuery(customQuery.trim());
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Compare any topic, metric, year, or state across selected reports (e.g., 'solar photovoltaic capacity 2026', 'battery storage', 'Kerala literacy')..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
          >
            Compare Topic Across Reports
          </button>
          {submittedQuery && (
            <button
              type="button"
              onClick={() => {
                setCustomQuery('');
                setSubmittedQuery('');
              }}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </form>

        {/* Quick Cross-Report Prompts + Category Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filter:
            </span>
            {(
              [
                { id: 'all', label: `All Comparisons (${comparisonItems.length})` },
                { id: 'methodology_difference', label: 'Discrepancies & Methodology' },
                { id: 'trend_evolution', label: 'Multi-Year Trends' },
                { id: 'missing_in_one', label: 'Scope Coverage Gaps' },
                { id: 'common_finding', label: 'Common Findings' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Quick checks:</span>
            {[
              'Solar photovoltaic capacity 2026',
              'Renewable energy growth',
              'State literacy & broadband',
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setCustomQuery(preset);
                  setSubmittedQuery(preset);
                }}
                className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 text-[11px] font-medium transition-all cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Selected Reports</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {selectedReports.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {selectedReports.reduce((acc, r) => acc + r.pageCount, 0)} total pages ·{' '}
            {selectedReports.reduce((acc, r) => acc + r.tables.length, 0)} extracted tables
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Discrepancies &amp; Methodology</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {
              comparisonItems.filter(
                (i) => i.category === 'methodology_difference' || i.category === 'contradiction'
              ).length
            }
          </div>
          <div className="text-[11px] text-amber-700 mt-1">
            Attributed to boundary, unit, or period
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Multi-Year Trend Alignments</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {comparisonItems.filter((i) => i.category === 'trend_evolution').length}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Cross-verified longitudinal series
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Scope Coverage Gaps</span>
            <Scale className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {comparisonItems.filter((i) => i.category === 'missing_in_one').length}
          </div>
          <div className="text-[11px] text-violet-700 mt-1">
            Present in one report, absent in another
          </div>
        </div>
      </div>

      {/* Comparison Matrix Cards */}
      <div className="space-y-5">
        {filteredItems.map((item) => {
          const catMeta = CATEGORY_META[item.category];
          const causeMeta =
            CAUSE_LABELS[item.discrepancyCause || 'none'] || CAUSE_LABELS.none;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
            >
              {/* Card Top Header */}
              <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${catMeta.badgeClass}`}
                    >
                      {catMeta.label}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${causeMeta.badgeClass}`}
                    >
                      {causeMeta.label}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{item.topic}</h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onAskCrossReportQuestion(
                      `Analyze and verify the cross-report evidence for: ${item.topic}`,
                      effectiveSelectedIds
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer self-start sm:self-center shrink-0"
                >
                  <span>Deep-Dive in Assistant</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Synthesis & Discrepancy Attribution Box */}
              <div className="px-6 py-4 border-b border-slate-100 bg-white space-y-2">
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {item.analysisSummary}
                </p>
                {item.discrepancyExplanation && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 leading-relaxed flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Root-Cause Attribution: </span>
                      {item.discrepancyExplanation}
                    </div>
                  </div>
                )}
              </div>

              {/* Side-by-Side Source Evidence Columns */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-50/30">
                {item.records.map((rec, idx) => (
                  <div
                    key={`${item.id}_rec_${idx}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between space-y-3 shadow-2xs"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {rec.reportTitle}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold tabular-nums shrink-0">
                          Page {rec.pageNumber}
                        </span>
                      </div>

                      {/* Metric Callout */}
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Reported Value
                          </div>
                          <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                            {rec.reportedValue}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Unit · Period
                          </div>
                          <div className="text-xs font-semibold text-slate-700 tabular-nums mt-0.5">
                            {rec.unit} · {rec.yearOrPeriod}
                          </div>
                        </div>
                      </div>

                      {/* Verbatim Quote */}
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Verbatim Supporting Passage (Unmodified)
                        </div>
                        <blockquote className="text-xs text-slate-700 bg-amber-50/40 border-l-2 border-amber-400 pl-3 py-1.5 italic leading-relaxed">
                          &ldquo;{rec.verbatimExcerpt}&rdquo;
                        </blockquote>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        PDF Page Index: {rec.pageNumber - 1} (0-based)
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenCitation(rec.citation)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Open Source (Page {rec.pageNumber})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
