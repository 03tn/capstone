# Project plan - presence identification baseline

## Objective

Deliver a deployed, role-aware vendor agreement workflow that identifies whether selected provisions are present, returns supporting text and confidence, keeps humans in control, and remains operational without AI.

## Workstreams

| Workstream | Deliverable | Acceptance evidence |
|---|---|---|
| Application shell | Responsive intake, register, queue, reporting, audit, and profile areas | UI regression tests and production build |
| Identity and roles | New users start as Submitters; administrators grant Reviewer, Approver, or Administrator access | Supabase RLS and role tests |
| Manual-first workflow | Reviewer selects category, pastes source, records confidence, and disposes finding | Manual path test with AI disabled |
| Ingestion | Searchable PDF/TXT extraction and clause segmentation | PDF/TXT and size-limit tests |
| Deterministic retrieval | CUAD-informed category descriptions and candidate cues | Offline CUAD precision/recall report |
| Hosted extraction | Optional CUAD classifier and optional OpenAI extractor | Schema contract tests and forced outage test |
| Governance | Source-linked findings, reasons, append-oriented audit history | Database and mutation tests |
| Reporting | Provision frequency by category and agreement type | Seed and workflow report checks |
| Evaluation | CUAD category metrics plus ten deliberately modified standard agreements | Metrics artifacts and expert labels |
| Deployment | Vercel frontend/API, Supabase auth/database/storage, optional Python host | Deployment checklist and live smoke test |

## Delivery sequence

1. Complete and deploy the manual application with no model dependency.
2. Validate roles, permissions, audit history, and reporting.
3. Add searchable-text extraction and deterministic retrieval.
4. Run CUAD evaluation and report precision/recall by category.
5. Add hosted extraction behind the same presence/source/confidence interface.
6. Force hosted-service outages and confirm deterministic/manual fallback.
7. Build and label the ten modified Bonterms/Common Paper evaluation agreements.
8. Tune categories only when support and failure analysis justify the change.
9. Consider stretch work only after baseline acceptance.

## Definition of done

- Eight to twelve justified provision categories are active; this release uses ten mapped categories.
- Every positive automated finding has source text and confidence.
- No baseline component characterizes a deviation, assigns legal risk, or creates a gap from a miss.
- A human disposes every finding and supplies a reason.
- The system works with hosted analysis disabled.
- Precision and recall are reproducible by category on an expert-labeled dataset.
- The application passes lint, automated tests, TypeScript compilation, and a production build.
- GitHub/Vercel/Supabase deployment instructions are complete.

## Risks and controls

| Risk | Control |
|---|---|
| Searchable-text extraction misses scanned pages | Route to manual review; add OCR only as a future service |
| Keyword match is overly broad | Show exact source and confidence; require human verification; tune with CUAD error analysis |
| Model service outage | Deterministic fallback followed by manual workflow |
| Classifier trained on evaluation contracts | Maintain a documented holdout and never report contaminated metrics |
| Missing category treated as absence | No required gap generation; use `not detected`, not `absent` |
| Undocumented risk standard | Risk logic remains disabled until sponsor-approved, versioned standards exist |
