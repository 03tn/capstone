"""Optional CUAD-trained question-answering service for Calder.

This service is intentionally isolated from the Vite application. If it is
missing, unhealthy, or below threshold, Calder continues through its
deterministic and guided-manual paths.
"""

from __future__ import annotations

import json
import os
import pathlib
import secrets
from functools import lru_cache

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

APP_ROOT = pathlib.Path(__file__).resolve().parent
TAXONOMY_PATH = pathlib.Path(os.getenv("CALDER_TAXONOMY_PATH", APP_ROOT / "taxonomy.json"))
TAXONOMY = {
    row["calderProvision"]: row
    for row in json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))["provisions"]
}

app = FastAPI(title="Calder CUAD Classifier", version="1.0.0")


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=40, max_length=120_000)
    agreement_type: str
    categories: list[str]


class Finding(BaseModel):
    provision: str
    present: bool = True
    sourceText: str


class AnalysisResponse(BaseModel):
    findings: list[Finding]


def authorize(token: str | None) -> None:
    expected = os.getenv("CUAD_CLASSIFIER_TOKEN", "")
    if expected and (not token or not secrets.compare_digest(expected, token)):
        raise HTTPException(status_code=401, detail="Invalid classifier token")


@lru_cache(maxsize=1)
def classifier():
    model_path = os.getenv("CUAD_MODEL_PATH", "").strip()
    if not model_path:
        raise RuntimeError("CUAD_MODEL_PATH is not configured")
    from transformers import pipeline

    return pipeline(
        "question-answering",
        model=model_path,
        tokenizer=os.getenv("CUAD_TOKENIZER_PATH", model_path),
        device=int(os.getenv("CUAD_DEVICE", "-1")),
    )


def chunks(text: str, size: int = 4_500, overlap: int = 500):
    start = 0
    while start < len(text):
        yield text[start : start + size]
        if start + size >= len(text):
            break
        start += size - overlap


def question(category: str, description: str, exclusions: list[str]) -> str:
    return (
        f'Highlight the parts (if any) of this contract related to "{category}" '
        f"that should be reviewed by a lawyer. Definition: {description} "
        f"Do not include: {' '.join(exclusions)}"
    )


@app.get("/health")
def health():
    return {
        "status": "ready" if os.getenv("CUAD_MODEL_PATH") else "configuration_required",
        "model": os.getenv("CUAD_MODEL_PATH", "not configured"),
    }


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest, x_calder_token: str | None = Header(default=None)):
    authorize(x_calder_token)
    try:
        qa = classifier()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    threshold = float(os.getenv("CUAD_CONFIDENCE_THRESHOLD", "0.50"))
    findings: list[Finding] = []
    for provision in dict.fromkeys(payload.categories):
        mapping = TAXONOMY.get(provision)
        if not mapping or payload.agreement_type not in mapping["contractTypes"]:
            continue
        best = None
        for category in mapping["cuadCategories"]:
            prompt = question(category, mapping["description"], mapping["exclusions"])
            for context in chunks(payload.text):
                result = qa(
                    question=prompt,
                    context=context,
                    handle_impossible_answer=True,
                )
                if result.get("answer", "").strip() and (
                    best is None or result["score"] > best["score"]
                ):
                    best = result
        if best and best["score"] >= threshold:
            findings.append(
                Finding(
                    provision=provision,
                    sourceText=best["answer"].strip(),
                )
            )
    return AnalysisResponse(findings=findings)
