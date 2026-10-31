import React, { useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  Printer,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { Citation, ChatMessage, Report, SavedResearchItem } from '../types/report';

interface SummaryViewProps {
  report: Report | null;
  messages: ChatMessage[];
  savedResearch?: SavedResearchItem[];
  onDeleteSavedResearch?: (id: string) => void;
  onUpdateResearchNotes?: (id: string, notes: string) => void;
  onOpenPage: (pageNumber: number) => void;
  onOpenCitation?: (citation: Citation) => void;
  onGoToUpload: () => void;
  onLoadEvaluationDataset?: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  report,
  messages,
  savedResearch = [],
  onDeleteSavedResearch,
  onUpdateResearchNotes,
  onOpenPage,
  onOpenCitation,
  onGoToUpload,
  onLoadEvaluationDataset,
}) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');

  if (!report && savedResearch.length === 0 && messages.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
            <History className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Intelligent Research Workspace &amp; History
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
            Save verified answers, atomic claim audits, programmatic calculations, extracted tables,
            and custom analyst notes into exportable research dossiers.
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

  const qaPairs: { question: string; answer: ChatMessage }[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (
      messages[i].role === 'user' &&
      messages[i + 1] &&
      messages[i + 1].role === 'assistant'
    ) {
      qaPairs.push({ question: messages[i].content, answer: messages[i + 1] });
    }
  }

  const buildMarkdownReport = (): string => {
    const lines: string[] = [
      `# REPORT NAVIGATOR AI — VERIFIED RESEARCH DOSSIER`,
      `**Primary Document:** ${report?.title || 'Multi-Report Session'}`,
      `**Generated:** ${new Date().toISOString()}`,
      report
        ? `**Document Scope:** ${report.pageCount} Pages | ${report.chunks.length} Passages | ${report.tables.length} Tables`
        : '',
      ``,
    ];

    if (report) {
      lines.push(
        `## 1. Executive Summary`,
        report.summary.overview,
        ``,
        `## 2. Key Verified Findings`,
        ...report.summary.keyFindings.map((f) => `- ${f.text} *(Page ${f.pageNumber})*`),
        ``,
        `## 3. Important Statistical Benchmarks`,
        ...report.summary.importantStatistics.map(
          (s) => `- **${s.label} (${s.value})**: ${s.context} *(Page ${s.pageNumber})*`
        ),
        ``
      );
    }

    if (savedResearch.length > 0) {
      lines.push(`## 4. Saved Research Workspace (${savedResearch.length} Items)`);
      savedResearch.forEach((item, idx) => {
        lines.push(`### ${idx + 1}. Q: ${item.question}`);
        lines.push(`- **Report:** ${item.reportTitle}`);
        lines.push(`- **Answer:** ${item.answer}`);
        if (item.programmaticCalculation) {
          lines.push(
            `- **Programmatic Calculation:** ${item.programmaticCalculation.computedValue} | Formula: \`${item.programmaticCalculation.formula}\``
          );
        }
        if (item.verifiedClaims && item.verifiedClaims.length > 0) {
          lines.push(`- **Claim-Level Verification:**`);
          item.verifiedClaims.forEach((vc) => {
            lines.push(`  - [${vc.status}] ${vc.claimText}`);
          });
        }
        if (item.researchNotes) {
          lines.push(`- **Analyst Research Notes:** ${item.researchNotes}`);
        }
        if (item.citations.length > 0) {
          lines.push(
            `- **Verified Citations:** ${item.citations
              .map((c) => `${c.reportTitle || item.reportTitle} Page ${c.pageNumber}`)
              .join(', ')}`
          );
        }
        lines.push(``);
      });
    }

    if (qaPairs.length > 0) {
      lines.push(`## 5. Session Question & Answer Log (${qaPairs.length} Queries)`);
      qaPairs.forEach((pair, idx) => {
        lines.push(`### Q${idx + 1}: ${pair.question}`);
        lines.push(`${pair.answer.content}`);
        if (pair.answer.citations && pair.answer.citations.length > 0) {
          lines.push(
            `*Citations: ${pair.answer.citations
              .map((c) => `Page ${c.pageNumber} (${c.sectionTitle})`)
              .join(', ')}*`
          );
        }
        lines.push(``);
      });
    }

    return lines.filter((l) => l !== undefined).join('\n');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baseSlug = (report?.title || 'report_navigator_research')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();

  const handleExportMarkdown = () => {
    downloadFile(buildMarkdownReport(), `${baseSlug}_dossier.md`, 'text/markdown;charset=utf-8;');
  };

  const handleExportJSON = () => {
    const payload = {
      platform: 'Report Navigator AI — Evidence Integrity Dossier',
      exportedAt: new Date().toISOString(),
      activeReport: report
        ? {
            reportId: report.reportId,
            title: report.title,
            pageCount: report.pageCount,
            summary: report.summary,
          }
        : null,
      savedResearch,
      questionHistory: qaPairs.map((q) => ({
        question: q.question,
        answer: q.answer.content,
        claimVerification: q.answer.claimVerification,
        programmaticCalculation: q.answer.programmaticCalculation,
        citations: q.answer.citations,
      })),
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `${baseSlug}_dossier.json`,
      'application/json;charset=utf-8;'
    );
  };

  const handleExportDOCX = () => {
    const htmlDoc = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Research Dossier</title></head>
      <body style="font-family: Calibri, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h1>Report Navigator AI — Verified Research Dossier</h1>
        <p><strong>Primary Document:</strong> ${report?.title || 'Multi-Report Session'} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        ${
          report
            ? `<h2>1. Executive Overview</h2><p>${report.summary.overview}</p>`
            : ''
        }
        <h2>2. Saved Research Sessions (${savedResearch.length})</h2>
        ${savedResearch
          .map(
            (s, i) => `
          <div style="margin-bottom: 16px; padding: 10px; border: 1px solid #cbd5e1;">
            <h3>${i + 1}. ${s.question}</h3>
            <p>${s.answer.replace(/\n/g, '<br/>')}</p>
            ${
              s.programmaticCalculation
                ? `<p><strong>Programmatic Calculation:</strong> ${s.programmaticCalculation.computedValue} (Formula: ${s.programmaticCalculation.formula})</p>`
                : ''
            }
            ${
              s.researchNotes
                ? `<p><strong>Research Notes:</strong> ${s.researchNotes}</p>`
                : ''
            }
            <p><em>Citations: ${s.citations.map((c) => `Page ${c.pageNumber} (${c.sectionTitle})`).join('; ')}</em></p>
          </div>
        `
          )
          .join('')}
      </body>
      </html>
    `;
    downloadFile(htmlDoc, `${baseSlug}_dossier.doc`, 'application/msword;charset=utf-8;');
  };

  const handleExportPrintableHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Research Report — ${report?.title || 'Report Navigator AI'}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 32px auto; padding: 0 24px; color: #0f172a; line-height: 1.6; }
    h1 { font-size: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { font-size: 18px; margin-top: 28px; color: #1e3a8a; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #f8fafc; }
    .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Report Navigator AI — Verified Research Report</h1>
  <p><strong>Active Report:</strong> ${report?.title || 'Multi-Report Corpus'} · <strong>Date:</strong> ${new Date().toLocaleString()}</p>
  ${report ? `<h2>Executive Summary</h2><div class="card">${report.summary.overview}</div>` : ''}
  <h2>Saved Research Items (${savedResearch.length})</h2>
  ${savedResearch
    .map(
      (item) => `<div class="card">
      <div><strong>Question:</strong> ${item.question}</div>
      <p>${item.answer.replace(/\n/g, '<br/>')}</p>
      ${
        item.programmaticCalculation
          ? `<p><strong>Calculated Result:</strong> ${item.programmaticCalculation.computedValue} (<code>${item.programmaticCalculation.formula}</code>)</p>`
          : ''
      }
      ${item.researchNotes ? `<p><strong>Research Notes:</strong> ${item.researchNotes}</p>` : ''}
      <div>${item.citations.map((c) => `<span class="badge">${c.reportTitle || item.reportTitle} · Page ${c.pageNumber}</span>`).join(' ')}</div>
    </div>`
    )
    .join('')}
</body>
</html>`;
    downloadFile(htmlContent, `${baseSlug}_printable_report.html`, 'text/html;charset=utf-8;');
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(buildMarkdownReport());
    setCopiedFormat('md');
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Export Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
            <Bookmark className="w-3.5 h-3.5" />
            Phase 7 · Intelligent Research Workspace &amp; Exportable Dossier
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Research History, Saved Sessions &amp; Notes
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {savedResearch.length} saved research session{savedResearch.length === 1 ? '' : 's'} ·{' '}
            {qaPairs.length} assistant query log{qaPairs.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
          >
            {copiedFormat === 'md' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Markdown
              </>
            )}
          </button>
          <button
            onClick={handleExportPrintableHTML}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            Printable HTML/PDF
          </button>
          <button
            onClick={handleExportDOCX}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            DOCX
          </button>
          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-600" />
            Markdown
          </button>
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            <FileJson className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* SAVED RESEARCH SESSIONS WORKSPACE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Saved Research Workspace ({savedResearch.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Includes Verified Claims, Programmatic Math, Citations, Tables &amp; Analyst Notes
          </span>
        </div>

        {savedResearch.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center">
            <p className="text-sm font-medium text-slate-600">
              No saved research sessions yet. Click &ldquo;Save to Research&rdquo; on any answer in
              the AI Research Assistant to preserve verified claims, calculations, tables, and notes
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedResearch.map((item) => {
              const isEditing = editingNotesId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 text-[11px] font-semibold">
                          {item.reportTitle}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {item.savedAt}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Q: {item.question}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingNotesId(null);
                          } else {
                            setEditingNotesId(item.id);
                            setNotesDraft(item.researchNotes || '');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {item.researchNotes ? 'Edit Notes' : 'Add Research Note'}
                      </button>
                      {onDeleteSavedResearch && (
                        <button
                          onClick={() => onDeleteSavedResearch(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove from saved research"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* AI Answer */}
                  <div className="bg-white rounded-lg border border-slate-200/80 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      AI Grounded Explanation
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                      {item.answer}
                    </p>
                  </div>

                  {/* Programmatic Calculation (if attached) */}
                  {item.programmaticCalculation && (
                    <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5" />
                        Programmatic Table Calculation ({item.programmaticCalculation.unit})
                      </div>
                      <div className="text-xs font-bold text-slate-900 tabular-nums">
                        {item.programmaticCalculation.computedValue}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        Formula: {item.programmaticCalculation.formula}
                      </div>
                    </div>
                  )}

                  {/* Verified Claims Summary (if attached) */}
                  {item.verifiedClaims && item.verifiedClaims.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200/80 p-3 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Verified Atomic Claims ({item.verifiedClaims.length})
                      </div>
                      <div className="space-y-1">
                        {item.verifiedClaims.map((vc) => (
                          <div
                            key={vc.claimId}
                            className="text-xs flex items-start gap-2 text-slate-700"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                vc.status === 'SUPPORTED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : vc.status === 'CONFLICTING'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {vc.status}
                            </span>
                            <span>{vc.claimText}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Tables Referenced */}
                  {item.extractedTables && item.extractedTables.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                        Linked Tables:
                      </span>
                      {item.extractedTables.map((tbl) => (
                        <span
                          key={tbl.tableId}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
                        >
                          {tbl.title} (Page {tbl.pageNumber})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Analyst Research Notes */}
                  {isEditing ? (
                    <div className="bg-white rounded-lg border border-blue-300 p-3 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Analyst Research Notes &amp; Policy Annotations
                      </label>
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={2}
                        placeholder="Add your analytical observations, policy implications, or follow-up notes..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          className="px-3 py-1 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateResearchNotes) {
                              onUpdateResearchNotes(item.id, notesDraft.trim());
                            }
                            setEditingNotesId(null);
                          }}
                          className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : item.researchNotes ? (
                    <div className="bg-amber-50/70 rounded-lg border border-amber-200/80 p-3 text-xs text-amber-950">
                      <span className="font-bold">Analyst Note: </span>
                      {item.researchNotes}
                    </div>
                  ) : null}

                  {/* Citations */}
                  {item.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.citations.map((cit) => (
                        <button
                          key={cit.citationId}
                          onClick={() =>
                            onOpenCitation ? onOpenCitation(cit) : onOpenPage(cit.pageNumber)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          {cit.reportTitle ? `${cit.reportTitle} · ` : ''}Page {cit.pageNumber} —{' '}
                          {cit.sectionTitle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Question History Log */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            Session Question &amp; Answer History ({qaPairs.length})
          </h2>
        </div>

        {qaPairs.length === 0 ? (
          <p className="text-xs text-slate-500">
            Ask questions in the AI Research Assistant to build your session history log.
          </p>
        ) : (
          <div className="space-y-3">
            {qaPairs.map((pair, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-900">Q: {pair.question}</div>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {pair.answer.timestamp}
                  </span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {pair.answer.content}
                </p>
                {pair.answer.citations && pair.answer.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {pair.answer.citations.map((cit) => (
                      <button
                        key={cit.citationId}
                        onClick={() =>
                          onOpenCitation ? onOpenCitation(cit) : onOpenPage(cit.pageNumber)
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-blue-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Page {cit.pageNumber} ({cit.sectionTitle})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
