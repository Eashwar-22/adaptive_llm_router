import os
import pandas as pd
import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
import torch.nn.functional as F

# Configuration
MODEL_NAME = "distilbert-base-uncased" # Reliable and fast for 8GB RAM
DATA_FILE = "data/dataset.csv"
OUTPUT_DIR = "backend/app/model"
ONNX_PATH = "backend/app/model/classifier.onnx"

def train():
    print("Loading dataset...")
    df = pd.read_csv(DATA_FILE).dropna()
    dataset = Dataset.from_pandas(df)
    dataset = dataset.train_test_split(test_size=0.2)
    
    print(f"Tokenizing using {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    def tokenize_function(examples):
        return tokenizer(examples["prompt"], padding="max_length", truncation=True, max_length=128)
    
    tokenized_datasets = dataset.map(tokenize_function, batched=True)
    
    print("Initializing model...")
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)
    
    # Training Arguments
    training_args = TrainingArguments(
        output_dir="./temp_results",
        eval_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        num_train_epochs=3,
        weight_decay=0.01,
        logging_dir="./temp_logs",
        save_strategy="no",
        use_cpu=True # Force CPU for stability on 8GB Mac
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["test"],
    )
    
    print("Starting training (3 epochs)...")
    trainer.train()
    
    # Save the model and tokenizer
    print(f"Saving model to {OUTPUT_DIR}...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    # Export to ONNX
    print("Exporting to ONNX for production-grade inference...")
    dummy_input = tokenizer("Hello world", return_tensors="pt")
    
    torch.onnx.export(
        model,
        (dummy_input["input_ids"], dummy_input["attention_mask"]),
        ONNX_PATH,
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size"}
        },
        opset_version=14
    )
    print(f"Success. ONNX model saved at {ONNX_PATH}")

if __name__ == "__main__":
    train()
