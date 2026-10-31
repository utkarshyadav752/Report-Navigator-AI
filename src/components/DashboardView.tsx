import React from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Clock,
  FileText,
  FileUp,
  FolderSearch,
  Layers,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  ChatMessage,
  NavigationSection,
  Report,
  SavedResearchItem,
} from '../types/report';
import { KnowledgeAtlas3D } from './KnowledgeAtlas3D';

interface DashboardViewProps {
  reports: Report[];
  activeReport: Report | null;
  totalQuestionsAnswered: number;
  recentMessages: ChatMessage[];
  savedResearch: SavedResearchItem[];
  onSelectReport: (reportId: string) => void;
  onNavigate: (section: NavigationSection) => void;
  onOpenSourcePage: (pageNumber: number) => void;
  onLoadEvaluationDataset?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reports,
  activeReport,
  totalQuestionsAnswered,
  recentMessages,
  savedResearch,
  onSelectReport,
  onNavigate,
  onOpenSourcePage,
  onLoadEvaluationDataset,
}) => {
  const totalPages = reports.reduce((acc, r) => acc + r.pageCount, 0);
  const totalChunks = reports.reduce((acc, r) => acc + r.chunks.length, 0);
  const totalTables = reports.reduce((acc, r) => acc + r.tables.length, 0);

  const userQuestions = recentMessages.filter((m) => m.role === 'user').slice(-4).reverse();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12" data-testid="dashboard-view">
      {/* Workspace Welcome Banner */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Direct Workspace Access
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {reports.length} Reports ({totalPages} Pages) Indexed
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Welcome to Report Navigator AI Research Hub
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {reports.length === 0 && onLoadEvaluationDataset && (
            <button
              type="button"
              onClick={onLoadEvaluationDataset}
              data-testid="load-eval-dataset-btn"
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load MoSPI &amp; IESA Benchmark Dataset (2 Reports)
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('compare')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Compare Reports
          </button>

          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderSearch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            My Documents ({reports.length})
          </button>

          <button
            type="button"
            onClick={() => onNavigate('summary')}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Research History ({savedResearch.length})
          </button>

          <button
            type="button"
            onClick={() => onNavigate('finetune')}
            data-testid="dashboard-open-finetune-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Fine-Tuning &amp; Dataset Lab
          </button>
        </div>
      </section>

      {/* Hero Split Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
              <span>Evidence Intelligence Engine</span>
              <span aria-hidden="true">·</span>
              <span>Programmatic Table Math</span>
              <span aria-hidden="true">·</span>
              <span>Claim-Level Verification</span>
            </div>

            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
              Don&apos;t just get answers. Get the evidence.
            </p>

            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]"
              style={{ textWrap: 'balance' }}
            >
              Turn hundreds of pages of complex reports into verified, understandable, actionable intelligence.
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Upload government PDF reports, statistical compendiums, CSV tables, or structured
              datasets to ask questions in English, Hindi, or Hinglish—with exact page citations,
              programmatic table calculations, multi-report contradiction detection, and verbatim source evidence.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileUp className="w-4 h-4" />
                Upload a Report
              </button>

              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="px-4 py-2.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                AI Research Assistant
              </button>

              <button
                type="button"
                onClick={() => onNavigate('compare')}
                className="px-4 py-2.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Compare Reports
              </button>
            </div>

            <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Strict Evidence Integrity: Every factual claim is independently verified against
                extracted source text. Unsupported questions return{' '}
                <span className="font-mono text-slate-700 dark:text-slate-200">
                  &quot;Insufficient evidence found in the uploaded reports.&quot;
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D Knowledge & Citation Atlas Preview */}
        <div className="lg:col-span-6 flex flex-col">
          <KnowledgeAtlas3D
            report={activeReport}
            onSelectPage={onOpenSourcePage}
            isEmbeddedPreview={true}
            onExpandFullScreen={() => onNavigate('atlas3d')}
          />
        </div>
      </section>

      {/* Full-Width 4-Column KPI Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Documents Processed</p>
          <p
            className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums"
            data-testid="metric-total-documents"
          >
            {reports.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {reports.length === 0 ? 'Upload PDF, TXT, CSV, or JSON' : 'Indexed & ready for RAG Q&A'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Questions Answered</p>
          <p
            className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums"
            data-testid="metric-questions-answered"
          >
            {totalQuestionsAnswered}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            100% page-cited or strictly declined
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pages & Vector Chunks Indexed</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
            {totalPages} / {totalChunks}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hybrid search + cross-encoder reranked
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Structured Tables Extracted</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
            {totalTables}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Units, years & column headers preserved
          </p>
        </div>
      </section>

      {/* Personalized Research History & Saved Research Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Questions & Research History */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent Research Questions & History
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Open AI Chat →
            </button>
          </div>

          {userQuestions.length === 0 ? (
            <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                No research questions asked yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a document and ask questions in the AI Research Assistant to see your verified history here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {userQuestions.map((q) => {
                const rep = reports.find((r) => r.reportId === q.reportId) || activeReport;
                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        &quot;{q.content}&quot;
                      </p>
                      {rep && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {rep.title} · {rep.pageCount} pages
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (rep) onSelectReport(rep.reportId);
                        onNavigate('chat');
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 rounded transition-colors shrink-0"
                    >
                      Revisit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Saved Research Bookmarks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Saved Research & Cited Findings ({savedResearch.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('summary')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Export Center →
            </button>
          </div>

          {savedResearch.length === 0 ? (
            <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                No saved findings bookmarked yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bookmark verified answers in the AI Chat to compile and export executive briefs.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedResearch.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {item.reportTitle}
                    </span>
                    <span className="font-mono">
                      {item.citations[0] ? `Page ${item.citations[0].pageNumber}` : 'Verified'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    {item.question}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Uploaded Reports Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Uploaded & Indexed Reports
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              All documents processed with page-level text streams, vector embeddings, and table extraction.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="px-3.5 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Open Document Explorer
            </button>
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="px-3.5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              + Upload Report
            </button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="p-12 text-center space-y-3" data-testid="dashboard-empty-reports">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              No Reports Uploaded Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Upload a PDF, TXT, CSV, or JSON report to extract page-level passages, statistical
              tables, and searchable RAG vector embeddings.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5" />
                Upload Your First Report
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
                  <th className="py-3 px-6 font-medium">Report Title & Agency</th>
                  <th className="py-3 px-4 font-medium">Format</th>
                  <th className="py-3 px-4 font-medium text-right">Pages</th>
                  <th className="py-3 px-4 font-medium text-right">RAG Chunks</th>
                  <th className="py-3 px-4 font-medium text-right">Tables</th>
                  <th className="py-3 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {reports.map((rep) => {
                  const isSelected = activeReport?.reportId === rep.reportId;
                  return (
                    <tr
                      key={rep.reportId}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {rep.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {rep.agency} · {rep.fileName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                        Uploaded Document
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {rep.pageCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {rep.chunks.length}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {rep.tables.length}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectReport(rep.reportId);
                              onNavigate('chat');
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors whitespace-nowrap"
                          >
                            Ask Questions
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectReport(rep.reportId);
                              onNavigate('tables');
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors whitespace-nowrap"
                          >
                            Tables
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectReport(rep.reportId);
                              onOpenSourcePage(1);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors whitespace-nowrap"
                          >
                            Source Page
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* How It Works & Features Section */}
      <section id="how-it-works" className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            How It Works: Unified Evidence-Verified RAG Architecture
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Combining hybrid semantic + lexical retrieval, cross-encoder reranking, and strict
            numerical verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              step: '01. Upload & OCR Extraction',
              desc: 'Drop multi-page government PDFs, TXT, CSV, or JSON datasets. Text and statistical tables are extracted with 1-indexed page numbers.',
              icon: BookOpen,
              actionLabel: 'Go to Upload',
              target: 'upload' as NavigationSection,
            },
            {
              step: '02. Hybrid Search & Reranking',
              desc: 'Combines 64-D semantic vector embeddings with lexical BM25 keyword matching and a cross-encoder reranking pass for high precision.',
              icon: Layers,
              actionLabel: 'Explore Documents',
              target: 'explore' as NavigationSection,
            },
            {
              step: '03. Ask in English, Hindi or Hinglish',
              desc: 'Query single, selected, or all reports simultaneously. Unsupported questions strictly return "Insufficient evidence found in the uploaded reports."',
              icon: SearchCheck,
              actionLabel: 'Open AI Chat',
              target: 'chat' as NavigationSection,
            },
            {
              step: '04. Verify Pages, Tables & Export',
              desc: 'Click any citation to highlight the original PDF passage, compare table years, or export briefs to PDF, DOCX, and Markdown.',
              icon: ShieldCheck,
              actionLabel: 'Open Export Center',
              target: 'summary' as NavigationSection,
            },
          ].map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.step}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(item.target)}
                  className="mt-4 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 w-fit"
                >
                  {item.actionLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
