# Offline CUAD evaluation

This harness measures Calder's deterministic **presence identification** at the contract/category level. It reports true positives, false positives, false negatives, true negatives, precision, recall, and F1 for every mapped Calder provision plus micro averages.

## Prepare the dataset once

From the application root:

```bash
python3 evaluation/download_cuad.py
```

This downloads the official 105.9 MB CUAD v1 archive from Zenodo to `evaluation/data/CUAD_v1.zip` and verifies its published MD5 checksum. The archive is ignored by Git because CUAD is an evaluation dependency, not an application asset.

You can instead download CUAD yourself and keep it anywhere on your computer. After the ZIP exists, evaluation is fully offline.

## Run the full 510-contract evaluation

```bash
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip
```

Results are written to:

- `evaluation/results/metrics.csv`
- `evaluation/results/metrics.json`

For a quick smoke test:

```bash
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip \
  --limit 10 \
  --output-dir evaluation/results-smoke
```

## Interpretation

- Each CUAD contract is one evaluation example per mapped provision.
- A category is positive when CUAD contains at least one expert-labeled span for the mapped category.
- `Assignment / Control` is positive when either CUAD `Anti-Assignment` or `Change Of Control` is positive.
- Calder predicts presence when its CUAD-informed deterministic candidate retrieval finds one or more configured cues.
- The harness does not score risk, acceptable positions, deviations, or gaps.
- Review category-level positive counts before committing to a provision. Low-support categories produce unstable estimates.

CUAD is CC BY 4.0. See `LICENSES/CUAD_ATTRIBUTION.md`.

## Measure PDF.js ingestion accuracy

Extract the official archive, then compare PDF.js output with CUAD's matching plaintext files:

```bash
unzip evaluation/data/CUAD_v1.zip -d evaluation/data
node evaluation/evaluate_pdf_extraction.mjs \
  --dataset-dir evaluation/data/CUAD_v1
```

The predeclared continue/stop rule is:

- median token recall must be at least 0.90; and
- at least 95% of documents must have token recall of at least 0.80.

Failure exits with status 2 and records `stop-and-fix-ingestion` in the JSON summary. Results are written to `evaluation/pdf-extraction-results/`.
