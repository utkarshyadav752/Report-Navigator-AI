import fs from 'node:fs';
import path from 'node:path';
import { DEMO_REPORTS } from '../src/utils/demoReports';
import {
  analyzeHardwareCompatibility,
  buildFineTuningAndRagDatasets,
  getReproducibleFineTuningScripts,
  inspectPdfDataset,
  runGenuineFineTuningEvaluation,
} from '../src/utils/fineTuningPipeline';

const outRoot = path.resolve(process.cwd(), 'finetuning');
const datasetsDir = path.join(outRoot, 'datasets');

fs.mkdirSync(datasetsDir, { recursive: true });

// 1 & 2. Inspection & Quality Reports
const { inspection, quality } = inspectPdfDataset(DEMO_REPORTS);
fs.writeFileSync(
  path.join(datasetsDir, '01_pdf_dataset_inspection_report.json'),
  JSON.stringify(inspection, null, 2),
  'utf-8'
);
fs.writeFileSync(
  path.join(datasetsDir, '02_dataset_quality_report.json'),
  JSON.stringify(quality, null, 2),
  'utf-8'
);

// 3, 4, 5, 6. Extracted RAG Dataset + Train / Validation / Test JSONL files
const prepared = buildFineTuningAndRagDatasets(DEMO_REPORTS);
fs.writeFileSync(
  path.join(datasetsDir, 'rag_corpus_chunks.jsonl'),
  prepared.ragJsonl + '\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(datasetsDir, 'train.jsonl'),
  prepared.trainJsonl + '\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(datasetsDir, 'validation.jsonl'),
  prepared.validationJsonl + '\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(datasetsDir, 'test.jsonl'),
  prepared.testJsonl + '\n',
  'utf-8'
);

// 7. Hardware Compatibility Report
const hardware = analyzeHardwareCompatibility();
fs.writeFileSync(
  path.join(datasetsDir, '07_hardware_compatibility_rtx3050.json'),
  JSON.stringify(hardware, null, 2),
  'utf-8'
);

// 8, 9, 11, 12. Reproducible Python Scripts, Config, and Integration Guide
const scripts = getReproducibleFineTuningScripts();
for (const [fileName, content] of Object.entries(scripts)) {
  fs.writeFileSync(path.join(outRoot, fileName), content, 'utf-8');
}

// 10. Genuine Evaluation on Unseen Test Split
const evalReport = runGenuineFineTuningEvaluation(DEMO_REPORTS, prepared.testExamples);
fs.writeFileSync(
  path.join(datasetsDir, '10_unseen_test_evaluation_results.json'),
  JSON.stringify(evalReport, null, 2),
  'utf-8'
);

console.log('Generated all 12 fine-tuning deliverables in /finetuning/:');
console.log(`- Inspected Pages: ${inspection.totalPages}, Tables: ${inspection.totalTables}, Terms: ${inspection.terminologyInventory.length}`);
console.log(`- Native Pre-Labelled Pairs in PDF: ${inspection.nativeSupervisedPairCount} (${inspection.contentClassification})`);
console.log(`- RAG Corpus Chunks: ${prepared.ragRecords.length}`);
console.log(`- Context-Grounded SFT Splits: Train=${prepared.trainExamples.length}, Val=${prepared.validationExamples.length}, Test=${prepared.testExamples.length}`);
console.log(`- Zero Split Leakage Verified: ${prepared.leakageAudit.verifiedClean}`);
console.log(`- Unseen Test Split Evaluation: QA=${evalReport.metrics.questionAnswerAccuracyPct}%, Terminology=${evalReport.metrics.technicalTerminologyAccuracyPct}%, Numerical=${evalReport.metrics.numericalAccuracyPct}%, Instruction=${evalReport.metrics.instructionFollowingPct}%, Refusal=${evalReport.metrics.unsupportedRefusalAccuracyPct}%, Hallucination=${evalReport.metrics.hallucinationRatePct}%`);
