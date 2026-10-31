import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  FileSearch,
  FileSpreadsheet,
  Globe2,
  Layers,
  Moon,
  SearchCheck,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { ThemeMode } from '../types/report';
import { KnowledgeAtlas3D } from './KnowledgeAtlas3D';

interface PublicHomePageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenDashboard: () => void;
}

export const PublicHomePage: React.FC<PublicHomePageProps> = ({
  theme,
  onToggleTheme,
  onOpenDashboard,
}) => {
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      data-testid="public-homepage"
    >
      {/* 1. Navigation Bar with Report Navigator AI Logo, Section Links, Sign In & Get Started */}
      <header
        className="sticky top-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6"
        data-testid="public-navbar"
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('hero');
            }}
            className="flex items-center gap-3 text-left shrink-0"
            data-testid="public-logo"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Shield className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block leading-none">
                Report Navigator AI
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                Evidence-Grounded Document Intelligence
              </span>
            </div>
          </a>

          {/* Center Navigation Links */}
          <nav
            aria-label="Homepage sections"
            className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            <button
              type="button"
              onClick={() => scrollToSection('introduction')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              Introduction
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('rotational-3d-model')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              3D Knowledge Model
            </button>
          </nav>

          {/* Right Actions: Theme Toggle & Open Dashboard */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenDashboard}
              data-testid="nav-get-started-btn"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section
          id="hero"
          data-testid="public-hero-section"
          className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900"
        >
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Don&apos;t just get answers. Get the evidence.</span>
              </div>

              <h1
                className="text-4xl sm:text-5xl lg:text-[3.2rem] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]"
                style={{ textWrap: 'balance' }}
              >
                Turn hundreds of pages of complex reports into verified, understandable, actionable intelligence.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Report Navigator AI combines an Evidence Intelligence Engine, Claim-Level Verification,
                Programmatic Statistical Table Math, Multi-Report Contradiction Detection, and Interactive
                Source Inspection—built for government reports, policy compendiums, and institutional filings.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  data-testid="hero-get-started-btn"
                  className="px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Open Research Dashboard</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('rotational-3d-model')}
                  className="px-4 py-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Explore 3D Knowledge Core</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Architectural Verification Highlights */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Exact Page Citations
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Direct jump to cited PDF page &amp; bounding box
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Zero Hallucinations
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Strict refusal when evidence is absent
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Table &amp; Metric Precision
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Preserves fiscal years, units &amp; figures
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Evidence Integrity Architecture Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">
                      Evidence Integrity Engine
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    100% Source-Grounded
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                    <p className="text-[11px] font-mono text-indigo-400">
                      1. Hybrid Retrieval Pipeline
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      Combines 64-dimensional semantic vector embeddings with lexical BM25 keyword
                      scoring and cross-encoder reranking across every uploaded PDF page.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                    <p className="text-[11px] font-mono text-emerald-400">
                      2. Verbatim Passage &amp; Numerical Verification
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      Every generated statistic, percentage, and date is cross-checked against the
                      original unmodified source text before presentation.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                    <p className="text-[11px] font-mono text-amber-400">
                      3. Strict Unanswerable Guardrail
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      If an uploaded report does not contain supporting evidence, the assistant
                      explicitly states:{' '}
                      <span className="font-mono text-white">
                        &quot;Insufficient evidence found in the uploaded reports.&quot;
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Project Introduction Section */}
        <section
          id="introduction"
          data-testid="public-intro-section"
          className="max-w-7xl mx-auto px-6 py-16 space-y-10"
        >
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Project Introduction
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Designed for High-Stakes Research &amp; Policy Verification
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Government statistical compendiums, economic surveys, and institutional filings often
              span hundreds of pages filled with dense tables and technical terminology. Report
              Navigator AI bridges the gap between raw archival PDFs and verifiable decision-making.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                The Challenge with Traditional Document Search
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Standard keyword search misses conceptual relationships, while generic AI assistants
                frequently hallucinate statistics or cite incorrect page numbers. Researchers spend
                hours manually scrolling through PDFs to verify whether a single number is accurate.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                The Report Navigator AI Solution
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Our platform indexes every page, paragraph, and table with exact character offsets
                and bounding boxes. Every answer links directly to the exact PDF page and highlights
                the verbatim supporting sentences so you can audit evidence in one click.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Features Section */}
        <section
          id="features"
          data-testid="public-features-section"
          className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-16"
        >
          <div className="max-w-7xl mx-auto px-6 space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Platform Capabilities
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Everything You Need for Verifiable Document Research
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Built from the ground up for precision retrieval, transparent source citations, and
                structured data extraction.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Exact PDF Page Navigation',
                  desc: 'Click any citation to open the uploaded document at the exact cited page with bounding-box region highlighting and verbatim passage inspection.',
                  icon: FileSearch,
                },
                {
                  title: 'Claim-Level Verification Engine',
                  desc: 'Every sentence and numerical figure in an AI response is verified against extracted source chunks to prevent unsupported claims.',
                  icon: ShieldCheck,
                },
                {
                  title: 'Hybrid Semantic + BM25 RAG',
                  desc: 'Combines dense semantic embeddings with exact keyword and number matching, followed by a cross-encoder reranking stage.',
                  icon: Cpu,
                },
                {
                  title: 'Structured Table Analyzer',
                  desc: 'Automatically detects and extracts statistical tables from reports while preserving units, column headers, and multi-year time series.',
                  icon: FileSpreadsheet,
                },
                {
                  title: 'Plain-Language & Multilingual Q&A',
                  desc: 'Translate complex macroeconomic or technical passages into clear English, Hindi, or Hinglish without losing citation accuracy.',
                  icon: Globe2,
                },
                {
                  title: 'Executive Briefs & Export Center',
                  desc: 'Bookmark verified answers and export structured research briefs with complete page citations in PDF, DOCX, or Markdown formats.',
                  icon: BookOpen,
                },
              ].map((feature) => {
                const IconComponent = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <IconComponent className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. How It Works Section */}
        <section
          id="how-it-works"
          data-testid="public-how-it-works-section"
          className="max-w-7xl mx-auto px-6 py-16 space-y-10"
        >
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Workflow
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How Report Navigator AI Works
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Four deterministic steps from raw multi-hundred-page PDF upload to verified, cited
              answers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                title: 'Upload Official Reports',
                desc: 'Upload PDF reports, statistical compendiums, CSV tables, or structured JSON datasets into your private workspace.',
                icon: BookOpen,
              },
              {
                step: '02',
                title: 'Page & Table Indexing',
                desc: 'Each page is parsed with 1-based page numbers, character positions, bounding boxes, and vector embeddings.',
                icon: Layers,
              },
              {
                step: '03',
                title: 'Ask Questions Naturally',
                desc: 'Ask specific statistical or policy questions in plain English, Hindi, or Hinglish across single or multiple reports.',
                icon: SearchCheck,
              },
              {
                step: '04',
                title: 'Audit Verbatim Evidence',
                desc: 'Inspect the exact cited page, highlighted source sentences, and confidence score—or export findings into executive reports.',
                icon: ShieldCheck,
              },
            ].map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        STEP {item.step}
                      </span>
                      <IconComponent className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Rotational 3D Model Section */}
        <section
          id="rotational-3d-model"
          data-testid="public-3d-model-section"
          className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-16"
        >
          <div className="max-w-7xl mx-auto px-6 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Interactive Spatial Visualization
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Rotational 3D Knowledge &amp; Citation Atlas
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Interact with our real-time 3D document codex and orbital page nodes. Drag to
                  rotate in 360° or zoom to inspect how multi-page reports are spatially indexed into
                  verifiable citation layers.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Open Dashboard to Map Your Reports</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="w-full">
              <KnowledgeAtlas3D isEmbeddedPreview={true} />
            </div>
          </div>
        </section>
      </main>

      {/* 7. Professional Footer */}
      <footer
        data-testid="public-footer"
        className="bg-slate-900 text-slate-300 border-t border-slate-800 py-12 px-6"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Shield className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="font-bold text-base text-white tracking-tight">
                  Report Navigator AI
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                AI-powered document research assistant using Retrieval-Augmented Generation (RAG)
                for verifiable answers, exact page citations, and structured table analysis.
              </p>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-xs">
              <p className="font-semibold text-white uppercase tracking-wider">Platform Sections</p>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('introduction')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Project Introduction
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('features')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Features &amp; Capabilities
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('rotational-3d-model')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Rotational 3D Model
                  </button>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-3 text-xs">
              <p className="font-semibold text-white uppercase tracking-wider">Workspace Access</p>
              <p className="text-slate-400 leading-relaxed">
                Access your document library, AI assistant, and research history directly.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  data-testid="footer-get-started-btn"
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  Open Dashboard
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Report Navigator AI. All rights reserved.</p>
            <p>Evidence Integrity Engine · Zero-Hallucination Retrieval Architecture</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
