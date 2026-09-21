# Change log

## 2026-09-17 - V1.6.4 Safari submission compatibility

- Replaced the static `Response.json()` calls in the browser-side workspace API bridge with the broadly supported `new Response(JSON.stringify(...))` pattern.
- Fixed the deployed Safari failure that appeared after PDF text validation as `undefined is not a function`; the failing compatibility API was in the upload/storage bridge, not in the contract itself.
- Added a regression test that fails if the unsupported static response helper is reintroduced.
- Preserved PDF.js browser ingestion, Supabase storage, hosted-AI fallback, deterministic analysis, and guided manual review.

## 2026-09-17 - V1.6.3 browser-only PDF ingestion

- Removed the optional PyMuPDF service, relay endpoint, environment variables, and licensing dependency.
- Kept searchable-PDF ingestion in the application with the patched PDF.js 6.x release and a FileReader compatibility fallback.
- Added clear browser-compatibility guidance instead of exposing Safari's minified `undefined is not a function` error.
- Added `npm run verify:ingestion -- "/path/to/file.pdf"` for repeatable PDF and TXT intake checks.
- Verified the supplied 285 KB `Contract 1.pdf`: 146 pages and 225,021 searchable characters were extracted successfully.
- Preserved deterministic analysis, automatic fallback from hosted AI, and guided manual identification.

## 2026-09-16 - V1.6.2 resilient PDF ingestion

- Fixed the Safari PDF.js failure that surfaced as `undefined is not a function` during `getDocument()`.
- Added FileReader compatibility fallbacks and clearer browser-ingestion diagnostics.
- Added a separately deployable, authenticated PyMuPDF text-extraction service as the server fallback.
- Kept private PDFs in Supabase; Vercel retrieves only the authenticated user's object before relaying it server-to-server.
- Removed temporary uploads if both browser and server extraction fail, so rejected intake does not leave an orphaned document.
- Preserved deterministic candidate retrieval and guided manual review; PyMuPDF performs ingestion only and makes no clause or risk decisions.
- Documented PyMuPDF's AGPL/commercial licensing before production use.

## 2026-09-16 - V1.6.1 review resilience and method guidance

- Prevented the Review Queue from crashing when a reviewer has no visible or reviewable agreements.
- Added a dedicated empty-queue state and defensive handling for missing legacy status values.
- Added an accessible Detection Method Guide to the Playbooks page covering Regex, AI, Hybrid, Regex + AI, and Manual fallback.
- Added regression coverage for the queue failure and method definitions.

## 2026-09-15 - Sponsor-initiated baseline scope reduction

### Source

The project sponsor clarified that the original brief implicitly required the team to derive Calder standard positions from Bonterms and Common Paper agreements. That domain work was not documented or accounted for in the original scope. The sponsor removed it from the required baseline.

### Required baseline after the change

For each active category in the contract-type playbook, the system determines only whether the provision is present. A positive finding contains:

- provision category;
- supporting source text;
- confidence indicator;
- analysis method; and
- a human disposition with an attributable reason.

The required workflow is intake, ingestion and segmentation, presence identification, flag generation, human review, disposition, durable record, and reporting.

### Removed from the required baseline

- standard-position tables;
- extracted term values;
- characterization of acceptable terms or deviations;
- automated risk severity;
- gap detection based on provisions not found; and
- reporting on terms accepted outside Calder's standard.

Reporting now counts which provisions appear most often across submitted agreements.

### Preserved work

The existing standard, applicability, and severity fields remain in the database as disabled stretch-backlog metadata. The baseline analyzer and UI do not use those fields. Historical records are not overwritten. See `docs/STRETCH_BACKLOG.md`.

### Schedule impact

Time previously allocated to authoring legal standard positions is reallocated to the application, deployment, manual workflow, role controls, audit history, CUAD evaluation, and reliability testing.

### Evaluation impact

The Section 6 evaluation requirement remains. CUAD provides expert-labeled offline evaluation data for presence identification, with precision and recall reported by provision category. Bonterms and Common Paper standard-form agreements remain inputs for the separate deliberately modified agreement check set. They are not used to derive Calder risk standards in the required baseline.

## 2026-09-15 - CUAD evaluation and optional classifier integration

- Mapped all 41 CUAD categories to Calder's taxonomy or explicitly documented them as out of scope.
- Selected ten mapped Calder categories with measurable CUAD support.
- Added a local evaluator for the official 510-contract CUAD v1 release.
- Added category-level precision, recall, F1, and confusion counts.
- Expanded deterministic candidate retrieval with CUAD descriptions and labeling-handbook concepts.
- Added an optional separately hosted CUAD-trained question-answering service.
- Preserved deterministic and guided-manual fallback when hosted analysis is unavailable.
- Kept risk authority outside the classifier. If stretch risk evaluation is later enabled, only Calder's versioned playbook engine may make those decisions.
