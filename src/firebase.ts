import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppUserProfile, ChatMessage, LanguageMode, Report, ThemeMode } from './types/report';
import { mapFirebaseUserToProfile, validateGoogleAuthConfig } from './utils/authHelpers';

export const googleAuthConfigStatus = validateGoogleAuthConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Clear any legacy local auth keys from prior builds
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('rn_registered_users_v1');
    window.localStorage.removeItem('rn_active_session_v1');
  }
} catch {
  // Ignore storage restrictions
}

// Validate connection on boot per firebase-integration-rpc skill
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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return ID_REGEX.test(cleaned) && cleaned.length >= 1 ? cleaned : `id_${Date.now()}`;
}

export async function signInWithGoogle(): Promise<AppUserProfile | null> {
  if (!googleAuthConfigStatus.configured) {
    throw new Error(
      googleAuthConfigStatus.explanation ||
        'Google authentication is not configured in firebase-applet-config.json.'
    );
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  const result = await signInWithPopup(auth, provider);
  if (result.user) {
    await syncUserProfileToFirestore(result.user, 'standard', 'light').catch(() => {});
    return mapFirebaseUserToProfile(result.user);
  }
  return null;
}

export async function getCurrentIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { User };

export async function syncUserProfileToFirestore(
  user: User,
  languagePreference: LanguageMode,
  themePreference: ThemeMode
): Promise<void> {
  if (!user.emailVerified) return;
  const uid = sanitizeId(user.uid);
  const publicPath = `users/${uid}/public/profile`;
  const publicRef = doc(db, 'users', uid, 'public', 'profile');
  const allowedLangs: LanguageMode[] = ['standard', 'simple', 'hinglish', 'hindi'];
  const safeLang: LanguageMode = allowedLangs.includes(languagePreference)
    ? languagePreference
    : 'standard';
  const safeDisplayName = (
    user.displayName?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'Research Analyst'
  ).slice(0, 120);
  const safeTheme: ThemeMode = themePreference === 'dark' ? 'dark' : 'light';

  try {
    const existingPublicSnap = await getDoc(publicRef);
    if (existingPublicSnap.exists()) {
      const existingData = existingPublicSnap.data();
      const expectedPublicKeys = [
        'uid',
        'displayName',
        'languagePreference',
        'themePreference',
        'createdAt',
        'updatedAt',
      ];
      const existingKeys = existingData ? Object.keys(existingData) : [];
      const hasExactPublicKeys =
        existingKeys.length === expectedPublicKeys.length &&
        expectedPublicKeys.every((k) => existingKeys.includes(k));
      const hasValidExistingShape =
        hasExactPublicKeys &&
        existingData.uid === uid &&
        typeof existingData.displayName === 'string' &&
        existingData.displayName.length >= 1 &&
        existingData.displayName.length <= 120 &&
        allowedLangs.includes(existingData.languagePreference) &&
        (existingData.themePreference === 'light' || existingData.themePreference === 'dark') &&
        existingData.createdAt &&
        typeof existingData.createdAt.toMillis === 'function' &&
        existingData.updatedAt &&
        typeof existingData.updatedAt.toMillis === 'function';

      if (hasValidExistingShape) {
        await updateDoc(publicRef, {
          displayName: safeDisplayName,
          languagePreference: safeLang,
          themePreference: safeTheme,
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(publicRef);
        await setDoc(publicRef, {
          uid,
          displayName: safeDisplayName,
          languagePreference: safeLang,
          themePreference: safeTheme,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(publicRef, {
        uid,
        displayName: safeDisplayName,
        languagePreference: safeLang,
        themePreference: safeTheme,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  if (user.email && user.email.trim().length >= 3) {
    const privatePath = `users/${uid}/private/info`;
    const privateRef = doc(db, 'users', uid, 'private', 'info');
    const safeEmail = user.email.trim().slice(0, 254);
    try {
      const existingPrivateSnap = await getDoc(privateRef);
      if (existingPrivateSnap.exists()) {
        const existingData = existingPrivateSnap.data();
        const expectedPrivateKeys = ['uid', 'email', 'createdAt', 'updatedAt'];
        const existingKeys = existingData ? Object.keys(existingData) : [];
        const hasExactPrivateKeys =
          existingKeys.length === expectedPrivateKeys.length &&
          expectedPrivateKeys.every((k) => existingKeys.includes(k));
        const hasValidExistingShape =
          hasExactPrivateKeys &&
          existingData.uid === uid &&
          typeof existingData.email === 'string' &&
          existingData.email.length >= 3 &&
          existingData.email.length <= 254 &&
          existingData.createdAt &&
          typeof existingData.createdAt.toMillis === 'function' &&
          existingData.updatedAt &&
          typeof existingData.updatedAt.toMillis === 'function';

        if (hasValidExistingShape) {
          await updateDoc(privateRef, {
            email: safeEmail,
            updatedAt: serverTimestamp(),
          });
        } else {
          await deleteDoc(privateRef);
          await setDoc(privateRef, {
            uid,
            email: safeEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await setDoc(privateRef, {
          uid,
          email: safeEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }
}

export async function saveReportToFirestore(report: Report): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const reportId = sanitizeId(report.reportId);
  const ownerId = sanitizeId(user.uid);
  const reportPath = `reports/${reportId}`;
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
    await setDoc(doc(db, 'reports', reportId), {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, reportPath);
  }

  for (const chunk of (report.chunks || []).slice(0, 12)) {
    const chunkId = sanitizeId(chunk.chunkId);
    const chunkPath = `reports/${reportId}/chunks/${chunkId}`;
    const safePageNum = Number.isFinite(chunk.pageNumber)
      ? Math.max(1, Math.min(10000, Math.trunc(chunk.pageNumber)))
      : 1;
    const safeSectionTitle = (chunk.sectionTitle?.trim() || 'Section').slice(0, 240);
    const safeContent = (chunk.content?.trim() || 'Extracted passage').slice(0, 8000);
    try {
      await setDoc(doc(db, 'reports', reportId, 'chunks', chunkId), {
        chunkId,
        reportId,
        ownerId,
        pageNumber: safePageNum,
        sectionTitle: safeSectionTitle,
        content: safeContent,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, chunkPath);
    }
  }
}

export async function saveQuestionToFirestore(
  reportIdRaw: string,
  questionText: string,
  assistantMsg: ChatMessage
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const reportId = sanitizeId(reportIdRaw);
  const questionId = sanitizeId(assistantMsg.id);
  const ownerId = sanitizeId(user.uid);
  const path = `reports/${reportId}/questions/${questionId}`;
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
    await setDoc(doc(db, 'reports', reportId, 'questions', questionId), {
      questionId,
      reportId,
      ownerId,
      question: (questionText?.trim() || 'Query').slice(0, 2000),
      answer: (assistantMsg.content?.trim() || 'Response').slice(0, 15000),
      foundInReport: Boolean(assistantMsg.foundInReport),
      primaryPage: safePrimaryPage,
      supportingPassage: (assistantMsg.citations?.[0]?.supportingPassage || '').slice(0, 5000),
      languageMode: safeLang,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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
  const user = auth.currentUser;
  if (!user) return [];

  const path = 'reports';
  try {
    const q = query(collection(db, 'reports'), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as any);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteReportFromFirestore(reportIdRaw: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const reportId = sanitizeId(reportIdRaw);
  const path = `reports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'reports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
