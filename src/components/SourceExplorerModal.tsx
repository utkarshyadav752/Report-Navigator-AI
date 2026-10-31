import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCheck2,
  FileText,
  Layers,
  MapPin,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { Citation, Report } from '../types/report';
import { extractSupportingSentences } from '../utils/ragEngine';

interface SourceExplorerModalProps {
  report: Report;
  reports?: Report[];
  initialPageNumber: number;
  activeCitation?: Citation | null;
  allCitations?: Citation[];
  onSelectCitation?: (citation: Citation) => void;
  onClose: () => void;
}

export const SourceExplorerModal: React.FC<SourceExplorerModalProps> = ({
  report,
  initialPageNumber,
  activeCitation,
  allCitations = [],
  onSelectCitation,
  onClose,
}) => {
  const resolveTargetPage = () => {
    const target =
      activeCitation && activeCitation.reportId === report.reportId
        ? activeCitation.pageNumber
        : initialPageNumber;
    return Math.max(1, Math.min(report.pageCount, target));
  };

  const [currentPage, setCurrentPage] = useState<number>(resolveTargetPage);
  const [copied, setCopied] = useState(false);
  const [pdfCanvasReady, setPdfCanvasReady] = useState(false);
  const highlightedRegionRef = useRef<HTMLElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Always sync to the exact cited page whenever activeCitation or initialPageNumber changes (never default to page 1)
  useEffect(() => {
    const nextTarget =
      activeCitation && activeCitation.reportId === report.reportId
        ? activeCitation.pageNumber
        : initialPageNumber;
    if (nextTarget >= 1 && nextTarget <= report.pageCount) {
      setCurrentPage(nextTarget);
    }
  }, [
    initialPageNumber,
    activeCitation?.citationId,
    activeCitation?.pageNumber,
    activeCitation?.reportId,
    report.reportId,
    report.pageCount,
  ]);

  // Render actual PDF page on canvas via pdfjs-dist when report.pdfDataUrl is available
  useEffect(() => {
    let cancelled = false;
    setPdfCanvasReady(false);

    if (!report.pdfDataUrl || !pdfCanvasRef.current) return;

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }
        const base64Part = report.pdfDataUrl!.split(',')[1] || '';
        const binaryStr = atob(base64Part);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          useSystemFonts: true,
        });
        const pdfDoc = await loadingTask.promise;
        if (cancelled || currentPage > pdfDoc.numPages) return;

        const page = await pdfDoc.getPage(currentPage);
        if (cancelled || !pdfCanvasRef.current) return;

        const viewport = page.getViewport({ scale: 1.25 });
        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any).promise;

        if (!cancelled) {
          setPdfCanvasReady(true);
        }
      } catch {
        setPdfCanvasReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [report.pdfDataUrl, currentPage]);

  // Scroll to the highlighted supporting region when page or citation changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        highlightedRegionRef.current &&
        typeof highlightedRegionRef.current.scrollIntoView === 'function'
      ) {
        highlightedRegionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [currentPage, activeCitation?.citationId]);

  const pageData =
    report.pages.find((p) => p.pageNumber === currentPage) ||
    report.pages[currentPage - 1] ||
    report.pages[0];
  const pageTables = report.tables.filter((t) => t.pageNumber === currentPage);

  // Find the chunk on this page matching the active citation (or fallback to first chunk on page)
  const citedChunk =
    (activeCitation?.chunkId
      ? report.chunks.find((c) => c.chunkId === activeCitation.chunkId)
      : undefined) || report.chunks.find((c) => c.pageNumber === currentPage);

  const pdfPageIndex =
    pageData?.pdfPageIndex ?? citedChunk?.pdfPageIndex ?? Math.max(0, currentPage - 1);
  const printedPageLabel =
    pageData?.printedPageLabel || citedChunk?.printedPageLabel || `Page ${currentPage}`;
  const sourceType =
    activeCitation?.sourceType ||
    pageData?.sourceType ||
    citedChunk?.sourceType ||
    'native_pdf_text';
  const boundingBox = activeCitation?.boundingBox || citedChunk?.boundingBox;
  const textPosition = activeCitation?.textPosition || citedChunk?.textPosition;

  // Verbatim original source text from the document (NEVER LLM-rewritten)
  const verbatimQuote =
    citedChunk?.originalText ||
    activeCitation?.originalVerbatimText ||
    activeCitation?.supportingPassage ||
    pageData?.rawText ||
    '';

  const supportingSpans =
    activeCitation?.supportingSentenceSpans && activeCitation.supportingSentenceSpans.length > 0
      ? activeCitation.supportingSentenceSpans
      : extractSupportingSentences(verbatimQuote, activeCitation?.snippet || verbatimQuote);

  // Render exact original text from pageData.rawText and highlight ONLY the supporting sentence(s)
  const renderVerbatimPageText = (rawPageText: string) => {
    const isCitedPage = !activeCitation || currentPage === activeCitation.pageNumber;
    const paragraphs = rawPageText.split(/\n\n+/);
    let highlightedAssigned = false;

    return paragraphs.map((para, idx) => {
      const trimmedPara = para.trim();
      if (!trimmedPara) return null;

      const matchingSpans = isCitedPage
        ? supportingSpans.filter((span) => span.text.length >= 10 && para.includes(span.text))
        : [];

      const isParagraphMatch =
        isCitedPage &&
        (matchingSpans.length > 0 ||
          (verbatimQuote.length >= 20 && para.includes(verbatimQuote.slice(0, 50).trim())) ||
          idx === 0);

      if (!isParagraphMatch) {
        if (trimmedPara.includes('|') && trimmedPara.split('|').length >= 4) {
          return (
            <pre
              key={idx}
              className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap"
            >
              {para}
            </pre>
          );
        }
        return (
          <p
            key={idx}
            className="mb-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line"
          >
            {para}
          </p>
        );
      }

      const targetSentence = matchingSpans[0]?.text;
      let renderedContent: React.ReactNode = para;

      if (targetSentence && para.includes(targetSentence)) {
        const splitIdx = para.indexOf(targetSentence);
        const before = para.slice(0, splitIdx);
        const matched = para.slice(splitIdx, splitIdx + targetSentence.length);
        const after = para.slice(splitIdx + targetSentence.length);

        renderedContent = (
          <>
            {before}
            <mark
              ref={(el) => {
                if (el && !highlightedAssigned) {
                  highlightedRegionRef.current = el;
                  highlightedAssigned = true;
                }
              }}
              data-testid="highlighted-evidence-region"
              className="bg-amber-200/90 dark:bg-amber-500/30 text-slate-950 dark:text-amber-100 px-1 py-0.5 rounded font-medium border-b-2 border-amber-500"
            >
              {matched}
            </mark>
            {after}
          </>
        );
      } else {
        renderedContent = (
          <mark
            ref={(el) => {
              if (el && !highlightedAssigned) {
                highlightedRegionRef.current = el;
                highlightedAssigned = true;
              }
            }}
            data-testid="highlighted-evidence-region"
            className="bg-amber-200/90 dark:bg-amber-500/30 text-slate-950 dark:text-amber-100 px-1 py-0.5 rounded font-medium"
          >
            {para}
          </mark>
        );
      }

      return (
        <div
          key={idx}
          className="mb-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 p-4 transition-colors"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Original Extracted Source Region · Page {currentPage} (PDF Index {pdfPageIndex})
            </span>
            {boundingBox && (
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                BBox [{boundingBox.x}, {boundingBox.y}, {boundingBox.width}×{boundingBox.height}]
              </span>
            )}
          </div>
          <p
            data-testid="verbatim-source-paragraph"
            className="text-sm leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-line"
          >
            {renderedContent}
          </p>
        </div>
      );
    });
  };

  const handleCopyPassage = () => {
    navigator.clipboard.writeText(
      `${verbatimQuote}\n— Original Source: ${report.title} (${report.fileName}), Page ${currentPage} [PDF Page Index: ${pdfPageIndex}]`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Source Verification Explorer"
      data-testid="source-explorer-modal"
    >
      <div className="w-full max-w-3xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Evidence Integrity Viewer (Verbatim Source)
              </span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="pdf-viewer-current-page"
                className="font-mono font-bold text-slate-900 dark:text-white tabular-nums"
              >
                Page {currentPage} of {report.pageCount}
              </span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="pdf-viewer-page-index"
                className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300"
              >
                PDF Index: {pdfPageIndex} (0-based)
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-slate-500">
                Printed: {printedPageLabel}
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate mt-1">
              {report.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyPassage}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied Verbatim' : 'Copy Verbatim Source'}
            </button>
            <button
              type="button"
              data-testid="close-evidence-modal"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close Source Explorer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Citation Switcher Bar */}
        {allCitations.length > 1 && onSelectCitation && (
          <div className="px-6 py-2 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Citations ({allCitations.length}):
            </span>
            {allCitations.map((cit, idx) => {
              const isSelected =
                activeCitation?.citationId === cit.citationId ||
                (activeCitation?.reportId === cit.reportId &&
                  activeCitation?.pageNumber === cit.pageNumber);
              return (
                <button
                  key={cit.citationId || idx}
                  type="button"
                  onClick={() => onSelectCitation(cit)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  {(cit.reportTitle || cit.documentName || 'Report').slice(0, 22)} · Page{' '}
                  {cit.pageNumber}
                </button>
              );
            })}
          </div>
        )}

        {/* Technical Provenance & Coordinate Bar */}
        <div className="px-6 py-2 bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>Doc ID: {report.reportId}</span>
            <span>Chunk ID: {citedChunk?.chunkId || activeCitation?.chunkId || 'page_root'}</span>
            {textPosition && (
              <span>
                Offsets: {textPosition.startOffset}–{textPosition.endOffset}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>
              Source Type:{' '}
              <strong className="text-slate-900 dark:text-slate-200">
                {sourceType === 'ocr_extracted'
                  ? 'OCR-Extracted'
                  : sourceType === 'extracted_table'
                  ? 'Extracted Table'
                  : 'Native PDF Text'}
              </strong>
            </span>
          </div>
        </div>

        {/* OCR Uncertainty Warning Banner */}
        {sourceType === 'ocr_extracted' && (
          <div
            role="alert"
            data-testid="ocr-warning-banner"
            className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>OCR-Extracted Evidence Notice:</strong> This passage was extracted via Optical
              Character Recognition
              {activeCitation?.ocrConfidence
                ? ` (Confidence: ${Math.round(activeCitation.ocrConfidence * 100)}%)`
                : ''}
              . Extraction quality may be uncertain; verify numerical figures directly against the
              scanned page.
            </span>
          </div>
        )}

        {/* Page Navigation Bar */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 truncate">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-medium text-slate-900 dark:text-slate-200 truncate">
              {pageData?.sectionTitle || `Page ${currentPage}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev Page
            </button>
            <select
              aria-label="Jump to PDF page"
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200"
            >
              {report.pages.map((p) => (
                <option key={p.pageNumber} value={p.pageNumber}>
                  Page {p.pageNumber} / {report.pageCount} (Idx{' '}
                  {p.pdfPageIndex ?? p.pageNumber - 1})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={currentPage >= report.pageCount}
              onClick={() => setCurrentPage((p) => Math.min(report.pageCount, p + 1))}
              className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              Next Page
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Document Page Sheet Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 dark:bg-slate-950/70">
          {/* Stored Verbatim Source Excerpt Box (Separated from AI Explanation) */}
          <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/70 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4" />
                Stored Original Quotation (No AI Rewriting · Unmodified Document Text)
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Page {currentPage} · {citedChunk?.chunkId || 'Verbatim'}
              </span>
            </div>
            <blockquote
              data-testid="exact-original-quotation"
              className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-line"
            >
              {verbatimQuote}
            </blockquote>
          </div>

          {/* Optional PDF.js Rendered Canvas when user uploaded a binary PDF */}
          {report.pdfDataUrl && (
            <div
              className={`mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-w-2xl mx-auto ${
                pdfCanvasReady ? 'block' : 'hidden'
              }`}
            >
              <div className="text-xs font-mono text-slate-500 mb-2 flex items-center justify-between">
                <span>PDF.js Rendered Page {currentPage}</span>
                <span>0-Based Page Index: {pdfPageIndex}</span>
              </div>
              <div className="relative overflow-x-auto flex justify-center">
                <canvas
                  ref={pdfCanvasRef}
                  className="max-w-full h-auto rounded border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          )}

          {/* Original PDF Page Verbatim Text & Table Sheet */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-xs max-w-2xl mx-auto">
            <div className="pb-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
              <span>{report.fileName}</span>
              <span>
                OFFICIAL PAGE {currentPage} OF {report.pageCount} (INDEX {pdfPageIndex})
              </span>
            </div>

            {pageData ? (
              renderVerbatimPageText(pageData.rawText)
            ) : (
              <p className="text-sm text-slate-500">Page content unavailable.</p>
            )}

            {/* Render Extracted Structured Tables on this Page */}
            {pageTables.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                {pageTables.map((tbl) => (
                  <div key={tbl.tableId} className="mb-6 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <TableIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {tbl.title} (Unit: {tbl.unit})
                      </h4>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                            {tbl.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 ${
                                  i > 0 ? 'text-right' : 'text-left'
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                          {tbl.rows.map((r, rIdx) => (
                            <tr
                              key={rIdx}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                            >
                              {r.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`py-2 px-3 ${
                                    cIdx === 0
                                      ? 'font-sans font-medium text-slate-900 dark:text-slate-100 text-left'
                                      : 'text-slate-600 dark:text-slate-300 text-right'
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
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>{report.agency}</span>
              <span>
                Page {currentPage} of {report.pageCount} · PDF Index {pdfPageIndex}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
