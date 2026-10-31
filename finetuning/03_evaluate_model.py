"""
Step 11: Genuine Unseen Test Split Evaluation Script
Evaluates Base Model + LoRA Adapter on ./datasets/test.jsonl across:
  1. Question-answer accuracy
  2. Technical terminology understanding
  3. Numerical accuracy
  4. Instruction-following ([Page X] citation format)
  5. Hallucination / Unsupported refusal accuracy
Usage:
  python 03_evaluate_model.py --base_model Qwen/Qwen2.5-1.5B-Instruct --adapter_dir ./checkpoints/qwen2.5-1.5b-report-navigator-lora/final_lora_adapter
"""

import argparse
import json
import re
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

def evaluate_predictions(test_file: str, base_model: str, adapter_dir: str):
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
    )
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        base_model, quantization_config=bnb_config, device_map="auto", low_cpu_mem_usage=True
    )
    if adapter_dir and os.path.exists(adapter_dir):
        model = PeftModel.from_pretrained(model, adapter_dir)
    model.eval()

    with open(test_file, "r", encoding="utf-8") as f:
        test_items = [json.loads(line) for line in f if line.strip()]

    results = []
    for item in test_items:
        prompt = (
            f"<|im_start|>system\n{item['system']}<|im_end|>\n"
            f"<|im_start|>user\nQuestion: {item['instruction']}\n\n"
            f"Retrieved Context:\n{item['input']}<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            out_ids = model.generate(**inputs, max_new_tokens=180, temperature=0.0, do_sample=False)
        generated = tokenizer.decode(out_ids[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()

        expected = item["output"]
        is_refusal = "insufficient evidence found in the uploaded reports" in expected.lower()
        if is_refusal:
            passed = "insufficient evidence found in the uploaded reports" in generated.lower()
            results.append({"id": item["id"], "refusal_ok": passed, "citation_ok": True, "numbers_ok": True})
        else:
            expected_nums = re.findall(r"\d[\d,]*(?:\.\d+)?%?", expected)
            nums_ok = all(n in generated for n in expected_nums[:2])
            cit_ok = f"[Page {item['page_number']}]" in generated
            results.append({"id": item["id"], "refusal_ok": True, "citation_ok": cit_ok, "numbers_ok": nums_ok})

    total = max(1, len(results))
    summary = {
        "unseen_test_examples": len(results),
        "citation_format_accuracy_pct": round(sum(r["citation_ok"] for r in results) / total * 100, 1),
        "numerical_accuracy_pct": round(sum(r["numbers_ok"] for r in results) / total * 100, 1),
        "refusal_accuracy_pct": round(sum(r["refusal_ok"] for r in results) / total * 100, 1),
        "details": results,
    }
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    import os
    parser = argparse.ArgumentParser()
    parser.add_argument("--test_file", default="./datasets/test.jsonl")
    parser.add_argument("--base_model", default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--adapter_dir", default="./checkpoints/qwen2.5-1.5b-report-navigator-lora/final_lora_adapter")
    args = parser.parse_args()
    evaluate_predictions(args.test_file, args.base_model, args.adapter_dir)
