import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileCode2,
  FileSearch,
  FileUp,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { NavigationSection, PipelineProgress, Report } from '../types/report';
import { processUploadedPdfFile } from '../utils/pdfProcessor';
import {
  analyzeHardwareCompatibility,
  buildFineTuningAndRagDatasets,
  getReproducibleFineTuningScripts,
  inspectPdfDataset,
  runGenuineFineTuningEvaluation,
} from '../utils/fineTuningPipeline';

interface FineTuningLabViewProps {
  reports: Report[];
  activeReport: Report | null;
  onReportProcessed: (report: Report) => void;
  onSelectReport: (reportId: string) => void;
  onNavigate: (section: NavigationSection) => void;
  onOpenPage: (pageNumber: number) => void;
  onLoadEvaluationDataset: () => void;
}

type LabTab =
  | 'inspection'
  | 'datasets'
  | 'hardware_pipeline'
  | 'evaluation'
  | 'integration';

export const FineTuningLabView: React.FC<FineTuningLabViewProps> = ({
  reports,
  activeReport,
  onReportProcessed,
  onSelectReport,
  onNavigate,
  onOpenPage,
  onLoadEvaluationDataset,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<LabTab>('inspection');
  const [selectedSplitPreview, setSelectedSplitPreview] = useState<
    'rag' | 'train' | 'validation' | 'test'
  >('train');
  const [selectedScriptFile, setSelectedScriptFile] = useState<string>(
    '02_train_qlora_rtx3050.py'
  );
  const [uploadProgress, setUploadProgress] = useState<PipelineProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<'all_loaded' | 'active_only'>('all_loaded');

  const targetReports = useMemo(() => {
    if (scopeMode === 'active_only' && activeReport) {
      return [activeReport];
    }
    return reports;
  }, [reports, activeReport, scopeMode]);

  const { inspection, quality } = useMemo(
    () => inspectPdfDataset(targetReports),
    [targetReports]
  );

  const preparedDatasets = useMemo(
    () => buildFineTuningAndRagDatasets(targetReports),
    [targetReports]
  );

  const hardwareReport = useMemo(() => analyzeHardwareCompatibility(), []);

  const evaluationReport = useMemo(
    () => runGenuineFineTuningEvaluation(targetReports, preparedDatasets.testExamples),
    [targetReports, preparedDatasets.testExamples]
  );

  const scriptsMap = useMemo(() => getReproducibleFineTuningScripts(), []);

  const handleUploadMentorPdf = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    const file = fileList[0];
    try {
      const processed = await processUploadedPdfFile(file, (p) => setUploadProgress(p));
      onReportProcessed(processed);
      onSelectReport(processed.reportId);
      setScopeMode('active_only');
      setUploadProgress(null);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to extract PDF dataset.'
      );
      setUploadProgress(null);
    }
  };

  const handleDownloadFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="max-w-7xl mx-auto px-6 py-8 space-y-8"
      data-testid="finetuning-lab-view"
    >
      {/* Header & Mentor PDF Upload Action Bar */}
      <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Dataset Engineering &amp; QLoRA Fine-Tuning Workbench</span>
            <span aria-hidden="true">·</span>
            <span>Windows 11 · 8 GB RAM · RTX 3050 (&le; 4 GB VRAM) Profile</span>
            <span aria-hidden="true">·</span>
            <span>Zero-Fabrication Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
            PDF Dataset Inspection &amp; Fine-Tuning Workflow
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
            Inspect uploaded PDF reports for structure, tables, terminology, and supervised
            fine-tuning suitability. Generate deduplicated RAG and QLoRA JSONL splits with
            verified zero train/validation/test leakage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.csv,.json,application/pdf"
            onChange={(e) => handleUploadMentorPdf(e.target.files)}
            className="hidden"
            id="mentor-pdf-upload"
            data-testid="mentor-pdf-upload"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload Mentor PDF Dataset
          </button>

          {reports.length === 0 && (
            <button
              type="button"
              onClick={onLoadEvaluationDataset}
              data-testid="ft-load-benchmark-btn"
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Workspace PDF Dataset (MoSPI &amp; IESA)
            </button>
          )}

          {reports.length > 1 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setScopeMode('all_loaded')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scopeMode === 'all_loaded'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                All Loaded PDFs ({reports.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('active_only')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scopeMode === 'active_only'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Active PDF Only
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadProgress && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {uploadProgress.message}
          </span>
          <span className="text-xs font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
            {uploadProgress.percent}%
          </span>
        </div>
      )}

      {uploadError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
        >
          {uploadError}
        </div>
      )}

      {/* Empty State if no PDF is loaded */}
      {targetReports.length === 0 ? (
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-4"
          data-testid="finetune-empty-state"
        >
          <FileSearch className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto" />
          <div className="space-y-1 max-w-lg mx-auto">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Ready to Inspect Your Uploaded PDF Dataset
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload the PDF dataset provided by your mentor to inspect its pages, sections,
              tables, numerical statistics, and terminology—or load the existing MoSPI &amp;
              IESA statistical reports in the project to inspect the complete 12-deliverable
              workflow now.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              Select Mentor PDF File
            </button>
            <button
              type="button"
              onClick={onLoadEvaluationDataset}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Inspect Project PDF Corpus (MoSPI 2026 &amp; IESA 2026)
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column Top KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspected PDF Pages &amp; Tables
              </p>
              <p
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1 whitespace-nowrap"
                data-testid="ft-metric-pages-tables"
              >
                {inspection.totalPages} Pages · {inspection.totalTables} Tables
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {inspection.totalWords.toLocaleString()} words ·{' '}
                {inspection.terminologyInventory.length} domain terms
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Native Pre-Labelled SFT Pairs in PDF
              </p>
              <p
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1"
                data-testid="ft-metric-native-pairs"
              >
                {inspection.nativeSupervisedPairCount} Pairs
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {inspection.contentClassification === 'ordinary_research_report'
                  ? 'Ordinary Statistical Report (Requires Grounded RAG + SFT)'
                  : 'Contains Explicit Supervised Q&A Pairs'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prepared Train / Val / Test Splits
              </p>
              <p
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1"
                data-testid="ft-metric-splits"
              >
                {preparedDatasets.trainExamples.length} /{' '}
                {preparedDatasets.validationExamples.length} /{' '}
                {preparedDatasets.testExamples.length}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {preparedDatasets.leakageAudit.verifiedClean
                  ? '0 Split Leakage Verified · Deduplicated'
                  : 'Overlap Warning'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unseen Test Split Accuracy (RAG Baseline)
              </p>
              <p
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1"
                data-testid="ft-metric-eval-accuracy"
              >
                {evaluationReport.metrics.questionAnswerAccuracyPct}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {evaluationReport.metrics.unsupportedRefusalAccuracyPct}% Refusal ·{' '}
                {evaluationReport.metrics.hallucinationRatePct}% Hallucination
              </p>
            </div>
          </div>

          {/* Segmented Navigation Tabs for the 12 Deliverables */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
            {(
              [
                {
                  id: 'inspection',
                  label: '1–2. PDF Inspection & Quality',
                  icon: FileSearch,
                },
                {
                  id: 'datasets',
                  label: '3–6. RAG & SFT JSONL Splits',
                  icon: Database,
                },
                {
                  id: 'hardware_pipeline',
                  label: '7–9. RTX 3050 Hardware & Scripts',
                  icon: Cpu,
                },
                {
                  id: 'evaluation',
                  label: '10. Unseen Test Evaluation',
                  icon: ShieldCheck,
                },
                {
                  id: 'integration',
                  label: '11–12. Export & Integration',
                  icon: Layers,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`ft-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: PDF DATASET INSPECTION & QUALITY REPORT */}
          {activeTab === 'inspection' && (
            <div className="space-y-8" data-testid="ft-panel-inspection">
              {/* SFT Suitability Determination Callout */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Deliverable 1 &amp; 2: Supervised Fine-Tuning Suitability &amp;
                      Dataset Classification
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Classification: {inspection.contentClassification}
                  </span>
                </div>

                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {inspection.suitabilityExplanation}
                </p>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {inspection.ragAlternativeRecommendation}
                  </p>
                </div>
              </div>

              {/* Page-by-Page Structure & Section Inventory */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Page-by-Page PDF Structure &amp; Extraction Audit (
                      {inspection.pageInspections.length} Pages)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Real extracted sections, word counts, structured table counts, and
                      numerical tokens per page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        'pdf_inspection_and_quality_report.json',
                        JSON.stringify({ inspection, quality }, null, 2),
                        'application/json'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Inspection JSON
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-2.5 px-4 font-medium">Document &amp; Page</th>
                        <th className="py-2.5 px-4 font-medium">Extracted Section Title</th>
                        <th className="py-2.5 px-4 font-medium text-right">Words</th>
                        <th className="py-2.5 px-4 font-medium text-right">Tables</th>
                        <th className="py-2.5 px-4 font-medium">Sample Numbers Verified</th>
                        <th className="py-2.5 px-4 font-medium">Extraction Audit Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {inspection.pageInspections.map((p) => (
                        <tr
                          key={`${p.reportId}_p${p.pageNumber}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectReport(p.reportId);
                                onOpenPage(p.pageNumber);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                            >
                              {p.fileName} · Page {p.pageNumber}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                            {p.sectionTitle}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {p.wordCount}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {p.tableCount}
                          </td>
                          <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {p.numbersDetected.slice(0, 4).join(' · ') || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                            {p.notes.join(' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Extracted Tables & Technical Terminology Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tables Inventory */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Structured Tables Inventory ({inspection.tablesInventory.length}{' '}
                      Tables)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Preserves exact table titles, measurement units, years covered, and
                      column headers.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {inspection.tablesInventory.map((t) => (
                      <div key={t.tableId} className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {t.title}
                          </span>
                          <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                            Page {t.pageNumber} · {t.rowCount} rows
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          Unit: <span className="font-mono">{t.unit}</span> · Headers:{' '}
                          <span className="font-mono">{t.columnHeaders.join(' | ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Terminology Inventory */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Domain Terminology &amp; Acronyms Preserved (
                      {inspection.terminologyInventory.length} Terms)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Extracted directly from source sentences without inventing definitions.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs max-h-80 overflow-y-auto">
                    {inspection.terminologyInventory.map((term) => (
                      <div
                        key={`${term.term}_p${term.pageNumber}`}
                        className="py-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {term.term} — {term.expansionOrContext}
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">
                            Page {term.pageNumber}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                          &ldquo;{term.verbatimSentence}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Deliverable 2: Dataset Quality & Cross-Report Discrepancy Audit */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Deliverable 2: Dataset Quality, Duplication &amp; Discrepancy Audit
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Audited {quality.totalPagesAudited} pages · {quality.cleanPagesCount}{' '}
                      clean pages · {quality.duplicatePassagesCount} duplicate passages ·{' '}
                      {quality.extractionErrorsCount} extraction errors
                    </p>
                  </div>
                </div>

                {quality.crossReportDiscrepancies.length > 0 && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Cross-Document Methodology Difference Detected (Preserved Without
                      Overwriting):
                    </div>
                    {quality.crossReportDiscrepancies.map((d, idx) => (
                      <div key={idx} className="space-y-1 text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            Metric:
                          </span>{' '}
                          {d.metric}
                        </div>
                        <div>• {d.sourceA}</div>
                        <div>• {d.sourceB}</div>
                        <div className="text-slate-500">{d.note}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {quality.issues.map((iss, idx) => (
                    <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {iss.location} ·{' '}
                          <span className="font-mono text-slate-500">{iss.category}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{iss.description}</p>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 sm:text-right max-w-md">
                        Remediation: {iss.remediation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RAG CORPUS & SFT JSONL DATASETS (DELIVERABLES 3, 4, 5, 6) */}
          {activeTab === 'datasets' && (
            <div className="space-y-6" data-testid="ft-panel-datasets">
              {/* Split Leakage Verification Banner */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Deliverables 3–6: Deduplicated RAG Corpus &amp; Zero-Leakage SFT
                      JSONL Splits
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Total Verified SFT Examples: {preparedDatasets.allExamplesCount} (
                    {preparedDatasets.removedDuplicatesCount} duplicates removed) ·
                    Train–Val Overlap: {preparedDatasets.leakageAudit.trainValOverlapCount}{' '}
                    · Train–Test Overlap:{' '}
                    {preparedDatasets.leakageAudit.trainTestOverlapCount} · Val–Test
                    Overlap: {preparedDatasets.leakageAudit.valTestOverlapCount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        'rag_corpus_chunks.jsonl',
                        preparedDatasets.ragJsonl,
                        'application/jsonl'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    rag_corpus_chunks.jsonl ({preparedDatasets.ragRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        'train.jsonl',
                        preparedDatasets.trainJsonl,
                        'application/jsonl'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    train.jsonl ({preparedDatasets.trainExamples.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        'validation.jsonl',
                        preparedDatasets.validationJsonl,
                        'application/jsonl'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    validation.jsonl ({preparedDatasets.validationExamples.length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        'test.jsonl',
                        preparedDatasets.testJsonl,
                        'application/jsonl'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    test.jsonl ({preparedDatasets.testExamples.length})
                  </button>
                </div>
              </div>

              {/* Split Selector & Live JSONL Inspector */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(
                      [
                        {
                          id: 'train',
                          label: `4. Training Set (train.jsonl · ${preparedDatasets.trainExamples.length})`,
                        },
                        {
                          id: 'validation',
                          label: `5. Validation Set (validation.jsonl · ${preparedDatasets.validationExamples.length})`,
                        },
                        {
                          id: 'test',
                          label: `6. Unseen Test Set (test.jsonl · ${preparedDatasets.testExamples.length})`,
                        },
                        {
                          id: 'rag',
                          label: `3. RAG Corpus (rag_corpus_chunks.jsonl · ${preparedDatasets.ragRecords.length})`,
                        },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSplitPreview(s.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                          selectedSplitPreview === s.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedSplitPreview === 'rag' ? (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {preparedDatasets.ragRecords.map((rec) => (
                      <div key={rec.chunk_id} className="py-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-500 font-mono">
                          <span>
                            {rec.chunk_id} · {rec.document_name} · Page {rec.page_number}
                          </span>
                          <span>~{rec.token_estimate} tokens</span>
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {rec.section_title}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                          {rec.verbatim_text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {(selectedSplitPreview === 'train'
                      ? preparedDatasets.trainExamples
                      : selectedSplitPreview === 'validation'
                      ? preparedDatasets.validationExamples
                      : preparedDatasets.testExamples
                    ).map((ex) => (
                      <div key={ex.id} className="py-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500 font-mono">
                          <span>
                            {ex.id} · Category: {ex.taskCategory} · Source:{' '}
                            {ex.sourceDocument} (Page {ex.pageNumber})
                          </span>
                          <span>{ex.exampleSource}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Instruction:{' '}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200">
                            {ex.instruction}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] line-clamp-2">
                          Context Input: {ex.input}
                        </div>
                        <div>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            Target Response:{' '}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200">
                            {ex.output}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE COMPATIBILITY & COMPLETE PYTHON TRAINING SCRIPTS (DELIVERABLES 7, 8, 9) */}
          {activeTab === 'hardware_pipeline' && (
            <div className="space-y-6" data-testid="ft-panel-hardware">
              {/* Hardware Compatibility Matrix */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Deliverable 7: Hardware Compatibility Analysis ({hardwareReport.os} ·{' '}
                    {hardwareReport.systemRamGb} GB RAM · {hardwareReport.gpuModel} &le;{' '}
                    {hardwareReport.gpuVramGb} GB VRAM)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {hardwareReport.whyCloudSandboxCannotTrainWeights}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-2.5 px-4 font-medium">Base Model Candidate</th>
                        <th className="py-2.5 px-4 font-medium">Parameters &amp; Method</th>
                        <th className="py-2.5 px-4 font-medium text-right">Est. Peak VRAM</th>
                        <th className="py-2.5 px-4 font-medium text-right">Est. System RAM</th>
                        <th className="py-2.5 px-4 font-medium">RTX 3050 (4 GB) Verdict</th>
                        <th className="py-2.5 px-4 font-medium">Engineering Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {hardwareReport.candidates.map((cand) => (
                        <tr key={cand.modelId}>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                            {cand.modelId}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                            {cand.parameterCount} · {cand.quantization}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            {cand.estimatedVramGb.toFixed(1)} GB / 4.0 GB
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {cand.estimatedSystemRamGb.toFixed(1)} GB / 8.0 GB
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            <span
                              className={
                                cand.status === 'RECOMMENDED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : cand.status === 'TIGHT_FIT_CAUTION'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {cand.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                            {cand.explanation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Low-Memory Safeguards Enabled for 4 GB VRAM + 8 GB System RAM:
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {hardwareReport.memoryOptimizationNotes.map((note, idx) => (
                      <li key={idx}>• {note}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Deliverables 8 & 9: Complete Training Scripts & Configuration Viewer */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {Object.keys(scriptsMap).map((fileName) => (
                      <button
                        key={fileName}
                        type="button"
                        onClick={() => setSelectedScriptFile(fileName)}
                        className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                          selectedScriptFile === fileName
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {fileName}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        selectedScriptFile,
                        scriptsMap[selectedScriptFile] || ''
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download {selectedScriptFile}
                  </button>
                </div>

                <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[460px]">
                  <code>{scriptsMap[selectedScriptFile]}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: GENUINE EVALUATION SUITE & ACTUAL RESULTS (DELIVERABLE 10) */}
          {activeTab === 'evaluation' && (
            <div className="space-y-6" data-testid="ft-panel-evaluation">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Deliverable 10: Genuine Evaluation on Unseen Test Split (test.jsonl ·{' '}
                      {evaluationReport.unseenTestExamplesCount} Unseen Examples)
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-4xl">
                      {evaluationReport.evaluationEnvironmentNote}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(
                        'unseen_test_evaluation_results.json',
                        JSON.stringify(evaluationReport, null, 2),
                        'application/json'
                      )
                    }
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Evaluation Report JSON
                  </button>
                </div>

                {/* 6 Evaluation Dimension Scores */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800 py-4">
                  {[
                    {
                      label: 'Q&A Accuracy',
                      val: `${evaluationReport.metrics.questionAnswerAccuracyPct}%`,
                    },
                    {
                      label: 'Terminology Accuracy',
                      val: `${evaluationReport.metrics.technicalTerminologyAccuracyPct}%`,
                    },
                    {
                      label: 'Numerical Accuracy',
                      val: `${evaluationReport.metrics.numericalAccuracyPct}%`,
                    },
                    {
                      label: 'Instruction Following',
                      val: `${evaluationReport.metrics.instructionFollowingPct}%`,
                    },
                    {
                      label: 'Refusal Accuracy',
                      val: `${evaluationReport.metrics.unsupportedRefusalAccuracyPct}%`,
                    },
                    {
                      label: 'Hallucination Rate',
                      val: `${evaluationReport.metrics.hallucinationRatePct}%`,
                    },
                  ].map((m) => (
                    <div key={m.label} className="px-4 py-1 first:pl-0">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {m.label}
                      </div>
                      <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {m.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per-Example Unseen Test Table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-2.5 px-3 font-medium">Unseen Test Question</th>
                        <th className="py-2.5 px-3 font-medium">Actual System Output</th>
                        <th className="py-2.5 px-3 font-medium text-center">Page Cited</th>
                        <th className="py-2.5 px-3 font-medium text-center">Numbers</th>
                        <th className="py-2.5 px-3 font-medium text-center">Zero Halluc.</th>
                        <th className="py-2.5 px-3 font-medium text-right">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {evaluationReport.itemResults.map((item) => (
                        <tr key={item.exampleId}>
                          <td className="py-3 px-3 font-medium text-slate-900 dark:text-white max-w-xs">
                            <div>{item.question}</div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              {item.sourceDocument} · Expected Page {item.expectedPage}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-md">
                            {item.actualOutput}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {item.instructionFollowed ? 'PASS' : 'FAIL'}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {item.numericalAccurate ? 'PASS' : 'FAIL'}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {item.zeroHallucinationPassed ? 'PASS' : 'FAIL'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold">
                            <span
                              className={
                                item.qaAccurate
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {item.qaAccurate ? 'VERIFIED' : 'PARTIAL'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MODEL EXPORT & REPORT NAVIGATOR AI INTEGRATION (DELIVERABLES 11 & 12) */}
          {activeTab === 'integration' && (
            <div className="space-y-6" data-testid="ft-panel-integration">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Deliverables 11 &amp; 12: LoRA Adapter Export &amp; Report Navigator
                      AI Integration
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Strict architectural separation between fine-tuned model skills and
                      live document retrieval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('chat')}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Test Live in AI Research Assistant
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <FileCode2 className="w-4 h-4" />
                      <span>What QLoRA Fine-Tuning Learns (Model Weights)</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <li>
                        • Strict adherence to inline <span className="font-mono">[Page X]</span>{' '}
                        citation syntax on every statistical claim.
                      </li>
                      <li>
                        • Domain terminology comprehension (MoSPI, TFR, LFPR, GER, GSDP,
                        BESS, UPI, LFP).
                      </li>
                      <li>
                        • Multi-year pipe-delimited table reading and percentage change
                        interpretation.
                      </li>
                      <li>
                        • Mandatory refusal phrase when evidence is missing from the
                        retrieved context.
                      </li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Database className="w-4 h-4" />
                      <span>What RAG Retrieval Provides at Runtime (Document Truth)</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <li>
                        • Exact source document names, 1-based page numbers, and 0-based
                        PDF indices.
                      </li>
                      <li>
                        • Verbatim supporting passages and extracted statistical tables with
                        units.
                      </li>
                      <li>
                        • Post-generation numerical verification and claim-level support
                        auditing.
                      </li>
                      <li>
                        • Cross-document contradiction detection across multiple uploaded
                        reports.
                      </li>
                    </ul>
                  </div>
                </div>

                <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                  <code>{scriptsMap['04_export_and_integrate_ollama.md']}</code>
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
