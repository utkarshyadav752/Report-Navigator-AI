import React from 'react';
import { ExternalLink, Lock, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { AIModelMode, LanguageMode, ThemeMode } from '../types/report';

interface SettingsViewProps {
  theme: ThemeMode;
  languageMode: LanguageMode;
  modelMode: AIModelMode;
  uploadedCount: number;
  onToggleTheme: (theme: ThemeMode) => void;
  onChangeLanguage: (lang: LanguageMode) => void;
  onChangeModel: (model: AIModelMode) => void;
  onClearHistory: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  languageMode,
  modelMode,
  uploadedCount,
  onToggleTheme,
  onChangeLanguage,
  onChangeModel,
  onClearHistory,
}) => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6" data-testid="settings-view">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Settings, Language &amp; Workspace Configuration
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Configure appearance, multilingual explanation modes, RAG reasoning models, and workspace data management.
        </p>
      </div>

      {/* 1. Theme & Language Preferences */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Interface Theme
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Switch between high-contrast daylight mode and deep navy dark mode.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleTheme('light')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light Mode
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme('dark')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark Mode
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Multilingual Explanation Mode
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose Standard English, Simple Everyday English, Hinglish, or Hindi (हिंदी) while keeping citations exact.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'standard', label: 'Standard English' },
                { id: 'simple', label: 'Simple English' },
                { id: 'hinglish', label: 'Hinglish Mode' },
                { id: 'hindi', label: 'हिंदी (Hindi)' },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onChangeLanguage(l.id)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  languageMode === l.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Default RAG Model Configuration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select between low-latency Flash Lite, balanced 3.8 Flash, or High-Thinking 4 Argon.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'fast', label: 'gemini-3.1-flash-lite (Fast)' },
                { id: 'balanced', label: 'gemini-3.8-flash (Balanced)' },
                { id: 'deep_thinking', label: 'gemini-4-argon (High Thinking)' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeModel(m.id)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  modelMode === m.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Workspace Data & API Documentation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              REST API &amp; Swagger OpenAPI Documentation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect and test all Report Navigator AI backend endpoints via Swagger UI (/api-docs) and OpenAPI 3.0 JSON (/api/openapi.json).
            </p>
          </div>

          <a
            href="/api-docs"
            data-testid="open-swagger-docs-link"
            className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Swagger UI
          </a>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Clear Uploaded Document &amp; Chat History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Removes {uploadedCount} uploaded document(s), saved bookmarks, and resets conversation history to a clean empty workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClearHistory}
            data-testid="clear-history-btn"
            className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Document History
          </button>
        </div>
      </div>

      {/* 3. Cybersecurity, File Validation & Zero-Hallucination Architecture */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Security, File Validation &amp; Zero-Hallucination Safeguards</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          All uploaded PDF, TXT, CSV, JSON, and image documents undergo strict MIME-type and file-size validation (max 50MB) and are parsed locally in your browser via PDF.js. Every AI response passes through our PaperQA + haiku.rag + OpenRAG hybrid reranker and numerical fact-checker; unsupported queries strictly return &quot;Insufficient evidence found in the uploaded reports.&quot;
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <Lock className="w-3.5 h-3.5 text-indigo-500" />
          <span>API credentials are isolated server-side; zero secrets are exposed in client bundles.</span>
        </div>
      </div>
    </div>
  );
};
