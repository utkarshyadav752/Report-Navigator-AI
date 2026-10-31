"""
Step 1–5: PDF Extraction, Inspection, Quality Audit, RAG Corpus & SFT Split Generator
Compatible with Windows 11 (8 GB RAM). Requires no paid APIs.
Usage:
  python 01_extract_and_inspect_pdf.py --pdf path/to/mentor_dataset.pdf --out_dir ./datasets
"""

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import pdfplumber

SYSTEM_PROMPT = (
    "You are Report Navigator AI, an evidence-verified research intelligence assistant "
    "for government and statistical reports. Answer strictly using the provided document "
    "context. Preserve exact numbers, units, technical terminology, and [Page X] citations. "
    "If the requested fact is not supported by the context, respond with: "
    '"Insufficient evidence found in the uploaded reports."'
)

def clean_text(raw: str) -> str:
    text = re.sub(r"\r\n?", "\n", raw or "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def detect_native_qa_pairs(text: str, doc_name: str, page_num: int):
    pattern = re.compile(
        r"(?:^|\n)\s*(?:Instruction|Question|Prompt|Q)\s*[:\-]\s*([^\n]+)\s*\n+"
        r"\s*(?:Response|Answer|Completion|A)\s*[:\-]\s*([^\n]+)",
        re.IGNORECASE,
    )
    pairs = []
    for idx, match in enumerate(pattern.finditer(text), start=1):
        q, a = match.group(1).strip(), match.group(2).strip()
        if len(q) >= 10 and len(a) >= 10:
            if f"[Page {page_num}]" not in a:
                a = f"{a} [Page {page_num}]"
            pairs.append({
                "id": f"native_p{page_num}_{idx}",
                "task_category": "factual_qa",
                "source_document": doc_name,
                "page_number": page_num,
                "system": SYSTEM_PROMPT,
                "instruction": q,
                "input": f"Document: {doc_name} (Page {page_num})\nPassage:\n{text[:700]}",
                "output": a,
            })
    return pairs

def inspect_and_extract_pdf(pdf_path: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc_name = pdf_path.name
    rag_chunks = []
    sft_candidates = []
    native_pair_count = 0
    duplicate_pages = 0
    seen_hashes = set()
    page_reports = []

    with pdfplumber.open(pdf_path) as pdf:
        for idx, page in enumerate(pdf.pages):
            page_num = idx + 1
            raw_text = page.extract_text() or ""
            cleaned = clean_text(raw_text)
            words = cleaned.split()
            extracted_tables = page.extract_tables() or []

            page_hash = hashlib.md5(cleaned.lower().encode("utf-8")).hexdigest()
            is_duplicate = len(words) > 15 and page_hash in seen_hashes
            if is_duplicate:
                duplicate_pages += 1
            seen_hashes.add(page_hash)

            first_line = cleaned.split("\n")[0][:90] if cleaned else f"Page {page_num}"
            numbers = re.findall(r"\d[\d,]*(?:\.\d+)?%?", cleaned)

            page_reports.append({
                "page_number": page_num,
                "section_title": first_line,
                "word_count": len(words),
                "table_count": len(extracted_tables),
                "numbers_count": len(numbers),
                "is_duplicate": is_duplicate,
                "is_sparse": len(words) < 20,
            })

            if is_duplicate or len(words) < 5:
                continue

            rag_chunks.append({
                "chunk_id": f"{pdf_path.stem}_p{page_num}_c1",
                "document_name": doc_name,
                "page_number": page_num,
                "section_title": first_line,
                "verbatim_text": raw_text,
                "cleaned_text": cleaned,
                "numbers_and_years": numbers[:25],
                "tables": extracted_tables,
            })

            native = detect_native_qa_pairs(cleaned, doc_name, page_num)
            native_pair_count += len(native)
            sft_candidates.extend(native)

            sentences = [
                s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned)
                if len(s.strip()) > 30 and "|" not in s
            ]
            if sentences:
                lead = " ".join(sentences[:2])
                context = f"Document: {doc_name} | Page {page_num} | Section: {first_line}\nVerbatim Passage:\n{cleaned}"
                sft_candidates.append({
                    "id": f"{pdf_path.stem}_p{page_num}_qa",
                    "task_category": "factual_qa",
                    "source_document": doc_name,
                    "page_number": page_num,
                    "system": SYSTEM_PROMPT,
                    "instruction": f'What are the key verified findings in "{first_line}" on Page {page_num} of {doc_name}?',
                    "input": context,
                    "output": f"According to {doc_name} ({first_line}), {lead} [Page {page_num}]",
                })

    # Add strict unsupported refusal examples across splits
    if rag_chunks:
        first_ctx = f"Document: {doc_name} | Page 1\nVerbatim Passage:\n{rag_chunks[0]['cleaned_text'][:600]}"
        for i, q in enumerate([
            "What was the cryptocurrency mining tax revenue in Antarctica in FY 2026?",
            "How many commercial spaceports were built on Mars in 2026?",
            "What was the semiconductor export volume of Atlantis in 2026?",
        ]):
            sft_candidates.append({
                "id": f"refusal_{i+1}",
                "task_category": "unsupported_refusal",
                "source_document": doc_name,
                "page_number": 1,
                "system": SYSTEM_PROMPT,
                "instruction": q,
                "input": first_ctx,
                "output": "Insufficient evidence found in the uploaded reports.",
            })

    # Deduplicate and add chat messages array
    deduped = []
    seen_inst = set()
    for ex in sft_candidates:
        norm_i = ex["instruction"].lower().strip()
        if norm_i in seen_inst:
            continue
        seen_inst.add(norm_i)
        ex["messages"] = [
            {"role": "system", "content": ex["system"]},
            {"role": "user", "content": f"Question: {ex['instruction']}\n\nRetrieved Context:\n{ex['input']}"},
            {"role": "assistant", "content": ex["output"]},
        ]
        deduped.append(ex)

    train, val, test = [], [], []
    for idx, item in enumerate(deduped):
        if idx % 7 == 5:
            val.append(item)
        elif idx % 7 == 6:
            test.append(item)
        else:
            train.append(item)

    def write_jsonl(path: Path, rows):
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    write_jsonl(out_dir / "rag_corpus_chunks.jsonl", rag_chunks)
    write_jsonl(out_dir / "train.jsonl", train)
    write_jsonl(out_dir / "validation.jsonl", val)
    write_jsonl(out_dir / "test.jsonl", test)

    report = {
        "document_name": doc_name,
        "total_pages": len(page_reports),
        "native_supervised_pairs_found": native_pair_count,
        "classification": "supervised_instruction_dataset" if native_pair_count > 10 else "ordinary_research_report",
        "duplicate_pages_removed": duplicate_pages,
        "rag_chunks_saved": len(rag_chunks),
        "train_count": len(train),
        "validation_count": len(val),
        "test_count": len(test),
        "pages": page_reports,
    }
    with open(out_dir / "inspection_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[OK] Saved inspection report, RAG corpus ({len(rag_chunks)} chunks), and Train/Val/Test JSONL splits to {out_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=str, required=True, help="Path to mentor PDF dataset")
    parser.add_argument("--out_dir", type=str, default="./datasets")
    args = parser.parse_args()
    inspect_and_extract_pdf(Path(args.pdf), Path(args.out_dir))
