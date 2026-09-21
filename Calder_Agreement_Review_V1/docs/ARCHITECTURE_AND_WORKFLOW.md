# Calder architecture and workflow

## Responsibility boundaries

| Component | Required responsibility | Explicitly excluded |
|---|---|---|
| Contract-type playbook | Select active provision categories for Calder's seven requester-declared agreement types | Inferring agreement type or treating an unfound category as absent |
| PDF.js ingestion | Extract searchable text from PDF/TXT files in the browser | OCR for image-only PDFs |
| Hosted extractor | Return presence and exact source text; the application derives confidence from verifiable evidence | Values, severity, deviations, gaps, legal advice, model self-confidence |
| Deterministic retrieval | Find CUAD-informed candidate clauses from searchable text | Final legal or risk judgment |
| Human reviewer | Verify category/source and accept, dismiss, or escalate | Silent automated disposition |
| Audit/reporting | Preserve actions and count provision frequency | Reporting against undocumented standards |

## Runtime workflow

```mermaid
flowchart TD
    A["Choose PDF or TXT"] --> B["PDF.js validates searchable text"]
    B --> C["Store agreement and audit event"]
    C --> D["Load contract-type categories"]
    D --> E{"Hosted extractor available?"}
    E -->|Yes| F["Presence + source + evidence score"]
    E -->|No| G["CUAD-informed deterministic retrieval"]
    F --> H["Human review queue"]
    G --> H
    B -->|No text layer| I["Reject before storage"]
    D -->|Manual mode| J["Guided manual identification"]
    J --> H
    H --> K["Accept, dismiss, or escalate"]
    K --> L["Audit record and provision-frequency reporting"]
```

Submission and analysis are separate workflow steps and database mutations. Browser-side searchable-text validation happens before an agreement record is created. Image-only scans and files the browser cannot parse are rejected with clear guidance and are not stored. After text is available, the agreement survives a hosted-analysis failure and remains available for deterministic or manual review.

## Hosted extraction order

1. If `OPENAI_API_KEY` is configured, the authenticated Vercel route uses a general-purpose model with the CUAD-informed definition, exclusion criteria, and a strict presence/source schema.
2. If that extractor is unavailable and `CUAD_CLASSIFIER_URL` is configured, the same route may call the separate CUAD-trained experimental service.
3. If neither hosted path succeeds, the browser automatically runs deterministic retrieval.
4. A reviewer can always add or correct a source-linked finding manually.

The browser never receives the classifier token or OpenAI key.

## Evaluation workflow

```mermaid
flowchart TD
    A["Official CUAD v1 ZIP"] --> B["Read 510 contracts and expert spans"]
    B --> C["Apply CUAD-to-Calder mapping"]
    C --> D["Run deterministic presence retrieval"]
    D --> E["Compare document-category predictions"]
    E --> F["Precision and recall by provision"]
    F --> G["Tune candidates or evaluate a held-out classifier"]
```

CUAD is used locally; contract text is not sent to an external service by the evaluation harness.

The optional CUAD-trained service is not the recommended reported model path because a model trained on CUAD cannot be fairly scored on the same contracts. It stays isolated and disabled unless the team creates a documented held-out evaluation design.
