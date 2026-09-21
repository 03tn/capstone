import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  workspace, data, analyzer, retrieval, aiEndpoint, styles, shell, main,
  schema, app, viteConfig, mappingCsv, evaluator, pdfEvaluator, changeLog,
  decisionLog, stretchBacklog, hostingComparison, classifierApp,
  ingestionVerifier,
] = await Promise.all([
  read("../src/Workspace.tsx"), read("../src/lib/data.ts"),
  read("../src/lib/analyze.ts"), read("../src/lib/candidateRetrieval.ts"),
  read("../api/analyze.js"), read("../src/styles.css"),
  read("../src/slabstax-shell.css"), read("../src/main.tsx"),
  read("../supabase/schema.sql"), read("../src/App.tsx"),
  read("../vite.config.ts"), read("../evaluation/cuad_to_calder_mapping.csv"),
  read("../evaluation/evaluate_cuad.py"),
  read("../evaluation/evaluate_pdf_extraction.mjs"),
  read("../docs/CHANGE_LOG.md"),
  read("../docs/DECISION_AND_AMBIGUITY_LOG.md"),
  read("../docs/STRETCH_BACKLOG.md"), read("../docs/HOSTING_COMPARISON.md"),
  read("../classifier-service/app.py"),
  read("../scripts/verify_ingestion.mjs"),
]);
const taxonomy = JSON.parse(await read("../src/data/cuad-calder-taxonomy.json"));
const metrics = JSON.parse(await read("../evaluation/results/metrics.json"));
const extractionMetrics = JSON.parse(
  await read("../evaluation/pdf-extraction-results/summary.json"),
);
const packageJson = JSON.parse(await read("../package.json"));

const agreementTypes = [
  "Software Subscription", "Professional Services", "Licensing",
  "Logistics and Freight", "Data Processing Addendum", "Mutual NDA", "Other",
];

test("all role-aware work areas remain available", () => {
  for (const view of ["overview", "intake", "queue", "agreements", "playbook", "reports", "audit", "profile"])
    assert.match(workspace, new RegExp(`\\[\\"${view}\\"`));
});

test("SlabStaX-style sidebar occupies its own synchronized grid column", () => {
  assert.match(shell, /--calder-sidebar-open:\s*286px/);
  assert.match(shell, /--calder-sidebar-closed:\s*76px/);
  assert.match(shell, /grid-template-areas:\s*"calder-sidebar calder-workspace"/);
  assert.match(shell, /grid-area:\s*calder-sidebar/);
  assert.match(shell, /grid-area:\s*calder-workspace/);
  assert.match(shell, /\.app-shell\.sidebar-collapsed/);
  assert.match(workspace, /setSidebarOpen\(\(open\) => !open\)/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*repeat\(7|min-width:\s*112px|Final header architecture/);
});

test("mobile navigation is a dismissible drawer", () => {
  assert.match(shell, /@media \(max-width:\s*700px\)/);
  assert.match(shell, /\.sidebar-backdrop/);
  assert.match(workspace, /aria-label="Close navigation"/);
  assert.match(workspace, /aria-label="Open navigation"/);
});

test("Calder palette and responsive authentication UI are active", () => {
  assert.match(shell, /--calder-text:\s*#17243a/);
  assert.match(shell, /--calder-accent:\s*#0b6676/);
  assert.match(main, /import "\.\/slabstax-shell\.css"/);
  assert.match(app, /className="auth-shell"/);
  assert.match(app, /className="auth-intro"/);
  assert.match(app, /Submitter access by default/);
  assert.match(shell, /\.auth-card\s*\{/);
});

test("all seven Calder-declared agreement types are selectable and persisted", () => {
  for (const contractType of agreementTypes) {
    assert.ok(data.includes(`"${contractType}"`));
    assert.ok(schema.includes(`'${contractType}'`));
    assert.ok(taxonomy.provisions.some((entry) => entry.contractTypes.includes(contractType)));
  }
  assert.doesNotMatch(workspace, /SelectItem value="SaaS"|SelectItem value="DPA"/);
});

test("local and hosted workflows retain core mutations", () => {
  for (const action of ["create_agreement", "decide_finding", "add_manual_finding", "update_rule"]) {
    const matches = data.match(new RegExp(`body\\.action\\s*===\\s*"${action}"`, "g")) ?? [];
    assert.ok(matches.length >= 2, `${action} must exist locally and in Supabase`);
  }
  assert.match(data, /audit_events/);
});

test("searchable PDF ingestion rejects unsupported and image-only files", () => {
  assert.match(analyzer, /application\/pdf/);
  assert.match(analyzer, /text\/plain/);
  assert.match(analyzer, /10 \* 1024 \* 1024/);
  assert.match(analyzer, /No searchable text was found/);
  assert.match(analyzer, /Route this scanned PDF to manual review or add OCR/);
  assert.match(analyzer, /readFileBytes/);
  assert.match(analyzer, /FileReader/);
  assert.match(analyzer, /try Chrome or Edge/);
  assert.match(workspace, /Submission was not stored/);
  assert.equal(packageJson.scripts["verify:ingestion"], "node scripts/verify_ingestion.mjs");
  assert.match(ingestionVerifier, /decision: "accepted"/);
  assert.match(ingestionVerifier, /Only PDF and TXT agreements are supported/);
});

test("local API bridge does not require Safari's newer static Response.json API", () => {
  assert.match(data, /function jsonResponse/);
  assert.match(data, /new Response\(JSON\.stringify\(payload\)/);
  assert.doesNotMatch(data, /Response\.json\(/);
});

test("automatic, deterministic, and manual analysis paths remain available", () => {
  for (const mode of ["automatic", "deterministic", "manual"])
    assert.match(workspace, new RegExp(`value="${mode}"`));
  assert.match(analyzer, /runAiAnalysis/);
  assert.match(analyzer, /runDeterministicAnalysis/);
  assert.match(analyzer, /AI was unavailable, so deterministic analysis ran automatically/);
  assert.match(analyzer, /Agreement routed directly to guided manual review/);
});

test("agreement creation completes before the separate analysis step", () => {
  assert.match(
    workspace,
    /action: "create_agreement"[\s\S]*analyzeExtractedText\(/,
  );
  assert.match(data, /agreement stored; analysis runs as a separate workflow step/);
});

test("baseline analyzer creates positive presence findings only", () => {
  assert.match(analyzer, /present:\s*true/);
  assert.match(analyzer, /sourceText/);
  assert.match(analyzer, /analysisMethod/);
  assert.doesNotMatch(analyzer, /findingType|severity|createGap|deviation/);
  assert.match(workspace, /Provision identified/);
  assert.match(workspace, /Provision frequency/);
  assert.doesNotMatch(workspace, /SelectItem value="gap"|SelectItem value="deviation"/);
});

test("general-purpose model receives CUAD definitions and exclusions first", () => {
  assert.match(aiEndpoint, /Apply each supplied definition and exclusion criterion/);
  assert.match(aiEndpoint, /json_schema/);
  assert.match(aiEndpoint, /present:\s*\{ type: "boolean", const: true \}/);
  assert.match(aiEndpoint, /report self-confidence/);
  const handlerIndex = aiEndpoint.indexOf("export default");
  assert.ok(
    aiEndpoint.indexOf("runGeneralPurposeExtractor({", handlerIndex) <
      aiEndpoint.indexOf("runCuadClassifier({", handlerIndex),
  );
  assert.match(analyzer, /normalizedText\.includes/);
  assert.match(analyzer, /corroborated \? 90 : 75/);
});

test("CUAD taxonomy contains ten mapped categories with inclusion and exclusion guidance", () => {
  assert.equal(taxonomy.provisions.length, 10);
  for (const entry of taxonomy.provisions) {
    assert.ok(entry.calderProvision);
    assert.ok(entry.cuadCategories.length >= 1);
    assert.ok(entry.description.length >= 20);
    assert.ok(entry.exclusions.length >= 1);
    assert.ok(entry.candidatePhrases.length >= 5);
  }
  assert.match(retrieval, /findCandidateClause/);
  assert.match(retrieval, /matchedCues/);
});

test("all 41 CUAD categories have an explicit mapping decision", () => {
  const rows = mappingCsv.trim().split(/\r?\n/);
  assert.equal(rows.length, 42);
  assert.match(mappingCsv, /Renewal Term,Auto Renewal,partial/);
  assert.match(mappingCsv, /Uncapped Liability,,out_of_scope/);
});

test("offline CUAD evaluator reports reproducible category metrics", () => {
  assert.match(evaluator, /precision/);
  assert.match(evaluator, /recall/);
  assert.match(evaluator, /false_positives|"fp"/);
  assert.equal(metrics.dataset, "CUAD v1");
  assert.equal(metrics.contracts, 510);
  assert.equal(metrics.categories.length, 10);
  for (const category of metrics.categories) {
    assert.ok(category.positive_contracts > 0);
    assert.ok(category.precision >= 0 && category.precision <= 1);
    assert.ok(category.recall >= 0 && category.recall <= 1);
  }
});

test("PDF.js benchmark enforces and passes the predeclared ingestion gate", () => {
  assert.match(pdfEvaluator, /MIN_MEDIAN_RECALL = 0\.9/);
  assert.match(pdfEvaluator, /MIN_DOCUMENT_PASS_RATE = 0\.95/);
  assert.match(pdfEvaluator, /DOCUMENT_RECALL_FLOOR = 0\.8/);
  assert.equal(extractionMetrics.documents, 509);
  assert.equal(extractionMetrics.medianTokenRecall, 1);
  assert.equal(extractionMetrics.documentPassRate, 1);
  assert.equal(extractionMetrics.decision, "continue");
});

test("Supabase provides persistent workflow tables and server-side RLS", () => {
  for (const table of ["agreements", "findings", "playbook_rules", "audit_events"])
    assert.match(schema, new RegExp(`create table[^;]*${table}`, "i"));
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /Role based agreement read/);
  assert.match(schema, /Review team updates findings/);
  assert.match(schema, /public\.current_user_role\(\) in \('reviewer','approver','administrator'\)/);
  assert.match(schema, /findings_agreement_id_fkey[\s\S]*on delete restrict/);
  assert.doesNotMatch(schema, /create policy[^;]*for delete/i);
});

test("new users are Submitters and only administrators can assign roles", () => {
  for (const role of ["submitter", "reviewer", "approver", "administrator"]) {
    assert.ok(data.includes(role));
    assert.ok(schema.includes(role));
  }
  assert.match(schema, /role text not null default 'submitter'/i);
  assert.match(schema, /Administrator access required/);
  assert.match(schema, /revoke update on public\.profiles from authenticated/i);
  assert.match(schema, /grant update \(full_name, updated_at\)/i);
  assert.doesNotMatch(app, /requested_role|Requested access|Request a role/);
  assert.match(data, /supabase\.rpc\("assign_user_role"/);
});

test("permissions are cumulative and approvers can resolve escalations", () => {
  assert.match(workspace, /reviewer: \["overview", "intake", "queue"/);
  assert.match(workspace, /approver: \["overview", "intake", "queue"/);
  assert.match(workspace, /Resolve escalation/);
  assert.match(workspace, /Profile settings cannot change permissions/);
});

test("review queue handles an empty or fully cleared agreement list", () => {
  assert.match(workspace, /if \(!current\)/);
  assert.match(workspace, /No agreements are waiting for review/);
  assert.match(workspace, /queueAgreements\.find/);
  assert.match(workspace, /const label = \(s\?: string \| null\)/);
  assert.match(workspace, /s\?\.startsWith\("cleared"\)/);
  assert.match(styles, /\.queue-empty-state/);
});

test("playbook explains every detection method and the manual fallback", () => {
  for (const method of ["Regex", "AI", "Hybrid", "Regex + AI", "Manual fallback"])
    assert.ok(workspace.includes(`name: "${method}"`));
  assert.match(workspace, /Detection method guide/);
  assert.match(workspace, /do\s+not determine whether contract language is acceptable/);
  assert.match(workspace, /manual review remains available at\s+all times/);
  assert.match(styles, /\.method-guide/);
});

test("optional CUAD classifier is isolated behind deterministic and manual fallbacks", () => {
  assert.match(aiEndpoint, /CUAD_CLASSIFIER_URL/);
  assert.match(classifierApp, /CUAD_MODEL_PATH/);
  assert.match(classifierApp, /sourceText/);
  assert.match(changeLog, /Sponsor-initiated baseline scope reduction/i);
  assert.match(stretchBacklog, /Gap detection is disabled/);
});

test("professor-directed governance decisions are documented", () => {
  assert.match(decisionLog, /Confidence is a routing indicator/);
  assert.match(decisionLog, /Cleared with conditions/);
  assert.match(decisionLog, /Review decisions and audit events are never deleted/);
  assert.match(decisionLog, /No malware\/virus scanning/);
  assert.match(decisionLog, /median token recall of at least 0\.90/);
  assert.match(hostingComparison, /zero-budget/i);
  assert.match(hostingComparison, /cold-start duration/);
});

test("Vercel deployment dependencies and large PDF code are controlled", () => {
  assert.equal(packageJson.version, "1.6.4");
  assert.equal(packageJson.engines.node, "22.x");
  assert.equal(packageJson.allowScripts["esbuild@0.28.2"], true);
  assert.match(viteConfig, /manualChunks/);
  assert.match(viteConfig, /pdf-engine/);
  assert.match(viteConfig, /chunkSizeWarningLimit:\s*1350/);
});
