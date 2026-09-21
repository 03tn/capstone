# Calder Agreement Review - Portable Edition v1.6.4

Calder is a React/Vite vendor-agreement workflow that identifies whether selected provisions are present, shows supporting source text and confidence, and routes every result to a human reviewer. It runs locally, deploys to Vercel, and optionally uses Supabase for authentication, persistence, row-level security, and private document storage.

Version 1.6.4 implements the sponsor's presence-only scope amendment, CUAD taxonomy mapping and evaluation, resilient review screens, in-product detection-method guidance, and Safari-compatible browser-only searchable-PDF ingestion with PDF.js.

## Required baseline

For each active category in the Requester-declared contract-type playbook, Calder answers one question: **is this provision present?** Positive findings contain the category, exact source text, confidence indicator, and analysis method. A reviewer accepts, dismisses, or escalates the finding with a reason.

The baseline does not extract values, compare legal standards, characterize deviations, assign risk severity, or create gaps from categories not found. Earlier standard-position work is preserved as disabled stretch metadata in `docs/STRETCH_BACKLOG.md`.

## Analysis and fallback order

1. PDF.js extracts searchable PDF text in the browser.
2. An optional general-purpose hosted presence extractor can use CUAD definitions and exclusions.
3. An optional isolated CUAD-trained classifier experiment remains disabled by default.
4. CUAD-informed deterministic candidate retrieval runs without AI.
5. Guided manual identification remains available.

The recommended hosted path is a general-purpose model with a strict presence/source schema. Its self-reported confidence is ignored: Calder verifies that the source span occurs in the document and checks whether deterministic retrieval independently agrees. An optional separate CUAD-trained classifier service is included only as an isolated experiment and is off by default; do not use CUAD contracts seen during training to report its evaluation metrics.

The playbook selects categories. Hosted extractors never receive Calder's draft risk standards. If risk decisions are enabled later as stretch work, only Calder's versioned playbook engine may make them.

## Agreement types

The Requester selects one of Calder's procurement intake values; the application never infers it:

- Software Subscription
- Professional Services
- Licensing
- Logistics and Freight
- Data Processing Addendum
- Mutual NDA
- Other

## Accounts and role-based access

- **Submitter**: submit agreements and track outcomes.
- **Reviewer**: Submitter access plus the review queue, manual findings, and accept, dismiss, or escalate actions.
- **Approver**: Reviewer access plus the ability to resolve escalated items.
- **Administrator**: manage active playbook categories, roles, reporting, and audit history.

Every new account starts as a Submitter. Only an Administrator can assign elevated roles. Supabase Auth hashes passwords and issues expiring sessions; database row-level security and stored functions enforce authorization on the server. Hiding navigation is only a usability layer, not the security boundary.

## Test locally in demo mode

Prerequisites: Node.js 22 and npm.

```bash
cd calder-portable
npm install
npm run check
npm run dev
```

Open `http://localhost:5173`. With no `.env.local`, the application uses seeded browser-local demo data. To test the fallback paths:

1. Open **New intake**, choose an agreement type, and upload a searchable PDF/TXT.
2. Choose **Deterministic only** and confirm source-linked presence findings are created.
3. Choose **Manual review only**, then use **Add manual finding** in the reviewer queue.
4. Choose **Automatic** with no hosted keys and confirm deterministic analysis runs automatically.
5. Upload an image-only PDF and confirm intake rejects it before storage with a clear message.

TXT remains available for corpus testing; searchable PDF is the required project format. DOCX and OCR are outside the required scope.

To verify a representative file before testing it in the UI:

```bash
npm run verify:ingestion -- "/absolute/path/to/Contract 1.pdf"
npm run verify:ingestion -- "/absolute/path/to/contract.txt"
```

The command reports file size, page count for PDFs, searchable character count,
an extraction preview, and an accepted/rejected decision. The supplied
`Contract 1.pdf` was verified at 146 pages and 225,021 searchable characters.

## Connect Supabase

1. Create a Supabase project.
2. In **SQL Editor**, run the complete `supabase/schema.sql`. Existing v1.5 deployments must rerun it to migrate shorthand agreement types and allow the new `present` finding type while retaining historical findings.
3. Keep Email authentication enabled. Email verification, password reset, MFA, and account lockout are not required by the project.
4. Copy `.env.example` to `.env.local`.
5. Add your Project URL and browser-safe publishable/anon key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Never put a Supabase secret/service-role key in this frontend project.

## Deploy on the zero-dollar stack

1. Push exactly one application folder named `calder-portable` to GitHub.
2. Import the repository into Vercel.
3. If the repository contains the app as a subfolder, set **Root Directory** to `calder-portable`; otherwise leave it blank.
4. Use Framework **Vite**, Build Command `npm run build`, and Output Directory `dist`.
5. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.
6. Optionally add `OPENAI_API_KEY` and `OPENAI_MODEL`.
7. Deploy and compare observed analysis time in the audit log with the limits of the selected free tier before committing to a hosted model architecture.

The optional Python classifier cannot run on Vercel's static frontend and should be placed on a separate free service only after its cold-start and contract-analysis duration are measured. See `classifier-service/README.md`.

## Run the offline CUAD evaluations

```bash
python3 evaluation/download_cuad.py
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip

unzip evaluation/data/CUAD_v1.zip -d evaluation/data
node evaluation/evaluate_pdf_extraction.mjs \
  --dataset-dir evaluation/data/CUAD_v1
```

The presence evaluator reports precision, recall, F1, and confusion counts by Calder provision. The PDF benchmark compares PDF.js extraction with CUAD's matching plaintext and enforces the predeclared ingestion stop threshold. The app ZIP includes results, mapping, and scripts, but not CUAD's 105.9 MB archive.

The committed benchmark compared 509 matched CUAD PDF/plaintext pairs. Median token recall was 1.00 and every pair met the 0.80 recall floor, so the release's predeclared decision is `continue`.

## Useful commands

```bash
npm run dev       # local development
npm test          # workflow, scope, taxonomy, and UI regression tests
npm run lint      # code-quality validation
npm run check     # lint + tests + production build
npm run build     # production build
npm run preview   # preview the production build
```

## Documentation

- `docs/PROJECT_PLAN.md` - delivery plan and definition of done
- `docs/Calder_Agreement_Review_Project_Plan.docx` - presentation-ready Word project plan with workflows, architecture, evaluation results, and deployment guidance
- `docs/ARCHITECTURE_AND_WORKFLOW.md` - application, fallback, and evaluation flows
- `docs/CHANGE_LOG.md` - sponsor-initiated scope change
- `docs/DECISION_AND_AMBIGUITY_LOG.md` - authentication, retention, conditions, confidence, hosting, and known gaps
- `docs/HOSTING_COMPARISON.md` - zero-budget deployment options and latency measurement protocol
- `docs/STRETCH_BACKLOG.md` - deferred standards/deviation/gap work
- `evaluation/cuad_to_calder_mapping.csv` - all 41 CUAD categories mapped or marked out of scope
- `LICENSES/CUAD_ATTRIBUTION.md` - CUAD source, license, and citation

All automated findings are proposals requiring human verification. Use only approved contract data and follow the data policies of every configured service.
