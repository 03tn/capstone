# Decision and ambiguity log

## Authentication and authorization

**Decision:** Use Supabase Auth for password hashing and expiring sessions. New accounts receive Submitter access. Authorization is enforced by PostgreSQL row-level security and the `assign_user_role` security-definer function; client navigation is not treated as a security control.

**Reason:** The project does not require SSO, MFA, password reset, email verification, or lockout. The meaningful requirement is that a Submitter cannot retrieve or mutate Reviewer/Approver data by changing a URL or calling an API directly.

**Acceptance test:** Attempt protected table reads and finding decisions with a Submitter session and require server denial.

## Hosting and budget

**Decision:** Use Vercel's free tier for React/Vite and the authenticated serverless extraction route, and Supabase's free tier for Auth, PostgreSQL, RLS, and private storage. A Python classifier, if ever used, remains a separately measured optional service.

**Reason:** Budget is zero. The application records analysis duration in its audit event so the team can compare Vercel and any optional Python host before committing.

## Agreement types

**Decision:** The Requester selects Calder's given procurement value: Software Subscription, Professional Services, Licensing, Logistics and Freight, Data Processing Addendum, Mutual NDA, or Other. The system does not infer type.

## Category selection

**Decision:** Use ten measurable categories: Cap on Liability, Auto Renewal, Renewal Notice, Governing Law, Exclusivity, Termination for Convenience, Assignment / Control, Audit Rights, Insurance, and Warranty Duration.

**Rationale:** These concepts touch recurring vendor-agreement review and have mapped CUAD examples. Full-corpus positive counts are recorded in `evaluation/results/metrics.csv`; the smallest mapped category, Warranty Duration, still has 75 positive contracts.

**Ambiguity:** CUAD `Renewal Term` is broader than Calder `Auto Renewal`, and `Assignment / Control` combines CUAD `Anti-Assignment` and `Change Of Control`. The mapping file marks these relationships rather than pretending they are exact synonyms.

## Confidence

**Decision:** Confidence is a routing indicator, not a calibrated probability of correctness.

- Deterministic confidence increases with the number of independent CUAD-informed cues in the candidate clause.
- A hosted finding is rejected if its source span does not appear in the submitted text.
- A verified hosted span receives 75; if independent deterministic retrieval agrees on the category, it receives 90.
- Scores below 85 are prioritized for verification.

**Reason:** A model's self-reported confidence is not accepted as a probability. The current values express observable evidence signals and must be recalibrated against held-out reviewer decisions before production use.

## Severity

**Decision:** Baseline findings have no risk severity. Legacy severity fields remain neutral compatibility data only. If stretch risk work is approved, severity will be a small sponsor-defined category/finding label produced by the playbook engine, never by the extractor.

## Cleared with conditions

**Decision:** Treat a condition as its own future workflow record with an owner, due date, status, completion actor, and completion timestamp, linked to both the agreement and the triggering finding. Completing a condition does not rewrite the original decision.

**Current release boundary:** v1.6 records `cleared_with_conditions` and the human reason in durable findings/audit history but does not yet ship condition-task assignment. The separate condition entity is a documented next application increment, not hidden in the extraction model.

## Record retention

**Decision:** Review decisions and audit events are never deleted. For a classroom deployment, uploaded documents are retained for the project duration. A production Calder policy should retain documents for seven years after agreement closure while keeping decision/audit metadata indefinitely.

**Degraded record:** After an authorized document purge, the decision retains agreement identity, provision category, stored source span, actor, date, disposition, reason, model/method, and confidence. The record must visibly state that the full source document is no longer retained.

## File formats and ingestion

**Decision:** Searchable PDF is required. TXT is retained for CUAD and developer testing. DOCX is optional future work. Image-only/scanned PDFs are rejected before storage with a clear message; OCR is out of scope.

**Stop threshold:** PDF.js extraction must achieve median token recall of at least 0.90 against CUAD plaintext, and at least 95% of document pairs must achieve recall of at least 0.80. Otherwise model work stops until ingestion is fixed.

## Known pre-production gaps

- No malware/virus scanning on upload. It is intentionally out of scope for the public classroom corpus but required before real vendor documents.
- No OCR for scans.
- No DOCX ingestion.
- No SSO integration.
- No production document-lifecycle enforcement job.
- No condition owner/due-date task screen yet.
- The optional CUAD-trained classifier may have training/evaluation leakage and is not the recommended official model path.
