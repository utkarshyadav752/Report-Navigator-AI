import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Image as ImageIcon,
  MessageSquare,
  ScanLine,
} from 'lucide-react';
import {
  ImageAnalysisResult,
  NavigationSection,
  PipelineProgress,
  Report,
} from '../types/report';
import { processUploadedPdfFile } from '../utils/pdfProcessor';
import {
  cleanReportText,
  chunkReportPages,
  generateAutomatedInsightsAndSummary,
} from '../utils/ragEngine';

interface UploadViewProps {
  reports: Report[];
  onReportProcessed: (report: Report) => void;
  onSelectReport: (reportId: string) => void;
  onNavigate: (section: NavigationSection) => void;
}

const PIPELINE_STAGES = [
  { id: 'validating', label: '01. Validate Document Header & Integrity' },
  { id: 'extracting_text', label: '02. Extract Page-Level Text Streams' },
  { id: 'extracting_tables', label: '03. Detect & Parse Statistical Tables' },
  { id: 'cleaning_chunking', label: '04. Page-Aware Semantic Chunking' },
  { id: 'generating_embeddings', label: '05. Generate Vector Embeddings' },
  { id: 'indexing_vectors', label: '06. Store in Searchable Vector Index' },
];

export const UploadView: React.FC<UploadViewProps> = ({
  reports,
  onReportProcessed,
  onSelectReport,
  onNavigate,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress>({
    stage: 'idle',
    percent: 0,
    message: 'Ready to process PDF, TXT, CSV, or JSON reports.',
  });
  const [recentProcessedReport, setRecentProcessedReport] = useState<Report | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setErrorMessage(null);

    for (const file of files) {
      const lower = file.name.toLowerCase();
      const isSupported =
        lower.endsWith('.pdf') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.csv') ||
        lower.endsWith('.json') ||
        file.type === 'application/pdf' ||
        file.type === 'text/plain' ||
        file.type === 'text/csv' ||
        file.type === 'application/json';

      if (!isSupported) {
        setErrorMessage(
          `"${file.name}" is not a supported format. Please upload a .pdf, .txt, .csv, or .json file.`
        );
        continue;
      }

      try {
        const processed = await processUploadedPdfFile(file, (p) => setProgress(p));
        onReportProcessed(processed);
        setRecentProcessedReport(processed);
      } catch (err) {
        setProgress({
          stage: 'error',
          percent: 0,
          message: err instanceof Error ? err.message : 'Failed to process document.',
        });
        setErrorMessage(err instanceof Error ? err.message : 'Failed to process document.');
      }
    }
  };

  const handleAnalyzeImageFile = async (file: File) => {
    setIsAnalyzingImage(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      const base64Data: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/rag/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType: file.type || 'image/png',
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(
          errPayload.error ||
            'Vision OCR requires a configured multimodal model endpoint. Please upload a PDF, TXT, CSV, or JSON document for local deterministic extraction.'
        );
      }

      const resultData: {
        fileName: string;
        modelUsed: string;
        extractedTitle: string;
        extractedText: string;
        keyStatistics: { label: string; value: string }[];
        plainExplanation: string;
      } = await response.json();

      const analysisRecord: ImageAnalysisResult = {
        id: `img_${Date.now()}`,
        fileName: file.name,
        imageUrl: base64Data,
        analyzedAt: new Date().toISOString(),
        modelUsed: resultData.modelUsed,
        extractedTitle: resultData.extractedTitle,
        extractedText: resultData.extractedText,
        keyStatistics: resultData.keyStatistics,
        plainExplanation: resultData.plainExplanation,
      };
      setImageAnalysis(analysisRecord);

      const reportId = `scan_${Date.now()}`;
      const rawPages = [
        {
          pageNumber: 1,
          sectionTitle: resultData.extractedTitle,
          text: `${resultData.extractedTitle}\n\n${resultData.extractedText}\n\n${resultData.keyStatistics
            .map((s) => `${s.label}: ${s.value}`)
            .join('. ')}\n\nPlain Explanation: ${resultData.plainExplanation}`,
        },
      ];
      const chunks = chunkReportPages(rawPages, reportId);
      const pages = [
        {
          pageNumber: 1,
          pdfPageIndex: 0,
          sectionTitle: resultData.extractedTitle,
          rawText: rawPages[0].text,
          cleanedText: cleanReportText(rawPages[0].text),
          wordCount: rawPages[0].text.split(/\s+/).length,
        },
      ];
      const { insights, summary, suggestedQuestions } = generateAutomatedInsightsAndSummary(
        resultData.extractedTitle,
        pages,
        chunks,
        []
      );

      const scannedReport: Report = {
        reportId,
        title: resultData.extractedTitle,
        fileName: file.name,
        fileSize: file.size,
        pageCount: 1,
        uploadedAt: new Date().toISOString(),
        isDemo: false,
        status: 'ready',
        agency: 'Vision OCR Document',
        publicationYear: String(new Date().getFullYear()),
        pages,
        chunks,
        tables: [],
        insights,
        summary,
        suggestedQuestions,
      };
      onReportProcessed(scannedReport);
      setRecentProcessedReport(scannedReport);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to analyze image.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Document Ingestion Pipeline</span>
          <span aria-hidden="true">·</span>
          <span>PDF.js Text & Table Extraction</span>
          <span aria-hidden="true">·</span>
          <span>PDF, TXT, CSV & JSON Supported</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
          Upload Reports & Datasets
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Upload one or more PDF reports, text documents, CSV statistical tables, or JSON datasets. Text, tables, and exact page numbers are preserved and indexed automatically.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Columns: Drag & Drop Zone + Scanned Image Analyzer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Drag and Drop Card */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                handleFilesSelected(e.dataTransfer.files);
              }
            }}
            className={`bg-white dark:bg-slate-900 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <FileUp className="w-6 h-6" />
            </div>

            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Drag and drop PDF, TXT, CSV, or JSON files here
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Supports single or multiple documents. Automatically extracts page text, detects statistical tables, and builds page-aware RAG vector embeddings.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv,.json,application/pdf,text/plain,text/csv,application/json"
              multiple
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
              }}
              className="hidden"
              id="pdf-upload-input"
              data-testid="pdf-upload-input"
            />

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                Select Document Files (.PDF, .TXT, .CSV, .JSON)
              </button>
            </div>
          </div>

          {/* Scanned Report Photo / Chart Analyzer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  <ScanLine className="w-4 h-4" />
                  <span>Multimodal Vision OCR</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                  Analyze Scanned Report Page or Statistical Chart Photo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload a photo or screenshot of a scanned report page, table, or chart to extract verbatim numbers and index it for RAG Q&A.
                </p>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAnalyzeImageFile(f);
                }}
                className="hidden"
                id="image-upload-input"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isAnalyzingImage}
                onClick={() => imageInputRef.current?.click()}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {isAnalyzingImage ? 'Analyzing Scanned Image...' : 'Upload Report Photo / Scan'}
              </button>
            </div>

            {imageAnalysis && (
              <div
                className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3"
                data-testid="image-analysis-result"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {imageAnalysis.extractedTitle}
                  </span>
                  <span className="font-mono">{imageAnalysis.modelUsed}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {imageAnalysis.plainExplanation}
                </p>
                {imageAnalysis.keyStatistics.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {imageAnalysis.keyStatistics.map((stat, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {stat.label}
                        </div>
                        <div className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Live RAG Pipeline Progress & Processed Result */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                RAG Ingestion & Vector Pipeline
              </h3>
              <span className="text-xs font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">
                {progress.percent}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <p
              className="text-xs text-slate-600 dark:text-slate-300 mb-5"
              data-testid="pipeline-status-message"
            >
              {progress.message}
            </p>

            <div className="space-y-2.5">
              {PIPELINE_STAGES.map((st, idx) => {
                const isDone =
                  progress.stage === 'completed' || progress.percent > (idx + 1) * 16;
                return (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg ${
                      isDone
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span>{st.label}</span>
                    {isDone && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {recentProcessedReport && (
              <div
                className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3"
                data-testid="processed-report-card"
              >
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Ready for Evidence-Verified Q&A
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {recentProcessedReport.title}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span>{recentProcessedReport.pageCount} Pages</span>
                  <span>·</span>
                  <span>{recentProcessedReport.chunks.length} Chunks</span>
                  <span>·</span>
                  <span>{recentProcessedReport.tables.length} Tables</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectReport(recentProcessedReport.reportId);
                      onNavigate('chat');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ask Questions Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectReport(recentProcessedReport.reportId);
                      onNavigate('tables');
                    }}
                    className="px-3.5 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Inspect Tables
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectReport(recentProcessedReport.reportId);
                      onNavigate('finetune');
                    }}
                    className="px-3.5 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Inspect for Fine-Tuning
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Indexed Document Library Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Indexed Corpus ({reports.length} Documents)
            </h3>
            {reports.length === 0 ? (
              <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                <FileText className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Your corpus is currently empty
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Uploaded files will appear here with page and vector counts.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto">
                {reports.map((r) => (
                  <div
                    key={r.reportId}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {r.pageCount} pages · {r.chunks.length} vectors · {r.tables.length} tables
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectReport(r.reportId);
                        onNavigate('chat');
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded transition-colors shrink-0"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
