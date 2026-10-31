import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_REPORTS } from './demoReports';
import {
  analyzeHardwareCompatibility,
  buildFineTuningAndRagDatasets,
  extractNativeSupervisedPairsFromText,
  getReproducibleFineTuningScripts,
  inspectPdfDataset,
  runGenuineFineTuningEvaluation,
} from './fineTuningPipeline';

test('1. PDF Dataset Inspection & Quality Report accurately classifies ordinary reports vs supervised Q&A pairs', () => {
  const { inspection, quality } = inspectPdfDataset(DEMO_REPORTS);

  assert.equal(inspection.documentCount, 2);
  assert.equal(inspection.totalPages, 12);
  assert.equal(inspection.totalTables, 5);
  assert.equal(inspection.nativeSupervisedPairCount, 0);
  assert.equal(inspection.contentClassification, 'ordinary_research_report');
  assert.equal(inspection.suitableForDirectUnmodifiedSft, false);
  assert.ok(
    inspection.suitabilityExplanation.includes('LIMITATION IDENTIFIED'),
    'Must clearly explain that ordinary statistical reports are not pre-labelled SFT datasets'
  );

  // Verify terminology extraction
  const detectedTerms = inspection.terminologyInventory.map((t) => t.term);
  assert.ok(detectedTerms.includes('MoSPI'));
  assert.ok(detectedTerms.includes('TFR'));
  assert.ok(detectedTerms.includes('UPI'));
  assert.ok(detectedTerms.includes('LFP'));

  // Verify cross-report discrepancy detection in Quality Report
  assert.equal(quality.overallQualityStatus, 'HIGH_QUALITY_REPORT_CORPUS');
  assert.equal(quality.totalPagesAudited, 12);
  assert.ok(quality.crossReportDiscrepancies.length >= 1);
  assert.ok(
    quality.crossReportDiscrepancies[0].sourceA.includes('104.8 GW') &&
      quality.crossReportDiscrepancies[0].sourceB.includes('112.4 GW')
  );

  // Verify native supervised pair detector works when a PDF actually contains Q&A pairs
  const sampleQaPdfPage = `
Instruction: What was the Total Fertility Rate (TFR) recorded in 2026?
Response: The Total Fertility Rate (TFR) across India declined to 1.96 children per woman in 2026, below the replacement level of 2.1.
`;
  const extractedPairs = extractNativeSupervisedPairsFromText(
    sampleQaPdfPage,
    'Mentor Supervised QA Sample.pdf',
    'rep_qa_1',
    2
  );
  assert.equal(extractedPairs.length, 1);
  assert.equal(extractedPairs[0].exampleSource, 'native_pdf_pair');
  assert.ok(extractedPairs[0].output.includes('[Page 2]'));
});

test('2. Fine-Tuning & RAG Dataset Builder generates valid JSONL splits with zero train/val/test leakage', () => {
  const datasets = buildFineTuningAndRagDatasets(DEMO_REPORTS);

  // RAG corpus verification
  assert.ok(datasets.ragRecords.length >= 12);
  const firstRagLine = JSON.parse(datasets.ragJsonl.split('\n')[0]);
  assert.ok(firstRagLine.chunk_id);
  assert.ok(firstRagLine.document_name);
  assert.equal(typeof firstRagLine.page_number, 'number');
  assert.ok(firstRagLine.verbatim_text.length > 30);

  // SFT splits verification
  assert.ok(datasets.trainExamples.length >= 15);
  assert.ok(datasets.validationExamples.length >= 3);
  assert.ok(datasets.testExamples.length >= 3);

  // Verify zero leakage across splits
  assert.equal(datasets.leakageAudit.zeroInstructionOverlap, true);
  assert.equal(datasets.leakageAudit.zeroOutputOverlap, true);
  assert.equal(datasets.leakageAudit.trainValOverlapCount, 0);
  assert.equal(datasets.leakageAudit.trainTestOverlapCount, 0);
  assert.equal(datasets.leakageAudit.valTestOverlapCount, 0);
  assert.equal(datasets.leakageAudit.verifiedClean, true);

  // Verify JSONL parseability
  for (const line of datasets.trainJsonl.split('\n')) {
    const parsed = JSON.parse(line);
    assert.ok(parsed.instruction);
    assert.ok(parsed.input);
    assert.ok(parsed.output);
    assert.equal(Array.isArray(parsed.messages), true);
    assert.equal(parsed.messages.length, 3);
  }
});

test('3. Hardware Compatibility Analyzer enforces Windows 11 + 8 GB RAM + RTX 3050 (<= 4 GB VRAM) limits', () => {
  const hw = analyzeHardwareCompatibility();

  assert.equal(hw.systemRamGb, 8);
  assert.equal(hw.gpuVramGb, 4);
  assert.equal(hw.selectedPrimaryModel, 'Qwen/Qwen2.5-1.5B-Instruct');

  const recommended = hw.candidates.filter((c) => c.status === 'RECOMMENDED');
  assert.ok(recommended.length >= 2);
  for (const model of recommended) {
    assert.ok(
      model.estimatedVramGb <= 2.5,
      `Recommended model ${model.modelId} must stay well under 4.0 GB VRAM`
    );
    assert.ok(
      model.estimatedSystemRamGb <= 5.5,
      `Recommended model ${model.modelId} must fit comfortably in 8.0 GB System RAM`
    );
  }

  const exceeded = hw.candidates.find((c) => c.modelId.includes('7B'));
  assert.ok(exceeded);
  assert.equal(exceeded.status, 'EXCEEDS_VRAM_NOT_RECOMMENDED');
});

test('4. Genuine Evaluation Runner executes real tests on unseen test.jsonl examples without fabricating weight training', () => {
  const datasets = buildFineTuningAndRagDatasets(DEMO_REPORTS);
  const evalReport = runGenuineFineTuningEvaluation(DEMO_REPORTS, datasets.testExamples);

  assert.equal(
    evalReport.qloraWeightsTrainedInSandbox,
    false,
    'Must never falsely claim QLoRA weight fine-tuning happened inside the web preview container'
  );
  assert.equal(evalReport.unseenTestExamplesCount, datasets.testExamples.length);
  assert.ok(evalReport.metrics.questionAnswerAccuracyPct >= 80);
  assert.equal(evalReport.metrics.unsupportedRefusalAccuracyPct, 100);
  assert.equal(evalReport.metrics.hallucinationRatePct, 0);

  const scripts = getReproducibleFineTuningScripts();
  assert.ok(scripts['training_config.yaml'].includes('paged_adamw_8bit'));
  assert.ok(scripts['02_train_qlora_rtx3050.py'].includes('BitsAndBytesConfig'));
  assert.ok(scripts['03_evaluate_model.py'].includes('PeftModel'));
});
