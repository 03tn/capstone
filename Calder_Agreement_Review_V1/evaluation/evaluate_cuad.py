#!/usr/bin/env python3
"""Evaluate Calder's deterministic presence detector against CUAD v1.

Metrics are document-level binary precision/recall by mapped Calder provision.
The tool consumes the official CUAD SQuAD-style JSON from either the CUAD ZIP
or an extracted directory and never sends contract text over a network.
"""

from __future__ import annotations

import argparse
import csv
import json
import pathlib
import re
import zipfile
from collections import defaultdict
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]
TAXONOMY_PATH = ROOT / "src" / "data" / "cuad-calder-taxonomy.json"


def load_dataset(path: pathlib.Path) -> dict[str, Any]:
    if path.is_file() and path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            candidates = [name for name in archive.namelist() if name.endswith("CUAD_v1.json")]
            if not candidates:
                raise SystemExit("CUAD_v1.json was not found in the supplied ZIP.")
            with archive.open(candidates[0]) as stream:
                return json.load(stream)
    candidates = [path] if path.is_file() else list(path.rglob("CUAD_v1.json"))
    if not candidates:
        raise SystemExit("Point --dataset to CUAD_v1.zip, CUAD_v1.json, or its directory.")
    return json.loads(candidates[0].read_text(encoding="utf-8"))


def normalize_category(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def category_from_question(qa: dict[str, Any]) -> str:
    identifier = qa.get("id", "")
    if "__" in identifier:
        return identifier.rsplit("__", 1)[1]
    question = qa.get("question", "")
    match = re.search(r'related to "([^"]+)"', question)
    return match.group(1) if match else question


def segments(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    raw = re.split(r"(?<=[.;!?])\s+(?=(?:\(?\d+[.)]|\(?[a-z][.)]|[A-Z]))", text)
    raw = [part.strip() for part in raw if len(part.strip()) >= 20]
    if not raw:
        return [text]
    return [" ".join(raw[max(0, i - 1) : i + 2]) for i in range(len(raw))]


def predict(text: str, phrases: list[str]) -> bool:
    lowered_phrases = [phrase.lower() for phrase in phrases]
    return any(
        any(phrase in clause.lower() for phrase in lowered_phrases)
        for clause in segments(text)
    )


def truth_for_document(document: dict[str, Any]) -> tuple[str, dict[str, bool]]:
    truths: dict[str, bool] = defaultdict(bool)
    contexts: list[str] = []
    for paragraph in document.get("paragraphs", []):
        context = paragraph.get("context", "")
        if context:
            contexts.append(context)
        for qa in paragraph.get("qas", []):
            category = normalize_category(category_from_question(qa))
            positive = not qa.get("is_impossible", False) and bool(qa.get("answers"))
            truths[category] = truths[category] or positive
    return "\n".join(contexts), truths


def metric(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, type=pathlib.Path)
    parser.add_argument("--output-dir", type=pathlib.Path, default=ROOT / "evaluation" / "results")
    parser.add_argument("--limit", type=int, default=0, help="Evaluate only the first N contracts")
    args = parser.parse_args()

    taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))["provisions"]
    dataset = load_dataset(args.dataset)
    documents = dataset["data"][: args.limit or None]
    counts = {
        entry["calderProvision"]: {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
        for entry in taxonomy
    }

    for document in documents:
        text, truth = truth_for_document(document)
        for entry in taxonomy:
            expected = any(
                truth[normalize_category(category)] for category in entry["cuadCategories"]
            )
            detected = predict(text, entry["candidatePhrases"])
            key = "tp" if expected and detected else "fn" if expected else "fp" if detected else "tn"
            counts[entry["calderProvision"]][key] += 1

    rows: list[dict[str, Any]] = []
    total = {key: 0 for key in ("tp", "fp", "fn", "tn")}
    for provision, values in counts.items():
        precision, recall, f1 = metric(values["tp"], values["fp"], values["fn"])
        for key in total:
            total[key] += values[key]
        rows.append(
            {
                "provision": provision,
                **values,
                "positive_contracts": values["tp"] + values["fn"],
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
            }
        )
    precision, recall, f1 = metric(total["tp"], total["fp"], total["fn"])
    summary = {
        "dataset": "CUAD v1",
        "contracts": len(documents),
        "evaluation_unit": "document-category presence",
        "micro_precision": round(precision, 4),
        "micro_recall": round(recall, 4),
        "micro_f1": round(f1, 4),
        "categories": rows,
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "metrics.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    with (args.output_dir / "metrics.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Evaluated {len(documents)} CUAD contracts")
    print(f"Micro precision: {precision:.3f}")
    print(f"Micro recall:    {recall:.3f}")
    print(f"Micro F1:        {f1:.3f}")
    print(f"Results: {args.output_dir}")


if __name__ == "__main__":
    main()
