/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Moon, Shield, Sun } from 'lucide-react';
import {
  AIModelMode,
  ChatMessage,
  Citation,
  LanguageMode,
  NavigationSection,
  Report,
  SavedResearchItem,
  ThemeMode,
} from './types/report';
import { validateCitationNavigation } from './utils/ragEngine';
import {
  resolveInitialSection,
  resolveNavigationTarget,
} from './utils/authHelpers';
import {
  deleteReportFromFirestore,
  saveQuestionToFirestore,
  saveReportToFirestore,
  syncWorkspacePreferences,
} from './firebase';
import { DashboardView } from './components/DashboardView';
import { UploadView } from './components/UploadView';
import { DocumentExplorerView } from './components/DocumentExplorerView';
import { ChatView } from './components/ChatView';
import { KnowledgeAtlas3D } from './components/KnowledgeAtlas3D';
import { InsightsView } from './components/InsightsView';
import { CompareReportsView } from './components/CompareReportsView';
import { TableAnalyzerView } from './components/TableAnalyzerView';
import { SummaryView } from './components/SummaryView';
import { SettingsView } from './components/SettingsView';
import { FineTuningLabView } from './components/FineTuningLabView';
import { SourceExplorerModal } from './components/SourceExplorerModal';
import { PublicHomePage } from './components/PublicHomePage';
import { DEMO_REPORTS } from './utils/demoReports';

declare global {
  interface Window {
    __RN_NAVIGATE__?: (section: NavigationSection) => void;
    __RN_LOAD_EVAL_DATASET__?: () => void;
  }
}

export default function App() {
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReportId, setActiveReportId] = useState<string>('');
  const [activeSection, setActiveSection] = useState<NavigationSection>(() =>
    resolveInitialSection()
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedResearch, setSavedResearch] = useState<SavedResearchItem[]>([]);
  const [languageMode, setLanguageMode] = useState<LanguageMode>('standard');
  const [modelMode, setModelMode] = useState<AIModelMode>('balanced');
  const [theme, setTheme] = useState<ThemeMode>('light');

  // Source Explorer Modal State
  const [sourceModalState, setSourceModalState] = useState<{
    isOpen: boolean;
    pageNumber: number;
    citation?: Citation | null;
    allCitations?: Citation[];
  }>({
    isOpen: false,
    pageNumber: 1,
    citation: null,
    allCitations: [],
  });

  const activeReport: Report | null =
    reports.find((r) => r.reportId === activeReportId) || reports[0] || null;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleLoadEvaluationDataset = () => {
    setReports(DEMO_REPORTS);
    if (DEMO_REPORTS[0]) {
      setActiveReportId(DEMO_REPORTS[0].reportId);
    }
  };

  const handleNavigate = (targetSection: NavigationSection) => {
    const resolved = resolveNavigationTarget(targetSection);
    setActiveSection(resolved);
  };

  useEffect(() => {
    window.__RN_NAVIGATE__ = (section: NavigationSection) => {
      setActiveSection(resolveNavigationTarget(section));
    };
    window.__RN_LOAD_EVAL_DATASET__ = () => {
      setReports(DEMO_REPORTS);
      if (DEMO_REPORTS[0]) {
        setActiveReportId(DEMO_REPORTS[0].reportId);
      }
    };
    return () => {
      delete window.__RN_NAVIGATE__;
      delete window.__RN_LOAD_EVAL_DATASET__;
    };
  }, []);

  const handleToggleTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    syncWorkspacePreferences(languageMode, nextTheme).catch(() => {});
  };

  const handleChangeLanguage = (nextLang: LanguageMode) => {
    setLanguageMode(nextLang);
    syncWorkspacePreferences(nextLang, theme).catch(() => {});
  };

  const handleReportProcessed = (newReport: Report) => {
    setReports((prev) => [newReport, ...prev]);
    setActiveReportId(newReport.reportId);
    saveReportToFirestore(newReport).catch(() => {});
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((prev) => {
      const remaining = prev.filter((r) => r.reportId !== reportId);
      if (activeReportId === reportId) {
        setActiveReportId(remaining[0]?.reportId || '');
      }
      return remaining;
    });
    deleteReportFromFirestore(reportId).catch(() => {});
  };

  const handleAssignCollection = (reportId: string, collectionName: string) => {
    setReports((prev) =>
      prev.map((r) => (r.reportId === reportId ? { ...r, collectionName } : r))
    );
  };

  const handleAddMessages = (userMsg: ChatMessage, assistantMsg: ChatMessage) => {
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    if (activeReport) {
      saveQuestionToFirestore(activeReport.reportId, userMsg.content, assistantMsg).catch(
        () => {}
      );
    }
  };

  const handleSaveResearchItem = (item: SavedResearchItem) => {
    setSavedResearch((prev) => [item, ...prev]);
  };

  const handleUpdateResearchNotes = (id: string, researchNotes: string) => {
    setSavedResearch((prev) =>
      prev.map((item) => (item.id === id ? { ...item, researchNotes } : item))
    );
  };

  const handleOpenCitation = (citation: Citation, allCitations: Citation[] = []) => {
    const validation = validateCitationNavigation(citation, reports);
    if (!validation.valid) {
      return;
    }
    setActiveReportId(citation.reportId);
    setSourceModalState({
      isOpen: true,
      pageNumber: citation.pageNumber,
      citation,
      allCitations: allCitations.length > 0 ? allCitations : [citation],
    });
  };

  const handleOpenPage = (pageNumber: number) => {
    if (!activeReport) return;
    if (pageNumber < 1 || pageNumber > activeReport.pageCount) return;
    setSourceModalState({
      isOpen: true,
      pageNumber,
      citation: null,
      allCitations: [],
    });
  };

  const handleClearHistory = () => {
    setReports([]);
    setActiveReportId('');
    setMessages([]);
    setSavedResearch([]);
  };

  if (activeSection === 'home') {
    return (
      <PublicHomePage
        theme={theme}
        onToggleTheme={() => handleToggleTheme(theme === 'light' ? 'dark' : 'light')}
        onOpenDashboard={() => handleNavigate('dashboard')}
      />
    );
  }

  const totalQuestionsAnswered = messages.filter((m) => m.role === 'assistant').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sticky Navigation Bar — Direct Workspace Access */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark + Shield Logo */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Shield className="w-4 h-4" />
          </span>
          <span>Report Navigator AI</span>
        </a>

        {/* Zone 2: Primary Navigation */}
        <nav
          aria-label="Primary Navigation"
          data-testid="workspace-navbar"
          className="flex items-center gap-3.5 overflow-x-auto text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'explore', label: 'My Documents' },
              { id: 'chat', label: 'AI Research Assistant' },
              { id: 'insights', label: 'Report Analysis' },
              { id: 'compare', label: 'Compare Reports' },
              { id: 'tables', label: 'Tables & Data' },
              { id: 'summary', label: 'Research History' },
              { id: 'finetune', label: 'Fine-Tuning Lab' },
              { id: 'settings', label: 'Settings' },
              { id: 'home', label: 'Overview' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-item-${item.id}`}
              onClick={() => setActiveSection(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeSection === item.id ||
                (item.id === 'explore' && activeSection === 'upload')
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Theme Toggle & Primary Upload CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => handleToggleTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('upload')}
            data-testid="header-upload-btn"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
          >
            + Upload PDF
          </button>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1">
        {activeSection === 'dashboard' && (
          <DashboardView
            reports={reports}
            activeReport={activeReport}
            recentMessages={messages}
            savedResearch={savedResearch}
            totalQuestionsAnswered={totalQuestionsAnswered}
            onSelectReport={(id) => setActiveReportId(id)}
            onNavigate={(sec) => setActiveSection(sec)}
            onOpenSourcePage={handleOpenPage}
            onLoadEvaluationDataset={handleLoadEvaluationDataset}
          />
        )}

        {activeSection === 'explore' && (
          <DocumentExplorerView
            reports={reports}
            activeReport={activeReport}
            onSelectReport={(id) => setActiveReportId(id)}
            onNavigate={(sec) => setActiveSection(sec)}
            onOpenPage={handleOpenPage}
            onDeleteReport={handleDeleteReport}
            onAssignCollection={handleAssignCollection}
          />
        )}

        {activeSection === 'upload' && (
          <UploadView
            reports={reports}
            onReportProcessed={handleReportProcessed}
            onSelectReport={(id) => setActiveReportId(id)}
            onNavigate={(sec) => setActiveSection(sec)}
          />
        )}

        {activeSection === 'chat' && (
          <ChatView
            reports={reports}
            activeReport={activeReport}
            messages={messages}
            languageMode={languageMode}
            modelMode={modelMode}
            onSelectReport={(id) => setActiveReportId(id)}
            onChangeLanguageMode={handleChangeLanguage}
            onChangeModelMode={setModelMode}
            onAddMessages={handleAddMessages}
            onOpenCitation={handleOpenCitation}
            onOpenPage={handleOpenPage}
            onSaveResearchItem={handleSaveResearchItem}
            onNavigate={(sec) => setActiveSection(sec)}
          />
        )}

        {activeSection === 'atlas3d' && (
          <KnowledgeAtlas3D
            report={activeReport}
            onSelectPage={handleOpenPage}
            isEmbeddedPreview={false}
          />
        )}

        {activeSection === 'insights' && (
          <InsightsView
            report={activeReport}
            allReports={reports}
            onOpenPage={handleOpenPage}
            onAskInsightQuestion={() => setActiveSection('chat')}
            onGoToUpload={() => setActiveSection('upload')}
            onLoadEvaluationDataset={handleLoadEvaluationDataset}
          />
        )}

        {activeSection === 'compare' && (
          <CompareReportsView
            reports={reports}
            onOpenCitation={handleOpenCitation}
            onNavigate={(sec) => setActiveSection(sec)}
            onAskCrossReportQuestion={() => setActiveSection('chat')}
            onLoadEvaluationDataset={handleLoadEvaluationDataset}
          />
        )}

        {activeSection === 'tables' && (
          <TableAnalyzerView
            report={activeReport}
            allReports={reports}
            onOpenPage={handleOpenPage}
            onAskTableQuestion={() => setActiveSection('chat')}
            onGoToUpload={() => setActiveSection('upload')}
            onLoadEvaluationDataset={handleLoadEvaluationDataset}
          />
        )}

        {activeSection === 'summary' && (
          <SummaryView
            report={activeReport}
            messages={messages}
            savedResearch={savedResearch}
            onDeleteSavedResearch={(id) =>
              setSavedResearch((prev) => prev.filter((item) => item.id !== id))
            }
            onUpdateResearchNotes={handleUpdateResearchNotes}
            onOpenPage={handleOpenPage}
            onOpenCitation={handleOpenCitation}
            onGoToUpload={() => setActiveSection('upload')}
            onLoadEvaluationDataset={handleLoadEvaluationDataset}
          />
        )}

        {activeSection === 'finetune' && (
          <FineTuningLabView
            reports={reports}
            activeReport={activeReport}
            onReportProcessed={handleReportProcessed}
            onSelectReport={(id) => setActiveReportId(id)}
            onNavigate={(sec) => setActiveSection(sec)}
            onOpenPage={handleOpenPage}
            onLoadEvaluationDataset={handleLoadEvaluationDataset}
          />
        )}

        {activeSection === 'settings' && (
          <SettingsView
            theme={theme}
            languageMode={languageMode}
            modelMode={modelMode}
            uploadedCount={reports.length}
            onToggleTheme={handleToggleTheme}
            onChangeLanguage={handleChangeLanguage}
            onChangeModel={setModelMode}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Source Verification Explorer Slide-Over Modal */}
      {sourceModalState.isOpen && activeReport && (
        <SourceExplorerModal
          report={activeReport}
          reports={reports}
          initialPageNumber={sourceModalState.pageNumber}
          activeCitation={sourceModalState.citation}
          allCitations={sourceModalState.allCitations}
          onSelectCitation={(cit) =>
            handleOpenCitation(cit, sourceModalState.allCitations || [])
          }
          onClose={() =>
            setSourceModalState((prev) => ({
              ...prev,
              isOpen: false,
            }))
          }
        />
      )}
    </div>
  );
}
