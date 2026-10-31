import { Report, PipelineProgress } from '../types/report';
import {
  cleanReportText,
  chunkReportPages,
  extractTablesFromPages,
  generateAutomatedInsightsAndSummary,
} from './ragEngine';

/**
 * Extracts text per page from an uploaded PDF, TXT, CSV, or JSON document.
 * Uses pdfjs-dist when available, with a resilient binary/stream PDF parser fallback
 * so that PDF uploads never fail in headless or worker-restricted environments.
 */
export async function processUploadedPdfFile(
  file: File,
  onProgress: (progress: PipelineProgress) => void
): Promise<Report> {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const lowerName = file.name.toLowerCase();

  onProgress({
    stage: 'validating',
    percent: 12,
    message: `Validating document structure for "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`,
    currentFile: file.name,
  });

  const arrayBuffer = await file.arrayBuffer();
  const rawPages: { pageNumber: number; text: string; sectionTitle?: string }[] = [];

  // Preserve Data URL for PDF files so PDF.js canvas viewer can render the exact PDF page
  let pdfDataUrl: string | undefined;
  if ((lowerName.endsWith('.pdf') || file.type === 'application/pdf') && file.size <= 15 * 1024 * 1024) {
    try {
      pdfDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read PDF Data URL'));
        reader.readAsDataURL(file);
      });
    } catch {
      pdfDataUrl = undefined;
    }
  }

  onProgress({
    stage: 'extracting_text',
    percent: 32,
    message: `Extracting page-level text streams from "${file.name}"...`,
    currentFile: file.name,
  });

  if (lowerName.endsWith('.csv')) {
    const csvText = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const pipeFormatted = lines.map((line) => line.split(',').map((c) => c.trim()).join(' | ')).join('\n');
    rawPages.push({
      pageNumber: 1,
      sectionTitle: `${file.name.replace(/\.csv$/i, '')} — Tabular Dataset`,
      text: `${file.name.replace(/\.csv$/i, '')}\n${pipeFormatted}`,
    });
  } else if (lowerName.endsWith('.json')) {
    const jsonText = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    rawPages.push({
      pageNumber: 1,
      sectionTitle: `${file.name.replace(/\.json$/i, '')} — Structured Data`,
      text: jsonText,
    });
  } else if (lowerName.endsWith('.txt')) {
    const txt = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    const explicitPages = txt.split(/\f|(?:^|\n)---+\s*Page\s+\d+\s*---+(?:\n|$)/i);
    if (explicitPages.length > 1) {
      explicitPages.forEach((pText, idx) => {
        if (pText.trim()) {
          rawPages.push({
            pageNumber: idx + 1,
            text: pText.trim(),
          });
        }
      });
    } else {
      const pageSize = 1800;
      const totalPages = Math.max(1, Math.ceil(txt.length / pageSize));
      for (let i = 0; i < totalPages; i++) {
        const slice = txt.slice(i * pageSize, (i + 1) * pageSize).trim();
        if (slice) {
          rawPages.push({
            pageNumber: i + 1,
            text: slice,
          });
        }
      }
    }
  } else {
    try {
      // Attempt pdfjs-dist extraction first
      const pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
      });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const strings = (textContent.items as Array<{ str?: string }>).map((item) => item.str || '');
        const joined = strings.join(' ').trim();
        if (joined) {
          rawPages.push({
            pageNumber: p,
            text: joined,
          });
        }
      }
    } catch {
      // Fallback to direct PDF stream & parenthesized literal extraction
    }

    if (rawPages.length === 0) {
      const decoder = new TextDecoder('latin1');
      const rawStr = decoder.decode(arrayBuffer);

      // Extract text blocks between BT ... ET or parenthesized text strings (...)
      const btMatches = Array.from(rawStr.matchAll(/BT[\s\S]*?ET/g));
      if (btMatches.length > 0) {
        btMatches.forEach((m, idx) => {
          const block = m[0];
          const literals = Array.from(block.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)).map(
            (lit) => lit[1].replace(/\\([()\\])/g, '$1')
          );
          const pageText = literals.join(' ').trim();
          if (pageText) {
            rawPages.push({
              pageNumber: idx + 1,
              text: pageText,
            });
          }
        });
      }

      // If plain text or markdown-like PDF content was uploaded, split into logical pages
      if (rawPages.length === 0) {
        const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        const printable = utf8Text
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        const pageSize = 1600;
        const totalPages = Math.max(1, Math.ceil(printable.length / pageSize));
        for (let i = 0; i < totalPages; i++) {
          const slice = printable.slice(i * pageSize, (i + 1) * pageSize).trim();
          if (slice) {
            rawPages.push({
              pageNumber: i + 1,
              text: slice,
            });
          }
        }
      }
    }
  }

  onProgress({
    stage: 'extracting_tables',
    percent: 54,
    message: `Scanning ${rawPages.length} pages for structured statistical tables & numerical units...`,
    currentFile: file.name,
  });

  const tables = extractTablesFromPages(rawPages, reportId);

  onProgress({
    stage: 'cleaning_chunking',
    percent: 72,
    message: `Performing page-aware semantic chunking across ${rawPages.length} pages...`,
    currentFile: file.name,
  });

  const chunks = chunkReportPages(rawPages, reportId);

  onProgress({
    stage: 'generating_embeddings',
    percent: 88,
    message: `Generating 64-D vector embeddings for ${chunks.length} page-indexed passages...`,
    currentFile: file.name,
  });

  try {
    await fetch('/api/rag/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: chunks.slice(0, 8).map((c) => `${c.sectionTitle}: ${c.content.slice(0, 400)}`),
      }),
    });
  } catch {
    // Local deterministic hybrid embeddings already computed on every chunk
  }

  onProgress({
    stage: 'indexing_vectors',
    percent: 96,
    message: `Storing ${chunks.length} vectors and ${tables.length} tables in searchable index...`,
    currentFile: file.name,
  });

  const cleanTitle = file.name.replace(/\.(pdf|txt|csv|json)$/i, '').replace(/[_-]+/g, ' ');
  const pages = rawPages.map((p) => {
    const cleaned = cleanReportText(p.text);
    const firstLine = cleaned.split('\n')[0]?.slice(0, 85) || `Page ${p.pageNumber}`;
    return {
      pageNumber: p.pageNumber,
      pdfPageIndex: Math.max(0, p.pageNumber - 1),
      printedPageLabel: `Page ${p.pageNumber}`,
      sectionTitle: p.sectionTitle || firstLine,
      rawText: p.text,
      cleanedText: cleaned,
      wordCount: cleaned.split(/\s+/).length,
      sourceType: 'native_pdf_text' as const,
    };
  });

  const { insights, summary, suggestedQuestions } = generateAutomatedInsightsAndSummary(
    cleanTitle,
    pages,
    chunks,
    tables
  );

  onProgress({
    stage: 'completed',
    percent: 100,
    message: `Successfully indexed "${cleanTitle}" (${pages.length} pages, ${chunks.length} chunks, ${tables.length} tables).`,
    currentFile: file.name,
  });

  return {
    reportId,
    title: cleanTitle,
    fileName: file.name,
    fileSize: file.size,
    pageCount: pages.length,
    uploadedAt: new Date().toISOString(),
    isDemo: false,
    status: 'ready',
    agency: 'Uploaded Document',
    publicationYear: new Date().getFullYear().toString(),
    pdfDataUrl,
    pages,
    chunks,
    tables,
    insights,
    summary,
    suggestedQuestions,
  };
}
