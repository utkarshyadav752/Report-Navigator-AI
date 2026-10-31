import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ChatMessage, LanguageMode, Report, ThemeMode } from './types/report';
import { getDefaultWorkspaceProfile } from './utils/authHelpers';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Clear any legacy local auth keys from prior builds
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('rn_registered_users_v1');
    window.localStorage.removeItem('rn_active_session_v1');
  }
} catch {
  // Ignore storage restrictions
}

// Validate Firestore connection on boot per firebase-integration-rpc skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  workspaceId: string;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const profile = getDefaultWorkspaceProfile();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    workspaceId: profile.uid,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return ID_REGEX.test(cleaned) && cleaned.length >= 1 ? cleaned : `id_${Date.now()}`;
}

const WORKSPACE_PREFS_KEY = 'rn_workspace_prefs_v1';
const WORKSPACE_REPORTS_KEY = 'rn_workspace_reports_v1';
const WORKSPACE_QUESTIONS_KEY = 'rn_workspace_questions_v1';

export async function syncWorkspacePreferences(
  languagePreference: LanguageMode,
  themePreference: ThemeMode
): Promise<void> {
  const profile = getDefaultWorkspaceProfile();
  const allowedLangs: LanguageMode[] = ['standard', 'simple', 'hinglish', 'hindi'];
  const safeLang: LanguageMode = allowedLangs.includes(languagePreference)
    ? languagePreference
    : 'standard';
  const safeTheme: ThemeMode = themePreference === 'dark' ? 'dark' : 'light';

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        WORKSPACE_PREFS_KEY,
        JSON.stringify({
          uid: profile.uid,
          displayName: profile.displayName,
          languagePreference: safeLang,
          themePreference: safeTheme,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  } catch {
    // Ignore local storage quota errors
  }
}

export async function saveReportToFirestore(report: Report): Promise<void> {
  const profile = getDefaultWorkspaceProfile();
  const reportId = sanitizeId(report.reportId);
  const ownerId = sanitizeId(profile.uid);
  const safeTitle = (report.title?.trim() || 'Untitled Report').slice(0, 240);
  const safeFileName = (report.fileName?.trim() || 'document.pdf').slice(0, 240);
  const safePageCount = Number.isFinite(report.pageCount)
    ? Math.max(1, Math.min(10000, Math.trunc(report.pageCount)))
    : 1;
  const safeChunkCount = Array.isArray(report.chunks)
    ? Math.max(0, Math.min(50000, Math.trunc(report.chunks.length)))
    : 0;
  const safeTableCount = Array.isArray(report.tables)
    ? Math.max(0, Math.min(5000, Math.trunc(report.tables.length)))
    : 0;
  const safeFileSize = Number.isFinite(report.fileSize)
    ? Math.max(0, Math.min(500000000, Math.trunc(report.fileSize)))
    : 0;
  const safeSummaryOverview = (report.summary?.overview || '').slice(0, 10000);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(WORKSPACE_REPORTS_KEY);
      const list: Array<Record<string, unknown>> = existingRaw ? JSON.parse(existingRaw) : [];
      const filtered = list.filter((item) => item.reportId !== reportId);
      filtered.unshift({
        reportId,
        ownerId,
        title: safeTitle,
        fileName: safeFileName,
        pageCount: safePageCount,
        chunkCount: safeChunkCount,
        tableCount: safeTableCount,
        fileSize: safeFileSize,
        status: 'ready',
        summaryOverview: safeSummaryOverview,
        updatedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(WORKSPACE_REPORTS_KEY, JSON.stringify(filtered.slice(0, 50)));
    }
  } catch {
    // Ignore storage quota limits
  }
}

export async function saveQuestionToFirestore(
  reportIdRaw: string,
  questionText: string,
  assistantMsg: ChatMessage
): Promise<void> {
  const profile = getDefaultWorkspaceProfile();
  const reportId = sanitizeId(reportIdRaw);
  const questionId = sanitizeId(assistantMsg.id);
  const ownerId = sanitizeId(profile.uid);
  const allowedLangs: LanguageMode[] = ['standard', 'simple', 'hinglish', 'hindi'];
  const safeLang: LanguageMode =
    assistantMsg.languageMode && allowedLangs.includes(assistantMsg.languageMode)
      ? assistantMsg.languageMode
      : 'standard';
  const rawPage = assistantMsg.citations?.[0]?.pageNumber ?? 0;
  const safePrimaryPage = Number.isFinite(rawPage)
    ? Math.max(0, Math.min(10000, Math.trunc(rawPage)))
    : 0;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(WORKSPACE_QUESTIONS_KEY);
      const list: Array<Record<string, unknown>> = existingRaw ? JSON.parse(existingRaw) : [];
      list.unshift({
        questionId,
        reportId,
        ownerId,
        question: (questionText?.trim() || 'Query').slice(0, 2000),
        answer: (assistantMsg.content?.trim() || 'Response').slice(0, 15000),
        foundInReport: Boolean(assistantMsg.foundInReport),
        primaryPage: safePrimaryPage,
        supportingPassage: (assistantMsg.citations?.[0]?.supportingPassage || '').slice(0, 5000),
        languageMode: safeLang,
        createdAt: new Date().toISOString(),
      });
      window.localStorage.setItem(WORKSPACE_QUESTIONS_KEY, JSON.stringify(list.slice(0, 100)));
    }
  } catch {
    // Ignore storage quota limits
  }
}

export async function fetchUserReportsFromFirestore(): Promise<
  Array<{
    reportId: string;
    title: string;
    fileName: string;
    pageCount: number;
    chunkCount: number;
    tableCount: number;
    fileSize: number;
    summaryOverview: string;
  }>
> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(WORKSPACE_REPORTS_KEY);
      return existingRaw ? JSON.parse(existingRaw) : [];
    }
  } catch {
    // Ignore storage restrictions
  }
  return [];
}

export async function deleteReportFromFirestore(reportIdRaw: string): Promise<void> {
  const reportId = sanitizeId(reportIdRaw);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(WORKSPACE_REPORTS_KEY);
      if (existingRaw) {
        const list: Array<{ reportId?: string }> = JSON.parse(existingRaw);
        window.localStorage.setItem(
          WORKSPACE_REPORTS_KEY,
          JSON.stringify(list.filter((item) => item.reportId !== reportId))
        );
      }
    }
  } catch {
    // Ignore storage restrictions
  }
}
