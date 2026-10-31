import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  Filter,
  HelpCircle,
  Mic,
  MicOff,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Type,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  AccessibleTextSize,
  AIControlOptions,
  AIModelMode,
  AnswerLength,
  ChatMessage,
  Citation,
  ClaimVerificationStatus,
  DocumentScope,
  InstalledModelInfo,
  LanguageMode,
  NavigationSection,
  OverallEvidenceStatus,
  Report,
  ResponseFormat,
  ResponseLanguage,
  ResponseStyle,
  SavedResearchItem,
  SourceFilterType,
} from '../types/report';
import {
  computeProgrammaticTableAnalysis,
  generateFollowUpQuestions,
  retrieveAcrossMultipleReports,
  retrieveRelevantChunks,
  synthesizeGroundedAnswer,
  verifyAnswerClaims,
  verifyNumericalAccuracy,
} from '../utils/ragEngine';

interface ChatViewProps {
  reports: Report[];
  activeReport?: Report | null;
  messages: ChatMessage[];
  languageMode: LanguageMode;
  modelMode: AIModelMode;
  onSelectReport: (reportId: string) => void;
  onChangeLanguageMode: (lang: LanguageMode) => void;
  onChangeModelMode: (model: AIModelMode) => void;
  onAddMessages: (userMsg: ChatMessage, assistantMsg: ChatMessage) => void;
  onSaveResearchItem: (item: SavedResearchItem) => void;
  onOpenCitation: (citation: Citation, allCitations?: Citation[]) => void;
  onOpenPage: (pageNumber: number) => void;
  onNavigate?: (section: NavigationSection) => void;
  onLoadEvaluationDataset?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  reports,
  activeReport,
  messages,
  languageMode,
  modelMode,
  onSelectReport,
  onChangeLanguageMode,
  onAddMessages,
  onSaveResearchItem,
  onOpenCitation,
  onOpenPage,
  onNavigate,
  onLoadEvaluationDataset,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedCitationKey, setCopiedCitationKey] = useState<string | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [keywordSearch, setKeywordSearch] = useState('');
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});
  const [expandedWhyUnsupported, setExpandedWhyUnsupported] = useState<Record<string, boolean>>({});
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceStatusNote, setVoiceStatusNote] = useState<string | null>(null);

  // Phase 9: Complete AI Control Interface State (Model, Response, Research, Accessibility)
  const [answerLength, setAnswerLength] = useState<AnswerLength>('detailed');
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(
    languageMode === 'simple' ? 'simple' : 'technical'
  );
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>(
    languageMode === 'hindi'
      ? 'hindi'
      : languageMode === 'hinglish'
      ? 'hinglish'
      : 'english'
  );
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>('paragraph');
  const [documentScope, setDocumentScope] = useState<DocumentScope>('current');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() =>
    reports.map((r) => r.reportId)
  );
  const [evidenceMode, setEvidenceMode] = useState<boolean>(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');
  const [voiceOutputAuto, setVoiceOutputAuto] = useState<boolean>(false);
  const [accessibleTextSize, setAccessibleTextSize] = useState<AccessibleTextSize>('base');
  const [installedModels, setInstalledModels] = useState<InstalledModelInfo[]>([
    {
      id: 'local-rag-verifier',
      name: 'Local Deterministic RAG Verifier (Zero-Hallucination)',
      provider: 'local-rag',
    },
    {
      id: 'llama3.2:latest',
      name: 'Llama 3.2 3B Instruct (Local Engine)',
      provider: 'local-rag',
    },
    {
      id: 'mistral:7b-instruct',
      name: 'Mistral 7B Instruct (Local Engine)',
      provider: 'local-rag',
    },
  ]);
  const [selectedModel, setSelectedModel] = useState<string>('local-rag-verifier');
  const [modelConnected, setModelConnected] = useState<boolean>(true);
  const [ollamaConnected, setOllamaConnected] = useState<boolean>(false);
  const [isCheckingModels, setIsCheckingModels] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const threadContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setSelectedDocIds((prev) => {
      const existing = prev.filter((id) => reports.some((r) => r.reportId === id));
      if (existing.length === 0 && reports.length > 0) {
        return reports.map((r) => r.reportId);
      }
      const added = reports
        .map((r) => r.reportId)
        .filter((id) => !existing.includes(id));
      return [...existing, ...added];
    });
  }, [reports]);

  const checkModelStatus = async () => {
    setIsCheckingModels(true);
    try {
      const resp = await fetch('/api/models/status');
      if (resp.ok) {
        const data = await resp.json();
        setModelConnected(Boolean(data.connected));
        setOllamaConnected(Boolean(data.ollamaConnected));
        if (Array.isArray(data.models) && data.models.length > 0) {
          setInstalledModels(data.models);
          if (!data.models.some((m: InstalledModelInfo) => m.id === selectedModel)) {
            setSelectedModel(data.models[0].id);
          }
        }
      } else {
        setModelConnected(false);
      }
    } catch {
      setModelConnected(false);
    } finally {
      setIsCheckingModels(false);
    }
  };

  useEffect(() => {
    checkModelStatus();
  }, []);

  const reportMessages = activeReport
    ? messages.filter(
        (m) => m.reportId === activeReport.reportId || m.multiDocumentScope
      )
    : messages;

  useEffect(() => {
    if (reportMessages.length === 0) return;
    const timer = window.setTimeout(() => {
      const container = threadContainerRef.current;
      if (!container) return;
      const cards = container.querySelectorAll('[data-testid="assistant-answer-card"]');
      const lastCard = cards[cards.length - 1] as HTMLElement | undefined;
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [reportMessages.length]);

  const speakText = (msg: ChatMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = msg.content.replace(/[*#_`|]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.02;
    if (msg.languageMode === 'hindi' || msg.aiOptions?.language === 'hindi') {
      utterance.lang = 'hi-IN';
    }
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakAnswer = (msg: ChatMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingMessageId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    speakText(msg);
  };

  const handleToggleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    if (isListeningVoice && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningVoice(false);
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceStatusNote('Browser SpeechRecognition API is unavailable in this environment.');
      setTimeout(() => setVoiceStatusNote(null), 3500);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = responseLanguage === 'hindi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        setVoiceStatusNote('Listening for research question...');
      };
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => {
        setIsListeningVoice(false);
        setVoiceStatusNote(null);
      };
      recognition.onend = () => {
        setIsListeningVoice(false);
        setVoiceStatusNote(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const handleCopyAnswer = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMessageId(msg.id);
    setTimeout(() => setCopiedMessageId(null), 1800);
  };

  const handleCopyFormalCitation = (cit: Citation, key: string) => {
    const formal = `${cit.reportTitle || activeReport?.title || 'Report'} (${cit.documentName || 'Official Publication'}), ${cit.printedPageLabel || `Page ${cit.pageNumber}`} [PDF Index ${cit.pdfPageIndex ?? cit.pageNumber - 1}], Section: "${cit.sectionTitle}". Verbatim Evidence: "${cit.originalVerbatimText || cit.supportingPassage}"`;
    navigator.clipboard.writeText(formal);
    setCopiedCitationKey(key);
    setTimeout(() => setCopiedCitationKey(null), 1800);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingText(null);
    setIsLoading(false);
  };

  const toggleClaimEvidenceDrawer = (key: string) => {
    setExpandedClaims((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleWhyUnsupported = (key: string) => {
    setExpandedWhyUnsupported((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelectedDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.length > 1
          ? prev.filter((id) => id !== docId)
          : prev
        : [...prev, docId]
    );
  };

  const textSizeClass =
    accessibleTextSize === 'lg'
      ? 'text-base leading-relaxed'
      : accessibleTextSize === 'sm'
      ? 'text-xs leading-relaxed'
      : 'text-sm leading-relaxed';

  // Empty State when no documents are uploaded yet
  if (!activeReport || reports.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div
          data-testid="chat-empty-state"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-indigo-950/80 text-blue-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            No Reports Uploaded Yet
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Upload one or more PDF, TXT, CSV, or JSON reports — or load the representative MoSPI
            &amp; IESA evaluation dataset — to start asking evidence-verified questions with atomic
            claim verification, programmatic table math, and exact page citations.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('upload')}
              className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              Upload Your First Report
            </button>
            {onLoadEvaluationDataset && (
              <button
                type="button"
                onClick={onLoadEvaluationDataset}
                className="px-5 py-2.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
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

  const keywordMatches =
    keywordSearch.trim().length >= 2
      ? activeReport.chunks.filter((c) =>
          `${c.sectionTitle} ${c.originalText || c.content}`
            .toLowerCase()
            .includes(keywordSearch.trim().toLowerCase())
        )
      : [];

  const handleSubmitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading || !activeReport) return;

    setInputQuery('');
    setIsLoading(true);
    setStreamingText('Retrieving & reranking page-level passages...');
    const startTime = performance.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentAiOptions: AIControlOptions = {
      answerLength,
      responseStyle,
      language: responseLanguage,
      responseFormat,
      documentScope,
      selectedDocumentIds: selectedDocIds,
      evidenceMode,
      voiceOutput: voiceOutputAuto,
      selectedModel,
      sourceFilter,
      accessibleTextSize,
    };

    const mappedLangMode: LanguageMode =
      responseLanguage === 'hindi'
        ? 'hindi'
        : responseLanguage === 'hinglish'
        ? 'hinglish'
        : responseStyle === 'simple'
        ? 'simple'
        : 'standard';

    const isMultiScope = documentScope === 'all' || documentScope === 'selected';
    const scopedReports =
      documentScope === 'all'
        ? reports
        : documentScope === 'selected'
        ? reports.filter((r) => selectedDocIds.includes(r.reportId))
        : [activeReport];
    const effectiveReports = scopedReports.length > 0 ? scopedReports : [activeReport];

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      reportId: activeReport.reportId,
      multiDocumentScope: isMultiScope,
    };

    // 1. Perform Page-Aware Hybrid Vector + Lexical Retrieval + Cross-Encoder Reranking
    const retrieval =
      effectiveReports.length > 1
        ? retrieveAcrossMultipleReports(trimmed, effectiveReports, 6, sourceFilter)
        : retrieveRelevantChunks(trimmed, effectiveReports[0], 4, 0.22, sourceFilter);

    // 1B. Run Programmatic Statistical Table Intelligence if query involves table calculations/rankings/units
    const programmaticCalc = computeProgrammaticTableAnalysis(trimmed, effectiveReports);

    let finalAnswer = '';
    let foundInReport = retrieval.isSupported || Boolean(programmaticCalc);
    const selectedModelObj = installedModels.find((m) => m.id === selectedModel);
    let modelUsedLabel = selectedModelObj ? selectedModelObj.name : selectedModel;
    let explanationNote = '';
    const processingErrors: string[] = [];

    if (!retrieval.isSupported && !programmaticCalc) {
      const fallback = synthesizeGroundedAnswer(
        trimmed,
        effectiveReports[0],
        retrieval,
        mappedLangMode,
        currentAiOptions
      );
      finalAnswer = fallback.answer;
      foundInReport = false;
      explanationNote = fallback.explanationNote;
    } else if (!retrieval.isSupported && programmaticCalc) {
      finalAnswer = programmaticCalc.explanation;
      foundInReport = true;
      explanationNote = 'Programmatically computed from extracted statistical tables.';
    } else {
      if (selectedModel === 'local-rag-verifier') {
        const synth = synthesizeGroundedAnswer(
          trimmed,
          effectiveReports[0],
          retrieval,
          mappedLangMode,
          currentAiOptions
        );
        finalAnswer = synth.answer;
        foundInReport = synth.foundInReport;
        explanationNote = synth.explanationNote;
      } else {
        try {
          const response = await fetch('/api/rag/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              question: trimmed,
              reportTitle:
                effectiveReports.length > 1
                  ? effectiveReports.map((r) => r.title).join(' & ')
                  : effectiveReports[0].title,
              retrievedChunks: retrieval.topChunks,
              tables: effectiveReports.flatMap((r) => r.tables),
              languageMode: mappedLangMode,
              modelMode,
              aiOptions: currentAiOptions,
              isSupported: true,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            finalAnswer = data.answer;
            foundInReport = Boolean(data.foundInReport);
            modelUsedLabel = data.modelUsed || modelUsedLabel;
            explanationNote = `Synthesized from ${retrieval.topChunks.length} verified passages (${answerLength}, ${responseStyle}, ${responseLanguage}, ${responseFormat}).`;
          } else {
            processingErrors.push(
              'External model endpoint returned non-200; seamlessly fell back to Local Deterministic RAG Verifier.'
            );
            const synth = synthesizeGroundedAnswer(
              trimmed,
              effectiveReports[0],
              retrieval,
              mappedLangMode,
              currentAiOptions
            );
            finalAnswer = synth.answer;
            foundInReport = synth.foundInReport;
            explanationNote = synth.explanationNote;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            return;
          }
          processingErrors.push(
            'Local/Cloud API unreachable; verified response generated via Local Deterministic RAG Verifier.'
          );
          const synth = synthesizeGroundedAnswer(
            trimmed,
            effectiveReports[0],
            retrieval,
            mappedLangMode,
            currentAiOptions
          );
          finalAnswer = synth.answer;
          foundInReport = synth.foundInReport;
          explanationNote = synth.explanationNote;
        }
      }
    }

    // 3. Run Claim-Level Verification Engine over the answer
    const claimVerification = verifyAnswerClaims(
      finalAnswer,
      trimmed,
      effectiveReports[0],
      retrieval,
      effectiveReports
    );

    const numVerification = verifyNumericalAccuracy(
      finalAnswer,
      retrieval.topChunks,
      effectiveReports.flatMap((r) => r.tables)
    );

    const followUps = generateFollowUpQuestions(effectiveReports[0], retrieval);

    const missingWarnings: string[] = [];
    if (retrieval.unmatchedEntities.length > 0 && !retrieval.isSupported) {
      missingWarnings.push(
        `Unmatched terms not present in source corpus: ${retrieval.unmatchedEntities.join(', ')}`
      );
    }
    if (programmaticCalc?.limitationWarning) {
      missingWarnings.push(programmaticCalc.limitationWarning);
    }
    if (claimVerification.unsupportedCount > 0) {
      missingWarnings.push(
        `${claimVerification.unsupportedCount} atomic claim(s) lacked direct supporting evidence and received 0 citations.`
      );
    }

    const combinedCitations = foundInReport
      ? retrieval.citations.length > 0
        ? retrieval.citations
        : programmaticCalc?.citations || []
      : [];

    const assistantMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      role: 'assistant',
      content: finalAnswer,
      timestamp: new Date().toISOString(),
      reportId: activeReport.reportId,
      foundInReport,
      citations: combinedCitations,
      claimVerification,
      programmaticCalculation: programmaticCalc || undefined,
      followUpQuestions: foundInReport ? followUps : [],
      languageMode: mappedLangMode,
      aiOptions: currentAiOptions,
      modelUsed: modelUsedLabel,
      thinkingMode: modelMode === 'deep_thinking',
      latencyMs: Math.round(performance.now() - startTime),
      numericalCheckPassed: numVerification.passed,
      explanationNote,
      multiDocumentScope: isMultiScope,
      documentsSearchedCount: effectiveReports.length,
      sourcesRetrievedCount: combinedCitations.length,
      missingEvidenceWarnings: missingWarnings,
      processingErrors,
    };

    setStreamingText(null);
    onAddMessages(userMsg, assistantMsg);
    setIsLoading(false);

    if (voiceOutputAuto) {
      speakText(assistantMsg);
    }
  };

  const handleRegenerateLast = () => {
    const lastUserMsg = [...reportMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSubmitQuestion(lastUserMsg.content);
    }
  };

  const renderOverallStatusBanner = (status: OverallEvidenceStatus, summaryLabel: string) => {
    const styles: Record<
      OverallEvidenceStatus,
      { bg: string; text: string; badgeBg: string; label: string; icon: React.ReactNode }
    > = {
      FULLY_SUPPORTED: {
        bg: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80',
        text: 'text-emerald-900 dark:text-emerald-200',
        badgeBg: 'bg-emerald-600 text-white',
        label: 'SUPPORTED',
        icon: <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      },
      PARTIALLY_SUPPORTED: {
        bg: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80',
        text: 'text-amber-900 dark:text-amber-200',
        badgeBg: 'bg-amber-600 text-white',
        label: 'PARTIALLY SUPPORTED',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      },
      INSUFFICIENT_EVIDENCE: {
        bg: 'bg-red-50/90 dark:bg-red-950/40 border-red-200 dark:border-red-800/80',
        text: 'text-red-900 dark:text-red-200',
        badgeBg: 'bg-red-600 text-white',
        label: 'UNSUPPORTED',
        icon: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />,
      },
      CONFLICTING_EVIDENCE: {
        bg: 'bg-slate-100 dark:bg-slate-900 border-amber-400 dark:border-amber-600',
        text: 'text-slate-900 dark:text-slate-100',
        badgeBg: 'bg-amber-700 text-white',
        label: 'CONFLICTING',
        icon: <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      },
    };

    const st = styles[status];

    return (
      <div
        data-testid="overall-evidence-status"
        data-status={status}
        className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${st.bg}`}
      >
        <div className="flex items-center gap-2 text-xs">
          {st.icon}
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${st.badgeBg}`}>
            {st.label}
          </span>
          <span className={`font-medium ${st.text}`}>{summaryLabel}</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Evidence Integrity Engine
        </span>
      </div>
    );
  };

  const renderClaimStatusBadge = (status: ClaimVerificationStatus) => {
    switch (status) {
      case 'SUPPORTED':
        return (
          <span
            data-testid="claim-status-badge"
            className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
          >
            SUPPORTED
          </span>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <span
            data-testid="claim-status-badge"
            className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
          >
            PARTIALLY SUPPORTED
          </span>
        );
      case 'UNSUPPORTED':
        return (
          <span
            data-testid="claim-status-badge"
            className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800"
          >
            UNSUPPORTED
          </span>
        );
      case 'CONFLICTING':
        return (
          <span
            data-testid="claim-status-badge"
            className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-400 dark:border-amber-700"
          >
            CONFLICTING
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 Columns: Conversational RAG Interface */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col min-h-[calc(100vh-7.5rem)]">
        {/* PHASE 9: Advanced AI Control Interface Organized into 4 Groups (Model, Response, Research, Accessibility) */}
        <div
          data-testid="ai-control-interface"
          className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-950/30 rounded-t-xl"
        >
          {/* GROUP 1 (MODEL) & GROUP 3 (RESEARCH SCOPE) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400" />
                <label
                  htmlFor="ai-model-select"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Model:
                </label>
                <select
                  id="ai-model-select"
                  data-testid="control-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-xs font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 max-w-[230px]"
                >
                  {installedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.size ? `(${m.size})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div
                data-testid="control-model-status"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 border ${
                  modelConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    modelConnected ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <span>{modelConnected ? 'Connected' : 'Disconnected'}</span>
                {ollamaConnected && <span className="text-[10px] font-mono">(Ollama)</span>}
                <button
                  type="button"
                  onClick={checkModelStatus}
                  title="Refresh Model Connection Status"
                  className="ml-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingModels ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Research Scope */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Scope:</span>
              <div
                data-testid="control-document-scope"
                className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg"
              >
                {(
                  [
                    { id: 'current', label: 'Current document' },
                    { id: 'selected', label: 'Selected documents' },
                    { id: 'all', label: `All documents (${reports.length})` },
                  ] as const
                ).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setDocumentScope(sc.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      documentScope === sc.id
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-indigo-400 shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Document Selector or Multi-Select Checkboxes */}
          {documentScope === 'current' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="active-report-select"
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0"
                >
                  Current Document:
                </label>
                <select
                  id="active-report-select"
                  value={activeReport.reportId}
                  onChange={(e) => onSelectReport(e.target.value)}
                  className="text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 truncate max-w-md"
                >
                  {reports.map((r) => (
                    <option key={r.reportId} value={r.reportId}>
                      {r.title} ({r.pageCount} pages)
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter Control */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-medium text-slate-500">Source Filter:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as SourceFilterType)}
                  className="text-xs font-medium bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700"
                >
                  <option value="all">All Sources (Text + Tables + OCR)</option>
                  <option value="native_pdf_text">Native PDF Text Only</option>
                  <option value="extracted_table">Extracted Tables Only</option>
                  <option value="ocr_extracted">Scanned OCR Pages Only</option>
                </select>
              </div>
            </div>
          )}

          {documentScope === 'selected' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium text-slate-500">Select reports to query:</span>
              {reports.map((r) => {
                const checked = selectedDocIds.includes(r.reportId);
                return (
                  <label
                    key={r.reportId}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer flex items-center gap-1.5 ${
                      checked
                        ? 'bg-blue-50 dark:bg-indigo-950/60 border-blue-300 dark:border-indigo-700 text-blue-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelectedDoc(r.reportId)}
                      className="accent-blue-600"
                    />
                    <span className="truncate max-w-[180px]">{r.title}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* GROUP 2 (RESPONSE): Answer Length, Style, Language, Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500">Length:</span>
              <div className="flex items-center gap-1" data-testid="control-answer-length">
                {(['short', 'detailed'] as const).map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setAnswerLength(len)}
                    className={`px-2 py-0.5 text-xs font-medium rounded capitalize transition-colors cursor-pointer ${
                      answerLength === len
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500">Style:</span>
              <div className="flex items-center gap-1" data-testid="control-response-style">
                {(['simple', 'technical'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setResponseStyle(st)}
                    className={`px-2 py-0.5 text-xs font-medium rounded capitalize transition-colors cursor-pointer ${
                      responseStyle === st
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500">Language:</span>
              <div className="flex items-center gap-1" data-testid="control-language">
                {(
                  [
                    { id: 'english', label: 'English' },
                    { id: 'hindi', label: 'Hindi' },
                    { id: 'hinglish', label: 'Hinglish' },
                  ] as const
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      setResponseLanguage(lang.id);
                      onChangeLanguageMode(
                        lang.id === 'hindi'
                          ? 'hindi'
                          : lang.id === 'hinglish'
                          ? 'hinglish'
                          : responseStyle === 'simple'
                          ? 'simple'
                          : 'standard'
                      );
                    }}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      responseLanguage === lang.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500">Format:</span>
              <div className="flex items-center gap-1" data-testid="control-response-format">
                {(['paragraph', 'bullets', 'table'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setResponseFormat(fmt)}
                    className={`px-2 py-0.5 text-xs font-medium rounded capitalize transition-colors cursor-pointer ${
                      responseFormat === fmt
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* GROUP 4 (ACCESSIBILITY & EVIDENCE MODE): Evidence Mode, Read Aloud, Accessible Text Sizing */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                data-testid="control-evidence-mode"
                className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Evidence Mode:
                </span>
                <button
                  type="button"
                  onClick={() => setEvidenceMode(true)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer ${
                    evidenceMode
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceMode(false)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer ${
                    !evidenceMode
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Off
                </button>
              </div>

              <button
                type="button"
                data-testid="control-voice-output"
                onClick={() => {
                  const next = !voiceOutputAuto;
                  setVoiceOutputAuto(next);
                  if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    setSpeakingMessageId(null);
                  }
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  voiceOutputAuto
                    ? 'bg-blue-50 dark:bg-indigo-950/60 border-blue-300 dark:border-indigo-700 text-blue-700 dark:text-indigo-300 font-semibold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {voiceOutputAuto ? (
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>Read Aloud: {voiceOutputAuto ? 'On' : 'Off'}</span>
              </button>

              {/* Accessible Text Size Control */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <Type className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-medium text-slate-500">Text:</span>
                {(
                  [
                    { id: 'sm', label: 'A-' },
                    { id: 'base', label: 'A' },
                    { id: 'lg', label: 'A+' },
                  ] as const
                ).map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setAccessibleTextSize(sz.id)}
                    className={`px-1.5 py-0.5 text-[11px] font-bold rounded cursor-pointer ${
                      accessibleTextSize === sz.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {activeReport.pageCount} pages · {activeReport.chunks.length} vectors indexed
            </span>
          </div>
        </div>

        {/* Document-Derived Follow-Up Question Suggestions Bar */}
        {activeReport.suggestedQuestions.length > 0 && (
          <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
              Document-Grounded Questions for &ldquo;{activeReport.title}&rdquo;:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeReport.suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSubmitQuestion(q)}
                  className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-indigo-950/70 hover:text-blue-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-800 rounded-md transition-colors text-left cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages Thread */}
        <div ref={threadContainerRef} className="flex-1 overflow-y-auto p-5 space-y-6">
          {reportMessages.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Ask any question about &ldquo;{activeReport.title}&rdquo;
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Every factual claim is verified against the extracted pages and tables. If the
                information is not in the uploaded reports, the assistant will state:{' '}
                <span className="font-mono">
                  &ldquo;Insufficient evidence found in the uploaded reports.&rdquo;
                </span>
              </p>
            </div>
          ) : (
            reportMessages.map((msg, msgIdx) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div
                      className={`max-w-xl bg-slate-900 dark:bg-indigo-600 text-white rounded-xl px-4 py-3 ${textSizeClass}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const isNotFound = msg.foundInReport === false;
              const isSaved = savedMessageIds.has(msg.id);
              const prevUserQuestion =
                reportMessages
                  .slice(0, msgIdx)
                  .reverse()
                  .find((m) => m.role === 'user')?.content || 'Report Query';

              const verification =
                msg.claimVerification ||
                verifyAnswerClaims(
                  msg.content,
                  prevUserQuestion,
                  activeReport,
                  {
                    isSupported: !isNotFound,
                    citations: msg.citations || [],
                    topChunks: activeReport.chunks,
                    highestScore: 0.9,
                    unmatchedEntities: [],
                  },
                  msg.multiDocumentScope ? reports : [activeReport]
                );

              const allMessageCitations =
                msg.citations && msg.citations.length > 0
                  ? msg.citations
                  : verification.claims.flatMap((c) => c.citations);

              const docsSearched =
                msg.documentsSearchedCount ??
                (msg.multiDocumentScope ? reports.length : 1);
              const sourcesRetrieved =
                msg.sourcesRetrievedCount ?? allMessageCitations.length;

              return (
                <div
                  key={msg.id}
                  className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                  data-testid="assistant-answer-card"
                >
                  {/* 1. EVIDENCE STATUS SUMMARY BANNER AT TOP OF ANSWER */}
                  {evidenceMode &&
                    renderOverallStatusBanner(
                      verification.overallStatus,
                      verification.summaryLabel
                    )}

                  {/* PHASE 8: Transparent AI Telemetry Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {msg.modelUsed || 'Local Deterministic RAG Verifier'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                        Model Online
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums font-medium">
                        {docsSearched} doc{docsSearched === 1 ? '' : 's'} searched
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums font-medium">
                        {sourcesRetrieved} source{sourcesRetrieved === 1 ? '' : 's'} retrieved
                      </span>
                      {msg.latencyMs !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{msg.latencyMs}ms</span>
                        </>
                      )}
                    </div>

                    {/* Action Toolbar: Copy, Listen, Save Research, Regenerate */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyAnswer(msg)}
                        className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                        aria-label="Copy Answer"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpeakAnswer(msg)}
                        className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {speakingMessageId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-red-500" />
                            Stop Voice
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            Read Aloud
                          </>
                        )}
                      </button>

                      {!isNotFound && (
                        <button
                          type="button"
                          onClick={() => {
                            const linkedTables = activeReport.tables.filter((t) =>
                              allMessageCitations.some((c) => c.pageNumber === t.pageNumber)
                            );
                            onSaveResearchItem({
                              id: `sav_${Date.now()}`,
                              question: prevUserQuestion,
                              answer: msg.content,
                              reportId: activeReport.reportId,
                              reportTitle: activeReport.title,
                              citations: allMessageCitations,
                              verifiedClaims: verification.claims,
                              programmaticCalculation: msg.programmaticCalculation,
                              extractedTables: linkedTables,
                              savedAt: new Date().toISOString(),
                            });
                            setSavedMessageIds((prev) => new Set(prev).add(msg.id));
                          }}
                          className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleRegenerateLast}
                        disabled={isLoading}
                        className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                        aria-label="Regenerate Answer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Regenerate
                      </button>
                    </div>
                  </div>

                  {/* ZONE 1: AI-GENERATED EXPLANATION */}
                  {isNotFound ? (
                    <div className="p-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p
                          className="text-sm font-semibold text-slate-900 dark:text-white"
                          data-testid="not-found-message"
                        >
                          Insufficient evidence found in the uploaded reports.
                        </p>
                        {msg.explanationNote && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            {msg.explanationNote}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-indigo-400">
                        1. AI-Generated Grounded Explanation
                      </div>
                      <div
                        className={`text-slate-800 dark:text-slate-100 whitespace-pre-line ${textSizeClass}`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  )}

                  {/* ZONE 2: PROGRAMMATICALLY CALCULATED RESULTS (Phase 4 & 8) */}
                  {msg.programmaticCalculation && (
                    <div
                      data-testid="programmatic-calculation-panel"
                      className={`p-4 rounded-xl border space-y-2 ${
                        msg.programmaticCalculation.calculationType === 'unit_limitation'
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-blue-50/50 border-blue-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5" />
                          2. Programmatically Calculated Result (Deterministic Table Engine)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                          Unit: {msg.programmaticCalculation.unit}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {msg.programmaticCalculation.computedValue}
                      </div>
                      <div className="text-xs font-mono text-slate-700 bg-white p-2 rounded border border-slate-200/80 overflow-x-auto">
                        Formula: {msg.programmaticCalculation.formula}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {msg.programmaticCalculation.explanation}
                      </p>
                    </div>
                  )}

                  {/* Quick Citation Pills */}
                  {!isNotFound && allMessageCitations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Verified Page Citations:
                      </span>
                      {allMessageCitations.map((cit, cIdx) => (
                        <button
                          key={cit.citationId || cIdx}
                          type="button"
                          onClick={() => onOpenCitation(cit, allMessageCitations)}
                          className="px-2.5 py-1 text-xs font-mono font-semibold bg-blue-50 dark:bg-indigo-950/80 text-blue-700 dark:text-indigo-300 hover:bg-blue-100 border border-blue-200 dark:border-indigo-800 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>
                            {cit.reportTitle ? `${cit.reportTitle.slice(0, 18)} · ` : ''}Page{' '}
                            {cit.pageNumber}
                          </span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ZONE 3: ORIGINAL SOURCE EVIDENCE & INTERACTIVE EVIDENCE INSPECTOR (Phase 3) */}
                  {evidenceMode && !isNotFound && verification.claims.length > 0 && (
                    <div
                      data-testid="claim-verification-list"
                      className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          3. Claim-Level Verification &amp; Interactive Evidence Inspector (
                          {verification.claims.length}{' '}
                          {verification.claims.length === 1 ? 'Claim' : 'Claims'} Audited)
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Click any claim or &ldquo;Evidence Inspector&rdquo; to inspect verbatim
                          source &amp; tables
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {verification.claims.map((claim) => {
                          const drawerKey = `${msg.id}_${claim.claimId}`;
                          const isDrawerOpen = Boolean(expandedClaims[drawerKey]);
                          const isWhyOpen = Boolean(expandedWhyUnsupported[drawerKey]);
                          const primaryCit = claim.citations[0];

                          // Find relevant table on the cited page if any
                          const targetRep =
                            reports.find((r) => r.reportId === primaryCit?.reportId) ||
                            activeReport;
                          const pageTable = primaryCit
                            ? targetRep.tables.find((t) => t.pageNumber === primaryCit.pageNumber)
                            : undefined;

                          const borderClass =
                            claim.status === 'SUPPORTED'
                              ? 'border-emerald-200 dark:border-emerald-900/70 bg-white dark:bg-slate-900'
                              : claim.status === 'PARTIALLY_SUPPORTED'
                              ? 'border-amber-200 dark:border-amber-900/70 bg-white dark:bg-slate-900'
                              : claim.status === 'CONFLICTING'
                              ? 'border-amber-400 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20'
                              : 'border-red-200 dark:border-red-900/70 bg-red-50/30 dark:bg-red-950/20';

                          return (
                            <div
                              key={claim.claimId}
                              data-testid={`claim-card-${claim.claimIndex}`}
                              data-claim-status={claim.status}
                              className={`p-4 rounded-xl border ${borderClass} space-y-2.5`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                    CLAIM {claim.claimIndex}
                                  </span>
                                  {renderClaimStatusBadge(claim.status)}
                                  {primaryCit && claim.status !== 'UNSUPPORTED' && (
                                    <span className="text-xs text-slate-600 dark:text-slate-300">
                                      Source:{' '}
                                      <strong className="text-slate-900 dark:text-white">
                                        {primaryCit.reportTitle || activeReport.title}
                                      </strong>{' '}
                                      ·{' '}
                                      <strong className="font-mono text-blue-600 dark:text-indigo-400">
                                        Page {primaryCit.pageNumber}
                                      </strong>
                                    </span>
                                  )}
                                </div>

                                {/* Action Buttons per Claim */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {claim.status !== 'UNSUPPORTED' && primaryCit && (
                                    <>
                                      <button
                                        type="button"
                                        data-testid={`view-evidence-claim-${claim.claimIndex}`}
                                        onClick={() =>
                                          onOpenCitation(primaryCit, allMessageCitations)
                                        }
                                        className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                      >
                                        Open Source (Page {primaryCit.pageNumber})
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopyFormalCitation(primaryCit, drawerKey)
                                        }
                                        className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md flex items-center gap-1 cursor-pointer"
                                      >
                                        {copiedCitationKey === drawerKey ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            Copied Citation
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            Copy Citation
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleClaimEvidenceDrawer(drawerKey)}
                                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-md flex items-center gap-1 cursor-pointer"
                                      >
                                        {isDrawerOpen ? (
                                          <>
                                            Hide Evidence Inspector{' '}
                                            <ChevronUp className="w-3.5 h-3.5" />
                                          </>
                                        ) : (
                                          <>
                                            Evidence Inspector{' '}
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}

                                  {claim.status === 'UNSUPPORTED' && (
                                    <button
                                      type="button"
                                      data-testid={`why-unsupported-claim-${claim.claimIndex}`}
                                      onClick={() => toggleWhyUnsupported(drawerKey)}
                                      className="px-2.5 py-1 text-xs font-semibold bg-red-100 dark:bg-red-950/80 hover:bg-red-200 text-red-800 dark:text-red-200 rounded-md flex items-center gap-1 cursor-pointer"
                                    >
                                      <HelpCircle className="w-3.5 h-3.5" />
                                      Why is this unsupported?
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Claim Statement Text */}
                              <p
                                onClick={() =>
                                  primaryCit && toggleClaimEvidenceDrawer(drawerKey)
                                }
                                className={`text-slate-900 dark:text-slate-100 font-medium ${textSizeClass} ${
                                  primaryCit ? 'cursor-pointer' : ''
                                }`}
                              >
                                {claim.claimText}
                              </p>

                              {/* Unsupported Notice (No Fake Citation) */}
                              {claim.status === 'UNSUPPORTED' && (
                                <div className="text-xs text-red-700 dark:text-red-300 font-medium">
                                  No reliable supporting passage was found in the uploaded
                                  documents. (0 citations attached)
                                </div>
                              )}

                              {/* Expandable "Why is this unsupported?" Diagnostic */}
                              {claim.status === 'UNSUPPORTED' && isWhyOpen && (
                                <div
                                  data-testid={`unsupported-reason-${claim.claimIndex}`}
                                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-900 dark:text-red-200 space-y-1"
                                >
                                  <div className="font-semibold">
                                    Verification Failure Analysis:
                                  </div>
                                  <p>{claim.unsupportedReason}</p>
                                </div>
                              )}

                              {/* Conflicting Sources Side-by-Side Disclosure */}
                              {claim.status === 'CONFLICTING' && claim.conflictDetails && (
                                <div
                                  data-testid="conflicting-sources-panel"
                                  className="p-3 rounded-lg bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-800 space-y-2"
                                >
                                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    Discrepancy Detected Across Uploaded Sources:
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {claim.conflictDetails.sources.map((src, sIdx) => {
                                      const matchingCit =
                                        claim.citations.find(
                                          (c) =>
                                            c.reportId === src.reportId &&
                                            c.pageNumber === src.pageNumber
                                        ) || claim.citations[sIdx];
                                      return (
                                        <div
                                          key={sIdx}
                                          className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-1.5"
                                        >
                                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                                            <span className="truncate">{src.reportTitle}</span>
                                            <span className="font-mono text-blue-600 dark:text-indigo-400 shrink-0">
                                              Page {src.pageNumber}
                                            </span>
                                          </div>
                                          <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                                            Reported Value: {src.reportedValue}
                                          </div>
                                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 font-mono">
                                            &ldquo;{src.verbatimExcerpt}&rdquo;
                                          </p>
                                          {matchingCit && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onOpenCitation(matchingCit, claim.citations)
                                              }
                                              className="text-[11px] font-semibold text-blue-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              Inspect Source Page {src.pageNumber} →
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* INTERACTIVE EVIDENCE INSPECTOR (Phase 3) */}
                              {isDrawerOpen && primaryCit && (
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                                    <span className="flex items-center gap-1 font-semibold">
                                      <FileCheck2 className="w-3.5 h-3.5" />
                                      Evidence Inspector · {primaryCit.reportTitle || activeReport.title}{' '}
                                      · Page {primaryCit.pageNumber} (0-based PDF Index{' '}
                                      {primaryCit.pdfPageIndex ?? primaryCit.pageNumber - 1})
                                    </span>
                                    <span>Chunk: {primaryCit.chunkId}</span>
                                  </div>

                                  {/* Highlighted Sentence Spans */}
                                  {primaryCit.supportingSentenceSpans &&
                                    primaryCit.supportingSentenceSpans.length > 0 && (
                                      <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-200 text-xs text-slate-900">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                                          Highlighted Supporting Sentence(s)
                                        </div>
                                        {primaryCit.supportingSentenceSpans.map((sp, spIdx) => (
                                          <p key={spIdx} className="font-medium leading-relaxed">
                                            &ldquo;{sp.text}&rdquo;
                                          </p>
                                        ))}
                                      </div>
                                    )}

                                  {/* Full Original Verbatim Paragraph */}
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                      Original Supporting Paragraph (Unmodified)
                                    </div>
                                    <blockquote className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed bg-white p-2.5 rounded border border-slate-200/80">
                                      {primaryCit.originalVerbatimText ||
                                        primaryCit.supportingPassage}
                                    </blockquote>
                                  </div>

                                  {/* Relevant Extracted Table on Same Page (if present) */}
                                  {pageTable && (
                                    <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        Relevant Table on Page {primaryCit.pageNumber}:{' '}
                                        {pageTable.title} (Unit: {pageTable.unit})
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[11px]">
                                          <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                              {pageTable.headers.map((h, hIdx) => (
                                                <th
                                                  key={hIdx}
                                                  className="py-1.5 px-2 font-bold text-slate-600"
                                                >
                                                  {h}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {pageTable.rows.slice(0, 4).map((r, rIdx) => (
                                              <tr key={rIdx}>
                                                {r.map((c, cIdx) => (
                                                  <td
                                                    key={cIdx}
                                                    className="py-1 px-2 text-slate-700 tabular-nums"
                                                  >
                                                    {c}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ZONE 4: UNVERIFIED INFORMATION & LIMITATIONS DISCLOSURE (Phase 8) */}
                  {((msg.missingEvidenceWarnings && msg.missingEvidenceWarnings.length > 0) ||
                    (msg.processingErrors && msg.processingErrors.length > 0)) && (
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        4. Transparent Limitations &amp; Verification Warnings
                      </div>
                      <ul className="list-disc list-inside text-xs text-amber-950 space-y-1">
                        {msg.missingEvidenceWarnings?.map((w, i) => (
                          <li key={`warn_${i}`}>{w}</li>
                        ))}
                        {msg.processingErrors?.map((err, i) => (
                          <li key={`err_${i}`}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contextual Follow-Up Question Suggestions */}
                  {!isNotFound &&
                    msg.followUpQuestions &&
                    msg.followUpQuestions.length > 0 && (
                      <div
                        data-testid="follow-up-suggestions"
                        className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70"
                      >
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                          Follow-Up Question Suggestions:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.followUpQuestions.map((fq, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleSubmitQuestion(fq)}
                              className="px-2.5 py-1 text-xs text-blue-700 dark:text-indigo-300 bg-blue-50/70 dark:bg-indigo-950/50 hover:bg-blue-100 dark:hover:bg-indigo-900/70 rounded-md transition-colors text-left cursor-pointer"
                            >
                              {fq} →
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              );
            })
          )}

          {/* Streaming / Loading Indicator with Stop Generation */}
          {isLoading && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-blue-600 dark:text-indigo-400">
                  RAG Engine Active:
                </span>{' '}
                {streamingText || 'Synthesizing page-verified answer...'}
              </div>
              <button
                type="button"
                onClick={handleStopGeneration}
                className="px-3 py-1 text-xs font-semibold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-md flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Square className="w-3 h-3" />
                Stop Generation
              </button>
            </div>
          )}
        </div>

        {/* Voice Status Note */}
        {voiceStatusNote && (
          <div className="px-4 py-1.5 bg-blue-50 border-t border-blue-200 text-xs text-blue-800 font-medium">
            {voiceStatusNote}
          </div>
        )}

        {/* Bottom Question Input Form with Voice Input Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitQuestion(inputQuery);
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2.5"
        >
          <button
            type="button"
            onClick={handleToggleVoiceInput}
            title="Voice Input (Speak your question)"
            className={`p-2.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isListeningVoice
                ? 'bg-red-50 border-red-300 text-red-600'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <label htmlFor="rag-chat-input" className="sr-only">
            Ask a question about the report
          </label>
          <input
            id="rag-chat-input"
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              documentScope === 'all'
                ? `Ask across all ${reports.length} uploaded reports...`
                : documentScope === 'selected'
                ? `Ask across ${selectedDocIds.length} selected report(s)...`
                : `Ask a question about "${activeReport.title}"...`
            }
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Verifying...' : 'Ask Report'}
          </button>
        </form>
      </div>

      {/* Right 4 Columns: Document Keyword Search & Quick Page Index */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Document Keyword Search
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
            Search exact terms or figures across all {activeReport.pageCount} pages.
          </p>
          <label htmlFor="doc-keyword-search" className="sr-only">
            Search keywords in report
          </label>
          <input
            id="doc-keyword-search"
            type="search"
            value={keywordSearch}
            onChange={(e) => setKeywordSearch(e.target.value)}
            placeholder="Search terms, numbers, or page sections..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
          />

          {keywordSearch.trim().length >= 2 && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                {keywordMatches.length} matching passage(s) found
              </div>
              {keywordMatches.map((chunk) => (
                <button
                  key={chunk.chunkId}
                  type="button"
                  onClick={() => onOpenPage(chunk.pageNumber)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-indigo-400">
                    <span className="truncate">{chunk.sectionTitle}</span>
                    <span className="font-mono shrink-0 ml-2">Page {chunk.pageNumber}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1">
                    {chunk.originalText || chunk.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Page Directory & Direct Source Verification Launcher */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Source Pages ({activeReport.pageCount})
            </h3>
            <span className="text-xs text-slate-500">Click to inspect verbatim</span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activeReport.pages.map((p) => (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => onOpenPage(p.pageNumber)}
                className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-indigo-500 transition-colors flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {p.sectionTitle}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {p.rawText.slice(0, 90)}...
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-blue-600 dark:text-indigo-400 font-semibold shrink-0">
                  P.{p.pageNumber}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
