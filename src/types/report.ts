export type LanguageMode = 'standard' | 'simple' | 'hinglish' | 'hindi';

export type AnswerLength = 'short' | 'detailed';
export type ResponseStyle = 'simple' | 'technical';
export type ResponseLanguage = 'english' | 'hindi' | 'hinglish';
export type ResponseFormat = 'paragraph' | 'bullets' | 'table';
export type DocumentScope = 'current' | 'selected' | 'all';
export type AccessibleTextSize = 'sm' | 'base' | 'lg';
export type SourceFilterType = 'all' | 'native_pdf_text' | 'extracted_table' | 'ocr_extracted';

export interface AIControlOptions {
  answerLength: AnswerLength;
  responseStyle: ResponseStyle;
  language: ResponseLanguage;
  responseFormat: ResponseFormat;
  documentScope: DocumentScope;
  selectedDocumentIds: string[];
  evidenceMode: boolean;
  voiceOutput: boolean;
  selectedModel: string;
  sourceFilter?: SourceFilterType;
  textSize?: AccessibleTextSize;
  accessibleTextSize?: AccessibleTextSize;
}

export interface InstalledModelInfo {
  id: string;
  name: string;
  provider: 'ollama' | 'local-rag' | 'cloud';
  size?: string;
}

export interface ModelConnectionStatus {
  connected: boolean;
  ollamaConnected: boolean;
  activeProvider: string;
  models: InstalledModelInfo[];
  checkedAt: string;
}

export type AIModelMode = 'fast' | 'balanced' | 'deep_thinking';

export type ThemeMode = 'light' | 'dark';

export type NavigationSection =
  | 'home'
  | 'auth'
  | 'dashboard'
  | 'explore'
  | 'upload'
  | 'chat'
  | 'compare'
  | 'atlas3d'
  | 'insights'
  | 'tables'
  | 'summary'
  | 'finetune'
  | 'settings';

export type DocumentCategory =
  | 'Demographics & Census'
  | 'Macroeconomics & Fiscal'
  | 'Energy & Climate'
  | 'Custom Research';

export type EvidenceSourceType = 'native_pdf_text' | 'extracted_table' | 'ocr_extracted';

export interface TextPositionSpan {
  startOffset: number;
  endOffset: number;
}

export interface PdfBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}

export interface SupportingSentenceSpan {
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ReportPage {
  pageNumber: number; // 1-based displayed page number
  pdfPageIndex: number; // 0-based internal PDF page index
  printedPageLabel?: string; // e.g. "Page 7" or "vii"
  sectionTitle: string;
  rawText: string; // Exact original extracted text (never modified)
  cleanedText: string;
  wordCount: number;
  sourceType?: EvidenceSourceType;
  ocrConfidence?: number;
  ocrWarning?: string;
}

export interface ReportChunk {
  chunkId: string;
  reportId: string;
  pageNumber: number; // 1-based displayed page number
  pdfPageIndex: number; // 0-based internal PDF page index
  printedPageLabel?: string;
  sectionTitle: string;
  content: string;
  originalText: string; // Verbatim unmodified source text from document
  textPosition: TextPositionSpan;
  boundingBox: PdfBoundingBox;
  sourceType: EvidenceSourceType;
  ocrConfidence?: number;
  ocrWarning?: string;
  tokenEstimate: number;
  embedding: number[];
  keywords: string[];
  numbersAndYears: string[];
}

export interface ExtractedTable {
  tableId: string;
  reportId: string;
  pageNumber: number;
  pdfPageIndex?: number;
  title: string;
  unit: string;
  yearsCovered: string[];
  headers: string[];
  rows: string[][];
  footnote?: string;
}

export interface Citation {
  citationId: string;
  reportId: string;
  reportTitle?: string;
  documentName?: string;
  chunkId?: string;
  pageNumber: number; // 1-based displayed page number
  pdfPageIndex?: number; // 0-based actual PDF page index
  printedPageLabel?: string;
  sectionTitle: string;
  supportingPassage?: string; // Verbatim original passage
  originalVerbatimText?: string; // Guaranteed unmodified original text from ReportChunk
  supportingSentenceSpans?: SupportingSentenceSpan[];
  textPosition?: TextPositionSpan;
  boundingBox?: PdfBoundingBox;
  sourceType?: EvidenceSourceType;
  ocrConfidence?: number;
  ocrWarning?: string;
  snippet?: string;
  relevanceScore?: number;
  confidenceScore?: number;
  rerankScore?: number;
  evidenceCoverage?: 'High Evidence Coverage' | 'Moderate Evidence Coverage' | 'Low Evidence Coverage';
  matchedTerms?: string[];
}

export type ClaimVerificationStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'UNSUPPORTED'
  | 'CONFLICTING';

export type OverallEvidenceStatus =
  | 'FULLY_SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE';

export interface VerifiedClaim {
  claimId: string;
  claimIndex: number;
  claimText: string;
  status: ClaimVerificationStatus;
  citations: Citation[]; // Empty array when UNSUPPORTED
  supportingVerbatimQuote?: string;
  unsupportedReason?: string;
  conflictDetails?: {
    metricLabel: string;
    sources: Array<{
      reportId: string;
      reportTitle: string;
      pageNumber: number;
      reportedValue: string;
      verbatimExcerpt: string;
    }>;
  };
  numericalValidation: {
    hasNumbers: boolean;
    claimNumbers: string[];
    verifiedNumbers: string[];
    unverifiedNumbers: string[];
    unitMatched: boolean;
    yearMatched: boolean;
    directionMatched: boolean;
  };
}

export interface ClaimVerificationReport {
  overallStatus: OverallEvidenceStatus;
  summaryLabel: string;
  claims: VerifiedClaim[];
  supportedCount: number;
  partiallySupportedCount: number;
  unsupportedCount: number;
  conflictingCount: number;
}

export interface CitationNavigationValidation {
  valid: boolean;
  reportId: string;
  pageNumber: number;
  pdfPageIndex: number;
  chunkId?: string;
  reason?: string;
}

export interface ReportInsightItem {
  id: string;
  category: 'statistic' | 'finding' | 'trend' | 'comparison' | 'observation';
  title: string;
  detail: string;
  metricValue?: string;
  pageNumber: number;
  chunkId: string;
  supportingPassage: string;
}

export interface StructuredReportSummary {
  overview: string;
  mainObjectives: { text: string; pageNumber: number }[];
  keyFindings: { text: string; pageNumber: number }[];
  importantStatistics: { label: string; value: string; context: string; pageNumber: number }[];
  conclusions: { text: string; pageNumber: number }[];
}

export interface Report {
  reportId: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  uploadedAt: string;
  isDemo: boolean;
  status: 'processing' | 'ready' | 'archived';
  agency: string;
  publicationYear: string;
  category?: DocumentCategory;
  collectionName?: string;
  pdfDataUrl?: string;
  pages: ReportPage[];
  chunks: ReportChunk[];
  tables: ExtractedTable[];
  insights: ReportInsightItem[];
  summary: StructuredReportSummary;
  suggestedQuestions: string[];
}

export interface ProgrammaticCalculationResult {
  calculationType:
    | 'max_value'
    | 'min_value'
    | 'percentage_change'
    | 'net_difference'
    | 'largest_decline'
    | 'largest_increase'
    | 'state_comparison'
    | 'unit_limitation';
  question: string;
  formula: string;
  computedValue: string;
  unit: string;
  explanation: string;
  limitationWarning?: string;
  sourceValues: Array<{
    label: string;
    rawValue: string;
    numericValue: number;
    unit: string;
    reportTitle: string;
    pageNumber: number;
    tableTitle?: string;
  }>;
  citations: Citation[];
}

export interface CrossReportComparisonItem {
  id: string;
  topic: string;
  category:
    | 'contradiction'
    | 'methodology_difference'
    | 'trend_evolution'
    | 'common_finding'
    | 'missing_in_one';
  discrepancyCause?:
    | 'reporting_period'
    | 'units'
    | 'definitions'
    | 'methodology'
    | 'none';
  discrepancyExplanation?: string;
  analysisSummary: string;
  records: Array<{
    reportId: string;
    reportTitle: string;
    pageNumber: number;
    reportedValue: string;
    unit: string;
    yearOrPeriod: string;
    verbatimExcerpt: string;
    citation: Citation;
  }>;
}

export interface EvaluationTestCaseResult {
  id: string;
  category: string;
  question: string;
  expectedBehavior: string;
  actualOutcome: string;
  passed: boolean;
  retrievalRelevant: boolean;
  citationCorrect: boolean;
  claimVerificationAccurate: boolean;
  numericalAccuracy: boolean;
  unsupportedRefusalCorrect: boolean;
  latencyMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  reportId: string;
  foundInReport?: boolean;
  citations?: Citation[];
  claimVerification?: ClaimVerificationReport;
  programmaticCalculation?: ProgrammaticCalculationResult | null;
  documentsSearchedCount?: number;
  sourcesRetrievedCount?: number;
  missingEvidenceWarnings?: string[];
  processingErrors?: string[];
  followUpQuestions?: string[];
  languageMode?: LanguageMode;
  aiOptions?: Partial<AIControlOptions>;
  modelUsed?: string;
  thinkingMode?: boolean;
  latencyMs?: number;
  numericalCheckPassed?: boolean;
  explanationNote?: string;
  multiDocumentScope?: boolean;
}

export interface SavedResearchItem {
  id: string;
  question: string;
  answer: string;
  reportId: string;
  reportTitle: string;
  citations: Citation[];
  verifiedClaims?: VerifiedClaim[];
  programmaticCalculation?: ProgrammaticCalculationResult | null;
  extractedTables?: ExtractedTable[];
  researchNotes?: string;
  savedAt: string;
  collectionTag?: string;
}

export interface AppUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  emailVerified?: boolean;
  authProviderLabel?: string;
}

export interface PipelineProgress {
  stage:
    | 'idle'
    | 'validating'
    | 'extracting_text'
    | 'extracting_tables'
    | 'ocr_scanning'
    | 'cleaning_chunking'
    | 'generating_embeddings'
    | 'indexing_vectors'
    | 'completed'
    | 'error';
  percent: number;
  message: string;
  currentFile?: string;
}

export interface ImageAnalysisResult {
  id: string;
  fileName: string;
  imageUrl: string;
  analyzedAt: string;
  modelUsed: string;
  extractedTitle: string;
  extractedText: string;
  keyStatistics: { label: string; value: string }[];
  plainExplanation: string;
}
