# Calder verification plan

## Required automated checks

```bash
npm run check
```

This runs ESLint, the Node regression suite, TypeScript compilation, and the Vite production build.

## Scope-amendment guardrails

- Analyzer output is limited to provision, `present: true`, source text, confidence indicator, and method.
- The hosted schema does not return values, severity, deviation, acceptable, or gap classifications.
- A deterministic miss produces no finding; it never becomes a gap.
- Model source spans must occur in the submitted document.
- Hosted confidence is derived from source verification and independent deterministic agreement, not model self-report.
- The manual form collects category, exact source text, confidence, and an optional reviewer note.
- Reporting uses provision frequency.
- Draft standard/applicability/severity data is disabled stretch metadata.

## Fallback tests

| Test | Expected result |
|---|---|
| Automatic mode with hosted extraction | Presence findings enter human queue |
| Hosted extraction unavailable | Deterministic retrieval runs automatically |
| Browser PDF.js failure | Clear compatibility guidance; submission is not stored |
| Deterministic mode | No hosted request is required |
| Manual mode | Agreement is created with no automated findings |
| Image-only PDF | Intake rejects before storage; no false absence/gap |
| Reviewer correction | Source-linked manual finding is accepted and audited |

## Offline CUAD presence evaluation

```bash
python3 evaluation/evaluate_cuad.py \
  --dataset /path/to/CUAD_v1.zip \
  --output-dir evaluation/results
```

The committed deterministic baseline was run over all 510 CUAD contracts. Category-level metrics and positive counts are in `evaluation/results/metrics.csv`. These values describe candidate retrieval, not a legal conclusion. Any CUAD-trained classifier must be evaluated on contracts excluded from training.

## PDF ingestion benchmark

```bash
node evaluation/evaluate_pdf_extraction.mjs \
  --dataset-dir /path/to/CUAD_v1
```

The release's continue threshold is median token recall at least 0.90 and at least 95% of document pairs reaching token recall 0.80. A failure means stop and fix ingestion before model tuning.

Committed full-corpus result: 509 matched PDF/plaintext pairs, median token recall 1.00, document pass rate 1.00, decision `continue`. See `evaluation/pdf-extraction-results/summary.json`.

Test an individual PDF or TXT file with the production PDF.js dependency:

```bash
npm run verify:ingestion -- "/absolute/path/to/agreement.pdf"
```

Release V1.6.4 verified the supplied `Contract 1.pdf`: 146 pages, 225,021
searchable characters, decision `accepted`.

## Manual authorization checks

- A Submitter cannot access the queue, reports, audit, playbook administration, role assignment, or protected rows through direct Supabase requests.
- A Reviewer can create and dispose findings but cannot assign roles.
- An Approver can resolve escalations.
- An Administrator can assign roles and activate/deactivate categories.
- New accounts begin as Submitters.

## Manual UI checks

- Desktop sidebar remains in the left grid column and cannot cover content.
- Collapse control changes the rail from 286 px to 76 px.
- At 700 px and below, navigation becomes a dismissible drawer.
- Finding cards show source and confidence, with no baseline risk/deviation label.
- All seven requester-declared agreement types are available.

## Supabase upgrade check

Rerun `supabase/schema.sql`, create a new account, and confirm it begins as Submitter. Promote it only through an Administrator. Submit a document and confirm new rows use `finding_type='present'`; historical v1.5 rows remain readable.
