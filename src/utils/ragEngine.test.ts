import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkReportPages,
  compareMultipleReports,
  compareTableMetrics,
  computeProgrammaticTableAnalysis,
  extractSupportingSentences,
  extractTablesFromPages,
  retrieveAcrossMultipleReports,
  retrieveRelevantChunks,
  runCompetitionEvaluationSuite,
  synthesizeGroundedAnswer,
  validateCitationNavigation,
  verifyAnswerClaims,
  verifyNumericalAccuracy,
} from './ragEngine';
import { DEMO_REPORTS } from './demoReports';

test('TEST A — Exact navigation: 10-page PDF query on Page 7 resolves to Page 7 (0-based pdfPageIndex 6) with valid boundingBox & textPosition', () => {
  const report10Pages = DEMO_REPORTS[0];
  assert.ok(report10Pages.pageCount >= 10, 'Report must have at least 10 pages');

  const query =
    'How many operational Health and Wellness Centres and District Hospital beds were recorded on Page 7?';
  const retrieval = retrieveRelevantChunks(query, report10Pages);

  assert.equal(retrieval.isSupported, true);
  assert.ok(retrieval.citations.length > 0, 'Must return at least one citation');

  const topCit = retrieval.citations[0];
  assert.equal(topCit.pageNumber, 7, 'Citation must navigate to exact Page 7 (never default to Page 1)');
  assert.equal(topCit.pdfPageIndex, 6, '0-based internal PDF page index must be 6 for Page 7');
  assert.ok(topCit.chunkId?.includes('_p7_'), 'Chunk ID must correspond to Page 7');
  assert.ok(topCit.boundingBox && topCit.boundingBox.width > 0, 'Must preserve boundingBox coordinates');
  assert.ok(
    topCit.textPosition && topCit.textPosition.endOffset > topCit.textPosition.startOffset,
    'Must preserve character textPosition offsets'
  );
  assert.ok(
    topCit.supportingSentenceSpans &&
      topCit.supportingSentenceSpans.some((s) => s.text.includes('174,820')),
    'Supporting sentence span must highlight the exact sentence containing 174,820'
  );

  const navCheck = validateCitationNavigation(topCit, DEMO_REPORTS);
  assert.equal(navCheck.valid, true);
  assert.equal(navCheck.pageNumber, 7);
  assert.equal(navCheck.pdfPageIndex, 6);
});

test('TEST B — Original evidence: Displayed quotation matches stored extracted source text verbatim with unchanged wording and numbers', () => {
  const rawParagraph =
    'Audit Note (2026): Special Rural Tele-Medicine Allocation stood at ₹14,290.75 crore across 412 districts (94.6% utilization); spelling-variant: programme-centres.';
  const pages = [
    {
      pageNumber: 4,
      pdfPageIndex: 3,
      sectionTitle: 'Section 4: Rural Tele-Medicine Audit',
      text: rawParagraph,
    },
  ];

  const chunks = chunkReportPages(pages, 'rep_verbatim_test');
  assert.equal(chunks.length, 1);
  assert.equal(
    chunks[0].originalText,
    rawParagraph,
    'Stored originalText must match raw extracted text character-for-character'
  );

  const spans = extractSupportingSentences(
    chunks[0].originalText,
    'What was the Special Rural Tele-Medicine Allocation in 2026?'
  );
  assert.ok(spans.length > 0);
  const extractedSlice = chunks[0].originalText.slice(spans[0].startOffset, spans[0].endOffset);
  assert.equal(
    extractedSlice,
    spans[0].text,
    'Highlighted sentence span offsets must slice the exact verbatim characters from originalText'
  );
  assert.ok(spans[0].text.includes('₹14,290.75 crore'));
  assert.ok(spans[0].text.includes('programme-centres'));
});

test('TEST C — Claim-level verification: 3 claims where 2 are SUPPORTED and 1 is UNSUPPORTED (with 0 citations on the unsupported claim)', () => {
  const report = DEMO_REPORTS[0];
  const threeClaimAnswer = [
    'According to the report:',
    '1. The national effective literacy rate increased during the reporting period to 81.2% in 2026.',
    '2. Kerala recorded the highest literacy rate at 96.2%.',
    '3. The rural literacy rate reached 85%.',
  ].join('\n');

  const retrieval = retrieveRelevantChunks(
    'national literacy rate Kerala rural literacy rate',
    report
  );
  const verification = verifyAnswerClaims(threeClaimAnswer, 'Literacy audit', report, retrieval, [
    report,
  ]);

  assert.equal(verification.claims.length, 3, 'Must extract exactly 3 atomic claims');

  // Claim 1: SUPPORTED
  assert.equal(verification.claims[0].status, 'SUPPORTED');
  assert.ok(verification.claims[0].citations.length > 0, 'Supported claim 1 must have a citation');
  assert.equal(verification.claims[0].citations[0].pageNumber, 3);

  // Claim 2: SUPPORTED
  assert.equal(verification.claims[1].status, 'SUPPORTED');
  assert.ok(verification.claims[1].citations.length > 0, 'Supported claim 2 must have a citation');
  assert.equal(verification.claims[1].citations[0].pageNumber, 3);

  // Claim 3: UNSUPPORTED (Report says rural literacy is 76.8%, NOT 85%)
  assert.equal(verification.claims[2].status, 'UNSUPPORTED');
  assert.equal(
    verification.claims[2].citations.length,
    0,
    'Unsupported claim 3 MUST NOT receive a fake citation'
  );

  // Overall status must be PARTIALLY_SUPPORTED (never FULLY_SUPPORTED when 1 claim is unsupported)
  assert.equal(verification.overallStatus, 'PARTIALLY_SUPPORTED');
});

test('TEST D — Conflicting evidence: Two documents with different values for the same statistic are both disclosed and marked CONFLICTING', () => {
  const [mospiReport, iesaReport] = DEMO_REPORTS;
  const query = "What was India's installed solar photovoltaic capacity in 2026?";
  const multiRetrieval = retrieveAcrossMultipleReports(query, [mospiReport, iesaReport], 6);

  const answerText =
    "India's installed solar photovoltaic capacity stood at 104.8 GW in 2026 in national utility filings, compared to 112.4 GW in 2026 in regional satellite registries.";

  const verification = verifyAnswerClaims(
    answerText,
    query,
    mospiReport,
    multiRetrieval,
    [mospiReport, iesaReport]
  );

  assert.equal(
    verification.overallStatus,
    'CONFLICTING_EVIDENCE',
    'Overall status must be CONFLICTING_EVIDENCE when sources disagree'
  );
  assert.equal(verification.claims[0].status, 'CONFLICTING');
  assert.ok(
    verification.claims[0].conflictDetails &&
      verification.claims[0].conflictDetails.sources.length >= 2,
    'Both conflicting sources must be disclosed'
  );

  const reportedReportIds = verification.claims[0].conflictDetails!.sources.map((s) => s.reportId);
  assert.ok(reportedReportIds.includes(mospiReport.reportId));
  assert.ok(reportedReportIds.includes(iesaReport.reportId));
});

test('TEST E — Incorrect citation: Referencing a nonexistent page, nonexistent chunk, or mismatched page/chunk is strictly rejected', () => {
  const report = DEMO_REPORTS[0]; // 10 pages

  // 1. Nonexistent page number (Page 99 on a 10-page document)
  const outOfBoundsPage = validateCitationNavigation(
    {
      citationId: 'bad_1',
      reportId: report.reportId,
      pageNumber: 99,
      sectionTitle: 'Fake Page',
    },
    DEMO_REPORTS
  );
  assert.equal(outOfBoundsPage.valid, false);

  // 2. Nonexistent chunk ID
  const fakeChunk = validateCitationNavigation(
    {
      citationId: 'bad_2',
      reportId: report.reportId,
      pageNumber: 3,
      chunkId: 'nonexistent_chunk_xyz',
      sectionTitle: 'Fake Chunk',
    },
    DEMO_REPORTS
  );
  assert.equal(fakeChunk.valid, false);

  // 3. Mismatched chunk page (chunk from Page 1 claimed as Page 7)
  const page1ChunkId = report.chunks.find((c) => c.pageNumber === 1)?.chunkId;
  const mismatchedPageChunk = validateCitationNavigation(
    {
      citationId: 'bad_3',
      reportId: report.reportId,
      pageNumber: 7,
      chunkId: page1ChunkId,
      sectionTitle: 'Mismatched Page',
    },
    DEMO_REPORTS
  );
  assert.equal(mismatchedPageChunk.valid, false);
});

test('Refusal, AI Control Options & Table Comparison: Unanswerable queries return strict refusal and AI controls format responses accurately', () => {
  const report = DEMO_REPORTS[0];
  const badQuery = 'What was the cryptocurrency mining revenue on Mars in 2026?';
  const retrieval = retrieveRelevantChunks(badQuery, report);
  const synth = synthesizeGroundedAnswer(badQuery, report, retrieval, 'standard');

  assert.equal(retrieval.isSupported, false);
  assert.equal(synth.answer, 'Insufficient evidence found in the uploaded reports.');

  // Test AI Control Options (Bullets, Table, Short, Hindi, Hinglish)
  const validQuery = 'What was the national literacy rate in 2026?';
  const validRet = retrieveRelevantChunks(validQuery, report);
  const bulletsSynth = synthesizeGroundedAnswer(validQuery, report, validRet, 'standard', {
    answerLength: 'short',
    responseStyle: 'simple',
    language: 'english',
    responseFormat: 'bullets',
  });
  assert.ok(bulletsSynth.answer.includes('• '));
  assert.ok(bulletsSynth.answer.includes('[Page 3]'));

  const tableSynth = synthesizeGroundedAnswer(validQuery, report, validRet, 'standard', {
    answerLength: 'detailed',
    responseStyle: 'technical',
    language: 'english',
    responseFormat: 'table',
  });
  assert.ok(tableSynth.answer.includes('| Source Page | Section | Verified Finding |'));

  const tables = extractTablesFromPages(
    report.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.rawText })),
    report.reportId
  );
  assert.ok(tables.length > 0);
  const cmp = compareTableMetrics(tables[0], 0, 2, 4);
  assert.equal(cmp.rawValA, '1,210.9');
  assert.equal(cmp.rawValB, '1,441.7');
});

test('TEST F — Programmatic Table Intelligence, Cross-Report Comparison & 10-Case Competition Benchmark Suite', () => {
  // 1. Highest value query
  const maxState = computeProgrammaticTableAnalysis(
    'Which state has the highest value for Literacy Rate (%) in Table 2.1?',
    DEMO_REPORTS
  );
  assert.ok(maxState);
  assert.equal(maxState.calculationType, 'max_value');
  assert.ok(maxState.computedValue.includes('Kerala'));
  assert.ok(maxState.computedValue.includes('96.2'));

  // 2. Largest decline query
  const declineRes = computeProgrammaticTableAnalysis(
    'Which category experienced the largest decline in Table 1.1?',
    DEMO_REPORTS
  );
  assert.ok(declineRes);
  assert.equal(declineRes.calculationType, 'largest_decline');
  assert.ok(declineRes.computedValue.includes('-45.73%'));

  // 3. Incompatible unit refusal
  const unitGuard = computeProgrammaticTableAnalysis(
    'Add the national population in millions and the literacy rate percentage together.',
    DEMO_REPORTS
  );
  assert.ok(unitGuard);
  assert.equal(unitGuard.calculationType, 'unit_limitation');
  assert.ok(unitGuard.limitationWarning);

  // 4. Multi-report comparison
  const comparisons = compareMultipleReports(DEMO_REPORTS);
  assert.ok(comparisons.length >= 3);
  assert.ok(comparisons.some((c) => c.category === 'methodology_difference'));

  // 5. Full 10-Case Competition Evaluation Suite
  const evalSuite = runCompetitionEvaluationSuite(DEMO_REPORTS);
  assert.equal(evalSuite.summary.total, 10);
  assert.equal(evalSuite.summary.passed, 10, 'All 10 competition evaluation categories must pass');
  assert.equal(evalSuite.summary.citationCorrectnessRate, 100);
  assert.equal(evalSuite.summary.unsupportedRefusalRate, 100);
});


