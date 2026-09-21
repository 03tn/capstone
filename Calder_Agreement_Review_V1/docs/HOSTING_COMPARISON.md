# Zero-budget hosting comparison

This comparison avoids assuming that a provider's current free-tier quotas will remain unchanged. Recheck the provider terms before the final deployment.

| Option | Best fit in this project | Contract-analysis concern | Decision |
|---|---|---|---|
| Vercel + Supabase | React/Vite UI, short authenticated API call, Auth, PostgreSQL, RLS, and private files | Function duration and cold starts must be measured for each full contract | Baseline deployment |
| Netlify + Supabase | Equivalent static UI and function alternative | Same full-contract timeout test is required | Viable substitute |
| Render Python service | Optional long-running classifier container | Free instances may sleep; model size, startup, memory, and analysis latency require measurement | Experimental only |
| Railway Python service | Optional container/API alternative | Confirm current no-cost allowance, persistent availability, and model resource needs before use | Experimental only |

## Measurement protocol

1. Use the same representative searchable PDF on each candidate host.
2. Record upload-to-findings duration, cold-start duration, warm duration, error status, and contract size.
3. Repeat at least five cold and five warm runs.
4. Record the duration already written to Calder's analysis audit event.
5. Choose a back end only if the full request completes within the host's current limits with margin.

The current release does not require a Python PDF service. PDF.js performs searchable-PDF ingestion in the browser. Once searchable text exists, deterministic retrieval and guided manual identification remain available even if every AI extractor fails or is disabled.
