"""
Step 6–10: Tokenization, Base-Model Selection, 4-bit NF4 QLoRA Fine-Tuning & Checkpoint Saving
Hardware Target: Windows 11 | 8 GB System RAM | NVIDIA RTX 3050 (<= 4 GB VRAM)
Usage:
  python 02_train_qlora_rtx3050.py --model_id Qwen/Qwen2.5-1.5B-Instruct
"""

import argparse
import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

def verify_rtx3050_hardware():
    print("=== Hardware & Memory Pre-Flight Check ===")
    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU not detected. Ensure NVIDIA RTX 3050 drivers and PyTorch CUDA build are installed."
        )
    device_name = torch.cuda.get_device_name(0)
    vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    print(f"Detected GPU: {device_name} ({vram_gb:.2f} GB total VRAM)")
    if vram_gb <= 4.5:
        print("[INFO] <= 4 GB VRAM mode active: Enforcing 4-bit NF4 + gradient_checkpointing + batch_size=1.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--train_file", type=str, default="./datasets/train.jsonl")
    parser.add_argument("--val_file", type=str, default="./datasets/validation.jsonl")
    parser.add_argument("--output_dir", type=str, default="./checkpoints/qwen2.5-1.5b-report-navigator-lora")
    parser.add_argument("--max_seq_length", type=int, default=512)
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args()

    verify_rtx3050_hardware()

    # 1. Load Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 2. Configure 4-bit NF4 Quantization for <= 4 GB VRAM
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    # 3. Load Base Model with Low CPU RAM Footprint (for 8 GB System RAM)
    model = AutoModelForCausalLM.from_pretrained(
        args.model_id,
        quantization_config=bnb_config,
        device_map="auto",
        low_cpu_mem_usage=True,
        torch_dtype=torch.float16,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)

    # 4. Attach Low-Rank LoRA Adapters (r=8 keeps trainable parameters < 0.25%)
    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 5. Load & Tokenize Train and Validation JSONL Splits (num_proc=1 protects 8 GB RAM)
    dataset = load_dataset(
        "json",
        data_files={"train": args.train_file, "validation": args.val_file},
    )

    def format_and_tokenize(example):
        prompt_text = (
            f"<|im_start|>system\n{example['system']}<|im_end|>\n"
            f"<|im_start|>user\nQuestion: {example['instruction']}\n\n"
            f"Retrieved Context:\n{example['input']}<|im_end|>\n"
            f"<|im_start|>assistant\n{example['output']}<|im_end|>"
        )
        tokenized = tokenizer(
            prompt_text,
            truncation=True,
            max_length=args.max_seq_length,
            padding="max_length",
        )
        tokenized["labels"] = tokenized["input_ids"].copy()
        return tokenized

    tokenized_ds = dataset.map(
        format_and_tokenize,
        remove_columns=dataset["train"].column_names,
        desc="Tokenizing dataset",
    )

    # 6. Configure Low-VRAM Training Arguments
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        fp16=True,
        logging_steps=5,
        eval_strategy="steps",
        eval_steps=10,
        save_strategy="steps",
        save_steps=10,
        save_total_limit=2,
        load_best_model_at_end=True,
        dataloader_num_workers=0,
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_ds["train"],
        eval_dataset=tokenized_ds["validation"],
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )

    print("Starting QLoRA fine-tuning...")
    trainer.train()

    # 7. Export Trained LoRA Adapter & Tokenizer
    adapter_export_dir = os.path.join(args.output_dir, "final_lora_adapter")
    model.save_pretrained(adapter_export_dir)
    tokenizer.save_pretrained(adapter_export_dir)
    print(f"[SUCCESS] Saved trained LoRA adapter to: {adapter_export_dir}")

if __name__ == "__main__":
    main()
