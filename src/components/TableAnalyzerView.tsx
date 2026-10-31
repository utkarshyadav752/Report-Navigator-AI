import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  LineChart,
  MessageSquare,
  PieChart,
  Search,
  Sparkles,
  Table2,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { ExtractedTable, ProgrammaticCalculationResult, Report } from '../types/report';
import { compareTableMetrics, computeProgrammaticTableAnalysis } from '../utils/ragEngine';

interface TableAnalyzerViewProps {
  report: Report | null;
  allReports?: Report[];
  onOpenPage: (pageNumber: number) => void;
  onAskTableQuestion: (question: string) => void;
  onGoToUpload: () => void;
  onLoadEvaluationDataset?: () => void;
}

type ChartMode = 'bar' | 'line' | 'pie' | 'comparison';

export const TableAnalyzerView: React.FC<TableAnalyzerViewProps> = ({
  report,
  allReports = [],
  onOpenPage,
  onAskTableQuestion,
  onGoToUpload,
  onLoadEvaluationDataset,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [tableSearch, setTableSearch] = useState('');
  const [rowIdx, setRowIdx] = useState<number>(0);
  const [colA, setColA] = useState<number>(1);
  const [colB, setColB] = useState<number>(2);
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [chartColIdx, setChartColIdx] = useState<number>(-1);
  const [calcQuery, setCalcQuery] = useState<string>('');
  const [activeCalcResult, setActiveCalcResult] = useState<ProgrammaticCalculationResult | null>(
    null
  );

  const rawTableRef = useRef<HTMLDivElement>(null);

  const tables: ExtractedTable[] = report ? report.tables : [];
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables;
    const q = tableSearch.toLowerCase();
    return tables.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.headers.some((h) => h.toLowerCase().includes(q)) ||
        t.rows.some((r) => r.some((c) => c.toLowerCase().includes(q)))
    );
  }, [tables, tableSearch]);

  const activeTable = useMemo(() => {
    if (filteredTables.length === 0) return tables[0] || null;
    return filteredTables.find((t) => t.tableId === selectedTableId) || filteredTables[0];
  }, [filteredTables, tables, selectedTableId]);

  const hasUnitCol = useMemo(() => {
    if (!activeTable) return false;
    return /^unit$/i.test((activeTable.headers[1] || '').trim());
  }, [activeTable]);

  const firstDataCol = hasUnitCol ? 2 : 1;
  const lastDataCol = activeTable
    ? Math.max(firstDataCol, activeTable.headers.length - 1)
    : 1;

  const effectiveChartCol = useMemo(() => {
    if (!activeTable) return 1;
    if (chartColIdx >= firstDataCol && chartColIdx < activeTable.headers.length) {
      return chartColIdx;
    }
    return lastDataCol;
  }, [activeTable, chartColIdx, firstDataCol, lastDataCol]);

  const safeRowIdx = activeTable ? Math.min(rowIdx, Math.max(0, activeTable.rows.length - 1)) : 0;
  const safeColA = activeTable
    ? Math.max(firstDataCol, Math.min(colA, Math.max(firstDataCol, activeTable.headers.length - 1)))
    : 1;
  const safeColB = activeTable
    ? Math.max(firstDataCol, Math.min(colB, Math.max(firstDataCol, activeTable.headers.length - 1)))
    : 2;

  const comparison = useMemo(() => {
    if (!activeTable) return null;
    return compareTableMetrics(activeTable, safeRowIdx, safeColA, safeColB);
  }, [activeTable, safeRowIdx, safeColA, safeColB]);

  // Parse verified chart dataset directly from activeTable cells
  const chartData = useMemo(() => {
    if (!activeTable) return [];
    const parseVal = (raw: string) => {
      const cleaned = (raw || '').replace(/[,₹$%\s+A-Za-z]/g, '');
      const num = Number.parseFloat(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    return activeTable.rows
      .map((row) => {
        const label = row[0] || 'Entry';
        const rowUnit = hasUnitCol && row[1] ? row[1] : activeTable.unit;
        const primaryRaw = row[effectiveChartCol] || '0';
        const primaryVal = parseVal(primaryRaw);
        const firstPeriodRaw = row[firstDataCol] || '0';
        const firstPeriodVal = parseVal(firstPeriodRaw);
        const lastPeriodRaw = row[lastDataCol] || '0';
        const lastPeriodVal = parseVal(lastPeriodRaw);

        // Multi-period series across all numeric columns for this row
        const series = activeTable.headers
          .slice(firstDataCol)
          .map((h, idx) => {
            const cellRaw = row[firstDataCol + idx] || '0';
            return {
              period: h,
              raw: cellRaw,
              value: parseVal(cellRaw) ?? 0,
            };
          });

        return {
          label,
          unit: rowUnit,
          primaryRaw,
          primaryVal: primaryVal ?? 0,
          firstPeriodRaw,
          firstPeriodVal: firstPeriodVal ?? 0,
          lastPeriodRaw,
          lastPeriodVal: lastPeriodVal ?? 0,
          series,
        };
      })
      .filter((d) => Number.isFinite(d.primaryVal));
  }, [activeTable, effectiveChartCol, firstDataCol, lastDataCol, hasUnitCol]);

  const handleRunProgrammaticQuery = (questionText: string) => {
    if (!report) return;
    setCalcQuery(questionText);
    const candidateReports = allReports.length > 0 ? allReports : [report];
    const result = computeProgrammaticTableAnalysis(
      questionText,
      candidateReports,
      activeTable || undefined
    );
    setActiveCalcResult(result);
  };

  const handleExportCSV = () => {
    if (!activeTable) return;
    const csvLines = [
      activeTable.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...activeTable.rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTable.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
            <Table2 className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Statistical Table Intelligence &amp; Interactive Data Explorer
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
            Upload a report containing statistical tables or load the MoSPI &amp; IESA evaluation
            dataset to run programmatic calculations, compare state-level metrics, and generate
            verified charts.
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

  if (tables.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center shadow-xs">
          <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            No Structured Tables Detected in &ldquo;{report.title}&rdquo;
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            This document contains narrative passages across {report.pageCount} pages, but no
            pipe-delimited or multi-column statistical tables were detected.
          </p>
        </div>
      </div>
    );
  }

  const maxChartVal = Math.max(
    1,
    ...chartData.map((d) => Math.max(Math.abs(d.primaryVal), Math.abs(d.lastPeriodVal)))
  );
  const pieTotal = Math.max(
    1,
    chartData.reduce((acc, d) => acc + Math.max(0, d.primaryVal), 0)
  );
  const PIE_COLORS = ['#2563EB', '#4F46E5', '#0D9488', '#D97706', '#E11D48', '#7C3AED'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Table Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
              <Calculator className="w-3.5 h-3.5" />
              Phase 4 &amp; 6 · Programmatic Table Math &amp; Verified Visual Explorer
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Statistical Table Intelligence &amp; Interactive Data Explorer
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Source Report: <span className="font-semibold text-slate-900">{report.title}</span> ·{' '}
              <span className="tabular-nums font-semibold text-blue-700">
                {tables.length} extracted table{tables.length === 1 ? '' : 's'}
              </span>
            </p>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search tables, indicators, states..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Table Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {filteredTables.map((tbl) => {
            const isSelected = activeTable?.tableId === tbl.tableId;
            return (
              <button
                key={tbl.tableId}
                type="button"
                onClick={() => {
                  setSelectedTableId(tbl.tableId);
                  setRowIdx(0);
                  setChartColIdx(-1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{tbl.title}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-white text-slate-500'
                  }`}
                >
                  Page {tbl.pageNumber}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PHASE 4: Programmatic Table Intelligence Engine */}
      {activeTable && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                Programmatic Table Calculation Engine (Zero-Hallucination Math)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Executes deterministic formulas directly over parsed table cells and verifies unit
                compatibility before computing.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold self-start sm:self-center">
              Unit Safeguard Active
            </span>
          </div>

          {/* 5 Required Analytical Question Presets + Unit Safeguard Test */}
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: 'Which state/entry has the highest value?',
                query: `Which state has the highest value in ${activeTable.title}?`,
              },
              {
                label: 'What is the percentage change between two years?',
                query: `What is the percentage change between two years in ${activeTable.title}?`,
              },
              {
                label: 'Which category experienced the largest decline?',
                query: `Which category experienced the largest decline in ${activeTable.title}?`,
              },
              {
                label: 'Compare the data across selected states/entries',
                query: `Compare the data across selected states in ${activeTable.title}.`,
              },
              {
                label: 'What is the difference between two reported values?',
                query: `What is the difference between two reported values in ${activeTable.title}?`,
              },
              {
                label: 'Test Ambiguous / Incompatible Unit Safeguard',
                query:
                  'Add the national population in millions and the literacy rate percentage together.',
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleRunProgrammaticQuery(item.query)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-xs font-medium transition-all cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Calculation Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (calcQuery.trim()) {
                handleRunProgrammaticQuery(calcQuery.trim());
              }
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={calcQuery}
              onChange={(e) => setCalcQuery(e.target.value)}
              placeholder="Ask a numerical or table calculation question (e.g., 'What is the percentage change for Solar Photovoltaic from 2020 to 2026?')..."
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              Compute Programmatically
            </button>
          </form>

          {/* Programmatic Calculation Result Card */}
          {activeCalcResult && (
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                activeCalcResult.calculationType === 'unit_limitation'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-slate-50/90 border-blue-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {activeCalcResult.calculationType === 'unit_limitation' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Programmatic Result · {activeCalcResult.calculationType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeCalcResult.citations[0] && (
                    <button
                      type="button"
                      onClick={() => onOpenPage(activeCalcResult.citations[0].pageNumber)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Source Page {activeCalcResult.citations[0].pageNumber}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Computed Output &amp; Unit
                  </div>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-1">
                    {activeCalcResult.computedValue}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Verified Unit: <span className="font-semibold">{activeCalcResult.unit}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-3 lg:col-span-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Explicit Formula &amp; Inputs
                  </div>
                  <div className="text-xs font-mono text-slate-800 mt-1 bg-slate-50 p-2 rounded border border-slate-200/80 overflow-x-auto">
                    {activeCalcResult.formula}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                {activeCalcResult.explanation}
              </p>

              {activeCalcResult.limitationWarning && (
                <div className="p-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-xs text-amber-950 font-medium">
                  {activeCalcResult.limitationWarning}
                </div>
              )}

              {/* Source Values Used */}
              <div className="pt-2 border-t border-slate-200/70">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Exact Tabular Source Cells Used
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {activeCalcResult.sourceValues.map((sv, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-600 truncate" title={sv.label}>
                        {sv.label}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums shrink-0">
                        {sv.rawValue} ({sv.unit}) · p.{sv.pageNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 6: Interactive Data Explorer (Verified Chart Generator) */}
      {activeTable && chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                  Interactive Data Explorer
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold tabular-nums">
                  Source: {report.title} · Page {activeTable.pageNumber}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold tabular-nums">
                  Period: {activeTable.yearsCovered.join('–')}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                  Unit: {activeTable.unit}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{activeTable.title}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Chart Mode Selector */}
              {(
                [
                  { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
                  { id: 'line', label: 'Trend Line', icon: LineChart },
                  { id: 'pie', label: 'Share Pie', icon: PieChart },
                  { id: 'comparison', label: 'Multi-Year Compare', icon: TrendingUp },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setChartMode(m.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      chartMode === m.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metric Column Selector for Bar/Pie */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Active Metric Column:</span>
              {activeTable.headers.slice(firstDataCol).map((h, i) => {
                const actualCol = firstDataCol + i;
                return (
                  <button
                    key={actualCol}
                    type="button"
                    onClick={() => setChartColIdx(actualCol)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      effectiveChartCol === actualCol
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  rawTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Inspect Original Table Below
              </button>
              <button
                type="button"
                onClick={() => onOpenPage(activeTable.pageNumber)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Open PDF Page {activeTable.pageNumber}
              </button>
            </div>
          </div>

          {/* Chart Visualization Canvas */}
          <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-5">
            {chartMode === 'bar' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Verified Bar Distribution — {activeTable.headers[effectiveChartCol]} (Unit:{' '}
                  {activeTable.unit})
                </div>
                {chartData.map((d, i) => {
                  const widthPct = Math.max(
                    6,
                    Math.min(100, Math.round((Math.abs(d.primaryVal) / maxChartVal) * 100))
                  );
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{d.label}</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {d.primaryRaw} ({d.unit})
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {chartMode === 'line' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Year-wise / Column Trajectory Analysis ({activeTable.yearsCovered.join(' → ')})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {chartData.map((d, idx) => {
                    const maxRow = Math.max(1, ...d.series.map((s) => Math.abs(s.value)));
                    const points = d.series
                      .map((s, sIdx) => {
                        const x =
                          d.series.length > 1
                            ? Math.round((sIdx / (d.series.length - 1)) * 240) + 20
                            : 140;
                        const y = Math.round(75 - (Math.abs(s.value) / maxRow) * 55);
                        return `${x},${y}`;
                      })
                      .join(' ');

                    return (
                      <div
                        key={idx}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{d.label}</span>
                          <span className="text-[11px] font-semibold text-blue-700 tabular-nums">
                            {d.firstPeriodRaw} → {d.lastPeriodRaw} ({d.unit})
                          </span>
                        </div>
                        <svg viewBox="0 0 280 95" className="w-full h-24 overflow-visible">
                          <line
                            x1="20"
                            y1="80"
                            x2="260"
                            y2="80"
                            stroke="#E2E8F0"
                            strokeWidth="1"
                          />
                          <polyline
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="2.5"
                            points={points}
                          />
                          {d.series.map((s, sIdx) => {
                            const x =
                              d.series.length > 1
                                ? Math.round((sIdx / (d.series.length - 1)) * 240) + 20
                                : 140;
                            const y = Math.round(75 - (Math.abs(s.value) / maxRow) * 55);
                            return (
                              <g key={sIdx}>
                                <circle cx={x} cy={y} r="4" fill="#1D4ED8" />
                                <text
                                  x={x}
                                  y={Math.max(12, y - 7)}
                                  textAnchor="middle"
                                  className="text-[9px] fill-slate-700 font-bold"
                                >
                                  {s.raw}
                                </text>
                                <text
                                  x={x}
                                  y={92}
                                  textAnchor="middle"
                                  className="text-[8px] fill-slate-400"
                                >
                                  {s.period.slice(0, 10)}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {chartMode === 'pie' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col items-center">
                  <svg viewBox="0 0 42 42" className="w-44 h-44">
                    <circle
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="transparent"
                      stroke="#E2E8F0"
                      strokeWidth="6"
                    />
                    {
                      chartData.reduce<{
                        offset: number;
                        elements: React.ReactNode[];
                      }>(
                        (acc, d, idx) => {
                          const pct = Math.max(0, (d.primaryVal / pieTotal) * 100);
                          const dashArray = `${pct} ${100 - pct}`;
                          const el = (
                            <circle
                              key={idx}
                              cx="21"
                              cy="21"
                              r="15.915"
                              fill="transparent"
                              stroke={PIE_COLORS[idx % PIE_COLORS.length]}
                              strokeWidth="6"
                              strokeDasharray={dashArray}
                              strokeDashoffset={100 - acc.offset + 25}
                            />
                          );
                          acc.offset += pct;
                          acc.elements.push(el);
                          return acc;
                        },
                        { offset: 0, elements: [] }
                      ).elements
                    }
                  </svg>
                  <span className="text-[11px] font-semibold text-slate-500 mt-2">
                    Proportional Distribution — {activeTable.headers[effectiveChartCol]}
                  </span>
                </div>

                <div className="space-y-2">
                  {chartData.map((d, idx) => {
                    const share = ((Math.max(0, d.primaryVal) / pieTotal) * 100).toFixed(1);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span className="font-semibold text-slate-800">{d.label}</span>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {d.primaryRaw} ({share}% of table total)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {chartMode === 'comparison' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Side-by-Side Period Comparison: {activeTable.headers[firstDataCol]} vs{' '}
                  {activeTable.headers[lastDataCol]}
                </div>
                {chartData.map((d, idx) => {
                  const wA = Math.max(
                    4,
                    Math.min(100, Math.round((Math.abs(d.firstPeriodVal) / maxChartVal) * 100))
                  );
                  const wB = Math.max(
                    4,
                    Math.min(100, Math.round((Math.abs(d.lastPeriodVal) / maxChartVal) * 100))
                  );
                  const delta = Number((d.lastPeriodVal - d.firstPeriodVal).toFixed(2));
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{d.label}</span>
                        <span
                          className={`font-bold tabular-nums ${
                            delta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          Net Δ: {delta > 0 ? '+' : ''}
                          {delta} ({d.unit})
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-28 text-slate-500 truncate">
                            {activeTable.headers[firstDataCol]}
                          </span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-400 rounded-full"
                              style={{ width: `${wA}%` }}
                            />
                          </div>
                          <span className="w-16 text-right font-semibold text-slate-700 tabular-nums">
                            {d.firstPeriodRaw}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-28 text-blue-700 font-semibold truncate">
                            {activeTable.headers[lastDataCol]}
                          </span>
                          <div className="flex-1 h-2.5 bg-blue-50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${wB}%` }}
                            />
                          </div>
                          <span className="w-16 text-right font-bold text-blue-700 tabular-nums">
                            {d.lastPeriodRaw}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Supporting Evidence Caption */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                <strong>Supporting Evidence:</strong> Extracted verbatim from &ldquo;
                {activeTable.title}&rdquo; in <em>{report.title}</em> (Page {activeTable.pageNumber}
                , 0-based PDF index {activeTable.pdfPageIndex ?? activeTable.pageNumber - 1}).
              </span>
              <span className="font-semibold text-emerald-700 shrink-0">
                100% Cell-Verified · Zero Synthetic Extrapolation
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Raw Extracted Table + Interactive Two-Column Comparator */}
      {activeTable && (
        <div
          ref={rawTableRef}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold tabular-nums">
                  Page {activeTable.pageNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                  Unit: {activeTable.unit}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-medium tabular-nums">
                  Years: {activeTable.yearsCovered.join(', ')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{activeTable.title}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onOpenPage(activeTable.pageNumber)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Open Page {activeTable.pageNumber}
              </button>
              <button
                onClick={() =>
                  onAskTableQuestion(
                    `Explain the key statistics and trends in "${activeTable.title}" on Page ${activeTable.pageNumber}.`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 text-xs font-semibold transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI About Table
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80">
                  {activeTable.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 ${
                        idx > 0 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {activeTable.rows.map((row, rIndex) => (
                  <tr
                    key={rIndex}
                    onClick={() => setRowIdx(rIndex)}
                    className={`transition-colors cursor-pointer ${
                      safeRowIdx === rIndex ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {row.map((cell, cIndex) => (
                      <td
                        key={cIndex}
                        className={`py-3.5 px-4 text-sm ${
                          cIndex === 0
                            ? 'font-semibold text-slate-900'
                            : 'text-right font-mono tabular-nums text-slate-700'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interactive Row/Column Delta Comparator */}
          {activeTable.headers.length >= 3 && comparison && (
            <div className="p-6 bg-slate-50/80 border-t border-slate-200/80">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Cell-Level Metric &amp; Year Comparison Tool (Exact Source Values)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Row / Indicator
                  </label>
                  <select
                    value={safeRowIdx}
                    onChange={(e) => setRowIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    {activeTable.rows.map((r, idx) => (
                      <option key={idx} value={idx}>
                        {r[0] || `Row ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Baseline Column (Period A)
                  </label>
                  <select
                    value={safeColA}
                    onChange={(e) => setColA(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    {activeTable.headers.map((h, idx) =>
                      idx >= firstDataCol ? (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ) : null
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Comparison Column (Period B)
                  </label>
                  <select
                    value={safeColB}
                    onChange={(e) => setColB(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    {activeTable.headers.map((h, idx) =>
                      idx >= firstDataCol ? (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ) : null
                    )}
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500">
                    Verified Comparison Output ({comparison.rowLabel})
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">{comparison.summaryText}</p>
                </div>

                {comparison.numericDelta !== null && (
                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
                        comparison.numericDelta >= 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}
                    >
                      {comparison.numericDelta >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <div className="text-xs font-bold tabular-nums">
                        {comparison.numericDelta > 0 ? '+' : ''}
                        {comparison.numericDelta}
                        {comparison.percentChange !== null
                          ? ` (${comparison.percentChange > 0 ? '+' : ''}${comparison.percentChange}%)`
                          : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
