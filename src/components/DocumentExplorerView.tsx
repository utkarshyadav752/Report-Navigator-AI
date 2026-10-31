import React, { useState } from 'react';
import {
  Eye,
  FileText,
  FileUp,
  FolderKanban,
  MessageSquare,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import { DocumentCategory, NavigationSection, Report } from '../types/report';

interface DocumentExplorerViewProps {
  reports: Report[];
  activeReport: Report | null;
  onSelectReport: (reportId: string) => void;
  onDeleteReport: (reportId: string) => void;
  onAssignCollection: (reportId: string, collectionName: string) => void;
  onNavigate: (section: NavigationSection) => void;
  onOpenPage: (pageNumber: number) => void;
}

const CATEGORIES: ('All' | DocumentCategory)[] = [
  'All',
  'Demographics & Census',
  'Macroeconomics & Fiscal',
  'Energy & Climate',
  'Custom Research',
];

const COLLECTIONS = [
  'All Collections',
  'National Statistical Compendiums',
  'Clean Energy & Climate Transitions',
  'Fiscal & Budget Audits',
  'Priority Policy Briefs',
];

export const DocumentExplorerView: React.FC<DocumentExplorerViewProps> = ({
  reports,
  activeReport,
  onSelectReport,
  onDeleteReport,
  onAssignCollection,
  onNavigate,
  onOpenPage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | DocumentCategory>('All');
  const [selectedCollection, setSelectedCollection] = useState<string>('All Collections');

  const filteredReports = reports.filter((rep) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      `${rep.title} ${rep.agency} ${rep.fileName} ${rep.publicationYear}`
        .toLowerCase()
        .includes(searchTerm.trim().toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' || (rep.category || 'Custom Research') === selectedCategory;

    const matchesCollection =
      selectedCollection === 'All Collections' ||
      (rep.collectionName || 'Custom Research') === selectedCollection;

    return matchesSearch && matchesCategory && matchesCollection;
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Document Intelligence Library</span>
            <span aria-hidden="true">·</span>
            <span>{reports.length} Total Reports Indexed</span>
            <span aria-hidden="true">·</span>
            <span>Page-Aware Vector Collections</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
            Document Explorer & Research Collections
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Search, filter, organize, and preview your uploaded PDF reports, statistical
            compendiums, and structured datasets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <FileUp className="w-4 h-4" />
            Upload New Report
          </button>
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className="px-4 py-2.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            Multi-Document AI Chat
          </button>
        </div>
      </div>

      {/* Search, Category Filter & Collection Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Search Input */}
          <div className="md:col-span-7 relative">
            <label htmlFor="explorer-search-input" className="sr-only">
              Search documents by title, agency, or year
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              id="explorer-search-input"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by report title, agency, file name, or year..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Collection Dropdown */}
          <div className="md:col-span-5 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-slate-400 shrink-0" />
            <label htmlFor="explorer-collection-select" className="text-xs text-slate-500 shrink-0">
              Collection:
            </label>
            <select
              id="explorer-collection-select"
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            >
              {COLLECTIONS.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Document Type:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Document Cards Grid */}
      {reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Your Document Library Is Empty
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Upload a PDF report, text file, CSV table, or JSON dataset to index it into your
            searchable research library.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload PDF Report
          </button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No matching documents in this view
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Try clearing your search query or category filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('All');
              setSelectedCollection('All Collections');
            }}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredReports.map((rep) => {
            const isSelected = activeReport?.reportId === rep.reportId;
            return (
              <div
                key={rep.reportId}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-6 flex flex-col justify-between transition-colors ${
                  isSelected
                    ? 'border-indigo-500 dark:border-indigo-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Metadata Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        {rep.category || 'Custom Research'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{rep.publicationYear}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        RAG Indexed ({rep.status.toUpperCase()})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteReport(rep.reportId)}
                      aria-label={`Delete ${rep.title}`}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {rep.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {rep.agency} · <span className="font-mono">{rep.fileName}</span> (
                      {formatBytes(rep.fileSize)})
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {rep.summary.overview}
                  </p>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block">Pages</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {rep.pageCount} Pages
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Semantic Chunks</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {rep.chunks.length} Vectors
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Extracted Tables</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {rep.tables.length} Tables
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions & Collection Assignment */}
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`col-select-${rep.reportId}`}
                      className="text-[11px] text-slate-500"
                    >
                      Collection:
                    </label>
                    <select
                      id={`col-select-${rep.reportId}`}
                      value={rep.collectionName || 'National Statistical Compendiums'}
                      onChange={(e) => onAssignCollection(rep.reportId, e.target.value)}
                      className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded px-2 py-1 border border-slate-200 dark:border-slate-700"
                    >
                      {COLLECTIONS.filter((c) => c !== 'All Collections').map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectReport(rep.reportId);
                        onOpenPage(1);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview Source
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectReport(rep.reportId);
                        onNavigate('tables');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Tables
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectReport(rep.reportId);
                        onNavigate('chat');
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors whitespace-nowrap"
                    >
                      Research Now →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
