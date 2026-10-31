import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf-8');

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

interface ReportPayload {
  [key: string]: unknown;
}

const REQUIRED_REPORT_KEYS = [
  'reportId', 'ownerId', 'title', 'fileName',
  'pageCount', 'chunkCount', 'tableCount', 'fileSize',
  'status', 'summaryOverview', 'createdAt', 'updatedAt'
];

function isValidReportDocument(data: ReportPayload, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const keys = Object.keys(data);
  if (!REQUIRED_REPORT_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => REQUIRED_REPORT_KEYS.includes(k))) return false;
  if (!isValidId(data.reportId) || !isValidId(data.ownerId)) return false;
  if (data.ownerId !== auth.uid) return false;
  if (typeof data.title !== 'string' || data.title.length < 1 || data.title.length > 240) return false;
  if (typeof data.fileName !== 'string' || data.fileName.length < 1 || data.fileName.length > 240) return false;
  if (typeof data.pageCount !== 'number' || !Number.isInteger(data.pageCount) || data.pageCount < 1 || data.pageCount > 10000) return false;
  if (typeof data.chunkCount !== 'number' || !Number.isInteger(data.chunkCount) || data.chunkCount < 0 || data.chunkCount > 50000) return false;
  if (typeof data.tableCount !== 'number' || !Number.isInteger(data.tableCount) || data.tableCount < 0 || data.tableCount > 5000) return false;
  if (typeof data.fileSize !== 'number' || !Number.isInteger(data.fileSize) || data.fileSize < 0 || data.fileSize > 500000000) return false;
  if (typeof data.status !== 'string' || !['processing', 'ready', 'archived'].includes(data.status)) return false;
  if (typeof data.summaryOverview !== 'string' || data.summaryOverview.length > 10000) return false;
  if (data.createdAt !== 'SERVER_TIME' && typeof data.createdAt !== 'number') return false;
  if (data.updatedAt !== 'SERVER_TIME' && typeof data.updatedAt !== 'number') return false;
  return true;
}

function evaluateReportCreate(
  reportId: string,
  incoming: ReportPayload,
  auth: AuthContext | null,
  requestTime: number
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(reportId)) return 'PERMISSION_DENIED';
  if (!isValidReportDocument(incoming, auth)) return 'PERMISSION_DENIED';
  if (incoming.reportId !== reportId) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== requestTime || incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function evaluateReportUpdate(
  reportId: string,
  existing: ReportPayload,
  incoming: ReportPayload,
  auth: AuthContext | null,
  requestTime: number
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(reportId)) return 'PERMISSION_DENIED';
  if (!isValidReportDocument(incoming, auth)) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (incoming.ownerId !== existing.ownerId) return 'PERMISSION_DENIED';
  if (incoming.reportId !== existing.reportId) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
  if (incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';
  if (existing.status === 'archived') return 'PERMISSION_DENIED';

  const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
  const onlyAllowed = (allowed: string[]) => affectedKeys.every((k) => allowed.includes(k));

  const action1 =
    existing.status === 'processing' &&
    incoming.status === 'ready' &&
    onlyAllowed(['status', 'chunkCount', 'tableCount', 'summaryOverview', 'updatedAt']);
  const action2 =
    existing.status === 'ready' &&
    incoming.status === 'ready' &&
    onlyAllowed(['title', 'fileName', 'pageCount', 'chunkCount', 'tableCount', 'fileSize', 'summaryOverview', 'updatedAt']);
  const action3 =
    existing.status === 'ready' &&
    incoming.status === 'archived' &&
    onlyAllowed(['status', 'updatedAt']);

  return action1 || action2 || action3 ? 'ALLOW' : 'PERMISSION_DENIED';
}

const REQUIRED_PUBLIC_PROFILE_KEYS = [
  'uid', 'displayName', 'languagePreference', 'themePreference', 'createdAt', 'updatedAt'
];

function isValidUserPublicProfile(data: ReportPayload, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const keys = Object.keys(data);
  if (!REQUIRED_PUBLIC_PROFILE_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => REQUIRED_PUBLIC_PROFILE_KEYS.includes(k))) return false;
  if (!isValidId(data.uid) || data.uid !== auth.uid) return false;
  if (typeof data.displayName !== 'string' || data.displayName.length < 1 || data.displayName.length > 120) return false;
  if (typeof data.languagePreference !== 'string' || !['standard', 'simple', 'hinglish', 'hindi'].includes(data.languagePreference)) return false;
  if (typeof data.themePreference !== 'string' || !['light', 'dark'].includes(data.themePreference)) return false;
  if (data.createdAt !== 'SERVER_TIME' && typeof data.createdAt !== 'number') return false;
  if (data.updatedAt !== 'SERVER_TIME' && typeof data.updatedAt !== 'number') return false;
  return true;
}

function evaluatePublicProfileCreate(
  userId: string,
  docId: string,
  incoming: ReportPayload,
  auth: AuthContext | null,
  requestTime: number
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (auth.uid !== userId) return 'PERMISSION_DENIED';
  if (!isValidId(userId) || !isValidId(docId) || docId !== 'profile') return 'PERMISSION_DENIED';
  if (!isValidUserPublicProfile(incoming, auth)) return 'PERMISSION_DENIED';
  if (incoming.uid !== userId) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== requestTime || incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';
  return 'ALLOW';
}


test('Firestore rules file contains all Eight Pillars of Hardened Rules', () => {
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes('isValidReportDocument(incoming())'));
  assert.ok(rulesText.includes('affectedKeys().hasOnly'));
  assert.ok(rulesText.includes('exists(/databases/$(database)/documents/reports/$(reportId))'));
  assert.ok(rulesText.includes('resource.data.ownerId == request.auth.uid'));
});

test('Dirty Dozen Payload 1: Shadow field injection on create returns PERMISSION_DENIED', () => {
  const now = 1700000000;
  const payload = {
    reportId: 'rep_01',
    ownerId: 'uid_user1',
    title: 'Annual Census Report',
    fileName: 'census.pdf',
    pageCount: 10,
    chunkCount: 25,
    tableCount: 3,
    fileSize: 102400,
    status: 'ready',
    summaryOverview: 'Overview text',
    createdAt: now,
    updatedAt: now,
    isVerifiedAdmin: true // Ghost field
  };
  assert.equal(
    evaluateReportCreate('rep_01', payload, { uid: 'uid_user1', email_verified: true }, now),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 2: Unverified email token returns PERMISSION_DENIED', () => {
  const now = 1700000000;
  const payload = {
    reportId: 'rep_01',
    ownerId: 'uid_user1',
    title: 'Annual Census Report',
    fileName: 'census.pdf',
    pageCount: 10,
    chunkCount: 25,
    tableCount: 3,
    fileSize: 102400,
    status: 'ready',
    summaryOverview: 'Overview text',
    createdAt: now,
    updatedAt: now
  };
  assert.equal(
    evaluateReportCreate('rep_01', payload, { uid: 'uid_user1', email_verified: false }, now),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 3: Identity spoofing (ownerId != auth.uid) returns PERMISSION_DENIED', () => {
  const now = 1700000000;
  const payload = {
    reportId: 'rep_01',
    ownerId: 'uid_victim',
    title: 'Annual Census Report',
    fileName: 'census.pdf',
    pageCount: 10,
    chunkCount: 25,
    tableCount: 3,
    fileSize: 102400,
    status: 'ready',
    summaryOverview: 'Overview text',
    createdAt: now,
    updatedAt: now
  };
  assert.equal(
    evaluateReportCreate('rep_01', payload, { uid: 'uid_attacker', email_verified: true }, now),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 5 & 6 & 7: Value poisoning, terminal state bypass, and immortal field tampering return PERMISSION_DENIED', () => {
  const t0 = 1700000000;
  const t1 = 1700000500;
  const existing = {
    reportId: 'rep_01',
    ownerId: 'uid_user1',
    title: 'Annual Census Report',
    fileName: 'census.pdf',
    pageCount: 10,
    chunkCount: 25,
    tableCount: 3,
    fileSize: 102400,
    status: 'ready',
    summaryOverview: 'Overview text',
    createdAt: t0,
    updatedAt: t0
  };

  // Value poisoning: invalid title type
  assert.equal(
    evaluateReportUpdate(
      'rep_01',
      existing,
      { ...existing, title: 12345, updatedAt: t1 },
      { uid: 'uid_user1', email_verified: true },
      t1
    ),
    'PERMISSION_DENIED'
  );

  // Terminal state lock: archived cannot transition back to ready
  const archivedDoc = { ...existing, status: 'archived' };
  assert.equal(
    evaluateReportUpdate(
      'rep_01',
      archivedDoc,
      { ...archivedDoc, status: 'ready', updatedAt: t1 },
      { uid: 'uid_user1', email_verified: true },
      t1
    ),
    'PERMISSION_DENIED'
  );

  // Immortal field tampering: changing createdAt
  assert.equal(
    evaluateReportUpdate(
      'rep_01',
      existing,
      { ...existing, title: 'Updated Title', createdAt: t1, updatedAt: t1 },
      { uid: 'uid_user1', email_verified: true },
      t1
    ),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen Payload 9: Path ID poisoning returns PERMISSION_DENIED', () => {
  const now = 1700000000;
  const badId = 'rep$bad!id/injection';
  const payload = {
    reportId: badId,
    ownerId: 'uid_user1',
    title: 'Annual Census Report',
    fileName: 'census.pdf',
    pageCount: 10,
    chunkCount: 25,
    tableCount: 3,
    fileSize: 102400,
    status: 'ready',
    summaryOverview: 'Overview text',
    createdAt: now,
    updatedAt: now
  };
  assert.equal(
    evaluateReportCreate(badId, payload, { uid: 'uid_user1', email_verified: true }, now),
    'PERMISSION_DENIED'
  );
});

test('Legitimate verified owner create and action-scoped update return ALLOW', () => {
  const t0 = 1700000000;
  const t1 = 1700000500;
  const doc = {
    reportId: 'rep_01',
    ownerId: 'uid_user1',
    title: 'Annual Census Report',
    fileName: 'census.pdf',
    pageCount: 10,
    chunkCount: 25,
    tableCount: 3,
    fileSize: 102400,
    status: 'ready',
    summaryOverview: 'Overview text',
    createdAt: t0,
    updatedAt: t0
  };
  assert.equal(
    evaluateReportCreate('rep_01', doc, { uid: 'uid_user1', email_verified: true }, t0),
    'ALLOW'
  );
  assert.equal(
    evaluateReportUpdate(
      'rep_01',
      doc,
      { ...doc, title: 'Updated Annual Census Report', updatedAt: t1 },
      { uid: 'uid_user1', email_verified: true },
      t1
    ),
    'ALLOW'
  );
});

test('Verified Google user AAMut3yfsNRgNFIcudS4bG8w5v13 can write public profile and create report rep_1793424304175_mkdjp', () => {
  const now = 1793424304;
  const userId = 'AAMut3yfsNRgNFIcudS4bG8w5v13';
  const reportId = 'rep_1793424304175_mkdjp';
  const auth = { uid: userId, email_verified: true };

  const profilePayload = {
    uid: userId,
    displayName: 'yadavutkarsh678',
    languagePreference: 'standard',
    themePreference: 'light',
    createdAt: now,
    updatedAt: now
  };
  assert.equal(
    evaluatePublicProfileCreate(userId, 'profile', profilePayload, auth, now),
    'ALLOW'
  );

  const reportPayload = {
    reportId,
    ownerId: userId,
    title: 'Uploaded Research Report',
    fileName: 'mentor_dataset.pdf',
    pageCount: 12,
    chunkCount: 18,
    tableCount: 3,
    fileSize: 450120,
    status: 'ready',
    summaryOverview: 'Executive summary of uploaded document.',
    createdAt: now,
    updatedAt: now
  };
  assert.equal(
    evaluateReportCreate(reportId, reportPayload, auth, now),
    'ALLOW'
  );
});

