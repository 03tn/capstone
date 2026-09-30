"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSearch,
  FileText,
  Gavel,
  LayoutDashboard,
  Loader2,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import {
  analyzeExtractedText,
  extractDocumentText,
  type AnalysisFinding,
  type AnalysisMode,
} from "@/lib/analyze";
import { taxonomyDescription } from "@/lib/candidateRetrieval";
import { agreementTypes, roleLabels, type UserRole } from "@/lib/data";
type Agreement = {
  id: string;
  vendor: string;
  agreementType: string;
  businessUnit: string;
  neededBy: string;
  filename: string;
  status: string;
  playbookVersion: string;
  createdAt: string;
};
type Finding = {
  id: string;
  agreementId: string;
  provision: string;
  findingType: string;
  severity: string;
  confidence: number;
  sourceText: string;
  reason: string;
  status: string;
  decisionReason?: string;
  analysisMethod?: string;
};
type Rule = {
  id: string;
  agreementType: string;
  provision: string;
  applicability: string;
  standard: string;
  method: string;
  severity: string;
  active: boolean;
};
type Audit = {
  id: string;
  agreementId?: string;
  actorName: string;
  eventType: string;
  detail: string;
  createdAt: string;
};
type Data = {
  me: { name: string; email: string; role: UserRole };
  agreements: Agreement[];
  findings: Finding[];
  rules: Rule[];
  audit: Audit[];
  aiStatus: string;
  users?: { id: string; name: string; role: UserRole }[];
};
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["intake", "New intake", Upload],
  ["queue", "Review queue", FileSearch],
  ["agreements", "Agreements", Archive],
  ["playbook", "Playbooks", BookOpenCheck],
  ["reports", "Reporting", BarChart3],
  ["audit", "Audit log", ShieldCheck],
  ["profile", "Profile & access", UserRoundCog],
] as const;
const label = (s?: string | null) =>
  s?.trim()
    ? s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not available";
const tone = (s?: string | null) =>
  s === "high" || s === "escalated"
    ? "red-tone"
    : s === "medium" || s === "in_review"
      ? "amber-tone"
      : s?.startsWith("cleared") || s === "accepted"
        ? "green-tone"
        : "slate-tone";
const allowedViews: Record<UserRole, string[]> = {
  submitter: ["overview", "intake", "agreements", "profile"],
  reviewer: ["overview", "intake", "queue", "agreements", "reports", "audit", "profile"],
  approver: ["overview", "intake", "queue", "agreements", "reports", "audit", "profile"],
  administrator: nav.map(([id]) => id),
};
const detectionMethodDefinitions = [
  {
    name: "Regex",
    description:
      "Deterministic keywords and text patterns identify predictable clause language without AI.",
  },
  {
    name: "AI",
    description:
      "A general-purpose model interprets flexible contract language and must return supporting text from the document.",
  },
  {
    name: "Hybrid",
    description:
      "Deterministic retrieval finds likely clauses, then AI evaluates the candidate language.",
  },
  {
    name: "Regex + AI",
    description:
      "A hybrid variation where regex finds structured language and AI interprets its surrounding meaning.",
  },
  {
    name: "Manual fallback",
    description:
      "A reviewer selects the provision and source text when automation is unavailable or needs correction.",
  },
] as const;
export default function Workspace() {
  const [data, setData] = useState<Data | null>(null),
    [view, setView] = useState("overview"),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [type, setType] = useState("All"),
    [busy, setBusy] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 780);
  const refresh = async () => {
    const r = await fetch("/api/workspace"),
      j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j);
  };
  useEffect(() => {
    refresh().catch((e) => toast.error(e.message));
  }, []);
  useEffect(() => {
    if (data && !allowedViews[data.me.role].includes(view)) setView("overview");
  }, [data, view]);
  const agreements = useMemo(() => data?.agreements ?? [], [data?.agreements]),
    findings = data?.findings ?? [];
  const filtered = useMemo(
    () =>
      agreements.filter(
        (a) =>
          (type === "All" || a.agreementType === type) &&
          `${a.vendor} ${a.id} ${a.businessUnit}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [agreements, type, search],
  );
  const agreement = agreements.find((a) => a.id === selected) ?? agreements[0];
  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/workspace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await refresh();
      toast.success("Saved and added to the audit record.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <div className="loading">
        <div className="loader" />
        <p>Preparing Calder workspace…</p>
      </div>
    );
  const canSubmit = true;
  const canReview = ["reviewer", "approver", "administrator"].includes(data.me.role);
  const visibleNav = nav.filter(([id]) => allowedViews[data.me.role].includes(id));
  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <Toaster richColors position="top-right" />
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="brand">
          <div className="brand-mark">
            <Gavel size={19} />
          </div>
          <div>
            <strong>Calder</strong>
            <span>Agreement Review</span>
          </div>
        </div>
        <button
          className="sidebar-collapse"
          aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          title={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        <nav>
          {visibleNav.map(([id, n, Icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-label={n}
              title={n}
              onClick={() => {
                setView(id);
                if (window.innerWidth <= 780) setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{n}</span>
              {id === "queue" && (
                <em>{findings.filter((f) => f.status === "open").length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="ai-ok">
            <span /> Manual review ready
          </div>
          <div className="profile">
            <div className="avatar">
              {data.me.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{data.me.name}</strong>
              <span>{roleLabels[data.me.role]}</span>
            </div>
          </div>
          <a href="/signout-with-chatgpt?return_to=/">Sign out</a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeftOpen size={19} />
          </button>
          <div>
            <h1>{nav.find((n) => n[0] === view)?.[1]}</h1>
            <p>
              {view === "overview"
                ? "Operational control for inbound vendor agreements"
                : "Calder Industrial Supply"}
            </p>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <Search size={17} />
              <input
                aria-label="Search agreements"
                placeholder="Search vendor, ID, unit…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {canSubmit && <Button onClick={() => setView("intake")}> 
              <Plus size={16} /> New agreement
            </Button>}
          </div>
        </header>
        <div className="content">
          {view === "overview" && (
            <Overview
              data={data}
              onQueue={() => setView(canReview ? "queue" : "agreements")}
              onSelect={(id) => {
                setSelected(id);
                setView(canReview ? "queue" : "agreements");
              }}
            />
          )}
          {view === "intake" && canSubmit && (
            <Intake busy={busy} submit={post} rules={data.rules} />
          )}{" "}
          {view === "queue" && canReview && (
            <Queue
              data={data}
              selected={agreement}
              setSelected={setSelected}
              decide={post}
              busy={busy}
              role={data.me.role}
            />
          )}{" "}
          {view === "agreements" && (
            <Agreements
              rows={filtered}
              search={search}
              setSearch={setSearch}
              type={type}
              setType={setType}
              onSelect={canReview ? (id) => {
                setSelected(id);
                setView("queue");
              } : undefined}
            />
          )}
          {view === "playbook" && data.me.role === "administrator" && <Playbook rules={data.rules} update={post} />}{" "}
          {view === "reports" && <Reports data={data} />}{" "}
          {view === "audit" && <AuditLog events={data.audit} />}
          {view === "profile" && <ProfileAccess me={data.me} users={data.users || []} update={post} />}
        </div>
      </main>
    </div>
  );
}
function Kpi({
  label: l,
  value,
  note,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number;
  note: string;
  icon: any;
  danger?: boolean;
}) {
  return (
    <Card className="kpi">
      <CardContent>
        <div className={danger ? "kpi-icon danger" : "kpi-icon"}>
          <Icon size={19} />
        </div>
        <span>{l}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </CardContent>
    </Card>
  );
}
function Overview({
  data,
  onQueue,
  onSelect,
}: {
  data: Data;
  onQueue: () => void;
  onSelect: (id: string) => void;
}) {
  const open = data.findings.filter((f) => f.status === "open"),
    lowConfidence = open.filter((f) => f.confidence < 85),
    overdue = data.agreements.filter(
      (a) =>
        new Date(a.neededBy) < new Date() && !a.status.startsWith("cleared"),
    );
  return (
    <>
      <div className="notice">
        <ShieldCheck size={21} />
        <div>
          <strong>Human review remains the decision point.</strong>
          <span>
            Every automated finding includes its source and confidence. Manual
            classification remains available if analysis fails.
          </span>
        </div>
        <button>View policy</button>
      </div>
      <section className="kpis">
        <Kpi
          label="In active review"
          value={
            data.agreements.filter((a) =>
              [
                "in_review",
                "ready_for_review",
                "manual_review_required",
              ].includes(a.status),
            ).length
          }
          note="Across 3 business units"
          icon={Clock3}
        />
        <Kpi
          label="Low-confidence open"
          value={lowConfidence.length}
          note="Human verification prioritized"
          icon={AlertTriangle}
          danger
        />
        <Kpi
          label="Awaiting approver"
          value={data.agreements.filter((a) => a.status === "escalated").length}
          note="Final disposition needed"
          icon={Gavel}
        />
        <Kpi
          label="Cleared this cycle"
          value={
            data.agreements.filter((a) => a.status.startsWith("cleared")).length
          }
          note="Including conditions"
          icon={CheckCircle2}
        />
      </section>
      <section className="overview-grid">
        <Card>
          <CardHeader className="card-head">
            <div>
              <CardTitle>Priority queue</CardTitle>
              <p>Ordered by needed-by date and confidence</p>
            </div>
            <Button variant="outline" onClick={onQueue}>
              Open queue <ChevronRight size={15} />
            </Button>
          </CardHeader>
          <CardContent className="rows">
            {data.agreements
              .filter((a) => !a.status.startsWith("cleared"))
              .slice(0, 4)
              .map((a) => {
                const fs = data.findings.filter(
                  (f) => f.agreementId === a.id && f.status === "open",
                );
                return (
                  <button
                    className="agreement-row"
                    key={a.id}
                    onClick={() => onSelect(a.id)}
                  >
                    <div className="file-icon">
                      <FileText size={18} />
                    </div>
                    <div className="row-main">
                      <strong>{a.vendor}</strong>
                      <span>
                        {a.id} · {a.agreementType} · {a.businessUnit}
                      </span>
                    </div>
                    <div>
                      <Badge variant="outline" className={tone(a.status)}>
                        {label(a.status)}
                      </Badge>
                      <span className="due">
                        Due{" "}
                        {new Date(a.neededBy).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <strong
                      className={
                        fs.some((f) => f.confidence < 85)
                          ? "risk-high"
                          : "risk-neutral"
                      }
                    >
                      {fs.length} flags
                    </strong>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review health</CardTitle>
            <p>Current agreement workload</p>
          </CardHeader>
          <CardContent>
            <div className="donut">
              <div>
                <strong>78%</strong>
                <span>within target</span>
              </div>
            </div>
            <div className="health-list">
              <span>
                <i className="dot green" />
                Within target <b>7</b>
              </span>
              <span>
                <i className="dot amber" />
                Due in 48 hours <b>2</b>
              </span>
              <span>
                <i className="dot red" />
                Overdue <b>{overdue.length}</b>
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
function Intake({
  submit,
  busy,
  rules,
}: {
  submit: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  rules: Rule[];
}) {
  const [form, setForm] = useState({
      vendor: "",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "",
      filename: "",
      storageKey: "",
    }),
    [file, setFile] = useState<File | null>(null),
    [analysisMode, setAnalysisMode] = useState<AnalysisMode>("automatic"),
    [analysisStatus, setAnalysisStatus] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await runSubmission();
    } finally {
      setSubmitting(false);
    }
  };
  const runSubmission = async () => {
    if (!file) {
      toast.error("Choose a searchable PDF or TXT file before submitting.");
      return;
    }
    setAnalysisStatus("Preparing document…");
    let next = { ...form };
    let extractedText = "";
    const uploadSelectedFile = async () => {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch("/api/workspace", {
        method: "PUT",
        body: fd,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string" ? result.error : "Upload failed.",
        );
      return result as { filename: string; key: string };
    };
    try {
      setAnalysisStatus("Validating searchable document text…");
      extractedText = await extractDocumentText(file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The document could not be read.";
      setAnalysisStatus(`${message} Submission was not stored.`);
      toast.error(`${message} Submission was not stored.`);
      return;
    }
    let uploadResult: { filename: string; key: string };
    try {
      uploadResult = await uploadSelectedFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setAnalysisStatus(`${message} Submission was not stored.`);
      toast.error(`${message} Submission was not stored.`);
      return;
    }
    next = {
      ...next,
      filename: uploadResult.filename,
      storageKey: uploadResult.key,
    };
    const agreementId = `agr-${crypto.randomUUID().slice(0, 8)}`;
    if (
      await submit({
        action: "create_agreement",
        id: agreementId,
        status: "ready_for_review",
        ...next,
      })
    ) {
      const analysisStarted = performance.now();
      let result: {
        method: "manual" | "ai" | "deterministic";
        findings: AnalysisFinding[];
        notice: string;
      };
      try {
        setAnalysisStatus(
          analysisMode === "automatic"
            ? "Agreement stored. Trying hosted extraction, with deterministic fallback…"
            : analysisMode === "deterministic"
              ? "Agreement stored. Running deterministic analysis…"
              : "Agreement stored. Opening the manual review path…",
        );
        result = await analyzeExtractedText(
          extractedText,
          form.agreementType,
          analysisMode,
          rules.filter((rule) => rule.agreementType === form.agreementType),
        );
      } catch {
        result = {
          method: "manual",
          findings: [],
          notice:
            "Agreement stored. Automated analysis failed, so guided manual review remains available.",
        };
      }
      const analysisDurationMs = Math.round(performance.now() - analysisStarted);
      await submit({
        action: "add_analysis_findings",
        agreementId,
        analysisMethod: result.method,
        analysisDurationMs,
        findings: result.findings,
      });
      setAnalysisStatus(result.notice);
      toast.success(result.notice);
      setForm({
        vendor: "",
        agreementType: "Software Subscription",
        businessUnit: "Corporate IT",
        neededBy: "",
        filename: "",
        storageKey: "",
      });
      setFile(null);
    }
  };
  return (
    <div className="form-layout">
      <section>
        <div className="section-title">
          <h2>Submit a vendor agreement</h2>
          <p>
            Provide the minimum information needed to route and review this
            agreement.
          </p>
        </div>
        <form className="intake-form" onSubmit={send}>
          <div>
            <Label>Vendor</Label>
            <Input
              required
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Vendor legal name"
            />
          </div>
          <div className="form-grid">
            <div>
              <Label>Agreement type</Label>
              <Select
                value={form.agreementType}
                onValueChange={(v) => setForm({ ...form, agreementType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agreementTypes.map((agreementType) => (
                    <SelectItem key={agreementType} value={agreementType}>
                      {agreementType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business unit</Label>
              <Select
                value={form.businessUnit}
                onValueChange={(v) => setForm({ ...form, businessUnit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corporate IT">Corporate IT</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Distribution">Distribution</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Needed-by date</Label>
            <Input
              required
              type="date"
              value={form.neededBy}
              onChange={(e) => setForm({ ...form, neededBy: e.target.value })}
            />
          </div>
          <div>
            <Label>Analysis path</Label>
            <Select
              value={analysisMode}
              onValueChange={(value) => setAnalysisMode(value as AnalysisMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">
                  Automatic: AI → deterministic fallback
                </SelectItem>
                <SelectItem value="deterministic">
                  Deterministic only
                </SelectItem>
                <SelectItem value="manual">Manual review only</SelectItem>
              </SelectContent>
            </Select>
            <span className="field-help">
              AI is optional. If it is disabled or unavailable, deterministic
              analysis runs automatically.
            </span>
          </div>
          <div>
            <Label>Agreement PDF or text file</Label>
            <label className="drop">
              <Upload size={24} />
              <strong>{file ? file.name : "Choose a PDF or TXT file"}</strong>
              <span>
                Maximum 10 MB. Image-only PDFs are rejected before submission;
                OCR is outside this release.
              </span>
              <input
                type="file"
                accept="application/pdf,text/plain,.pdf,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="form-actions">
            <Button
              type="submit"
              disabled={busy || submitting}
              aria-busy={busy || submitting}
            >
              {busy || submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Submit for review"
              )}
            </Button>
            <span>Submission creates an attributable audit record.</span>
          </div>
          {analysisStatus && (
            <div
              className="analysis-status flex items-center gap-2"
              role="status"
            >
              {submitting && (
                <Loader2
                  size={14}
                  className="shrink-0 animate-spin"
                  aria-hidden="true"
                />
              )}
              {analysisStatus}
            </div>
          )}
        </form>
      </section>
      <aside className="process-panel">
        <h3>What happens next</h3>
        {[
          [
            "1",
            "Private intake",
            "The PDF and metadata are stored as an agreement version.",
          ],
          [
            "2",
            "Presence identification",
            "Active playbook categories return source text and confidence.",
          ],
          [
            "3",
            "Human review",
            "A reviewer accepts, dismisses, or escalates each flag.",
          ],
          [
            "4",
            "Disposition",
            "The agreement is cleared, conditioned, or escalated.",
          ],
        ].map((x) => (
          <div key={x[0]}>
            <b>{x[0]}</b>
            <p>
              <strong>{x[1]}</strong>
              <span>{x[2]}</span>
            </p>
          </div>
        ))}
        <div className="manual-note">
          <FileSearch size={18} />
          <p>
            <strong>Automation is optional</strong>
            <span>
              If analysis is unavailable, the agreement enters manual review
              without losing the workflow.
            </span>
          </p>
        </div>
      </aside>
    </div>
  );
}

function Queue({
  data,
  selected,
  setSelected,
  decide,
  busy,
  role,
}: {
  data: Data;
  selected?: Agreement;
  setSelected: (s: string) => void;
  decide: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  role: UserRole;
}) {
  const [active, setActive] = useState<Finding | null>(null),
    [decision, setDecision] = useState("accepted"),
    [reason, setReason] = useState("");
  const queueAgreements = data.agreements.filter(
    (agreement) => !agreement.status?.startsWith("cleared"),
  );
  const current =
    queueAgreements.find((agreement) => agreement.id === selected?.id) ??
    queueAgreements[0];
  const fs = current
    ? data.findings.filter((finding) => finding.agreementId === current.id)
    : [];

  if (!current) {
    return (
      <div className="queue-empty-state" role="status">
        <CheckCircle2 size={34} />
        <div>
          <h2>No agreements are waiting for review</h2>
          <p>
            The queue will populate after a Submitter uploads an agreement or
            routes an agreement to guided manual review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-layout">
      <aside className="queue-list">
        <div className="queue-filter">
          <strong>Review queue</strong>
          <span>
            {queueAgreements.length}{" "}
            agreements
          </span>
        </div>
        {queueAgreements.map((a) => (
            <button
              className={current.id === a.id ? "selected" : ""}
              key={a.id}
              onClick={() => setSelected(a.id)}
            >
              <span
                className={`risk-line ${data.findings.some((f) => f.agreementId === a.id && f.confidence < 85) ? "red" : "amber"}`}
              />
              <div>
                <strong>{a.vendor}</strong>
                <small>
                  {a.id} · {a.agreementType}
                </small>
                <small>
                  Needed{" "}
                  {new Date(a.neededBy).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </div>
              <Badge variant="outline" className={tone(a.status)}>
                {label(a.status)}
              </Badge>
            </button>
          ))}
      </aside>
      <section className="review-detail">
        <div className="review-title">
          <div>
            <span>
              {current.id} · {current.agreementType}
            </span>
            <h2>{current.vendor}</h2>
            <p>
              {current.filename} · {current.businessUnit} ·{" "}
              {current.playbookVersion}
            </p>
          </div>
          <Badge variant="outline" className={tone(current.status)}>
            {label(current.status)}
          </Badge>
        </div>
        <div className="summary-strip">
          <span>
            <b>{fs.length}</b> provisions
          </span>
          <span>
            <b>{fs.filter((f) => f.status === "open").length}</b> awaiting
            disposition
          </span>
          <span>
            <b>{fs.filter((f) => f.confidence < 85).length}</b> verify
            confidence
          </span>
        </div>
        <div className="finding-stack">
          {fs.length ? (
            fs.map((f) => (
              <article
                className={`finding ${f.status !== "open" ? "resolved" : ""}`}
                key={f.id}
              >
                <div className="finding-top">
                  <div>
                    <Badge variant="outline" className="green-tone">
                      Provision identified
                    </Badge>
                    <Badge variant="outline" className="method-badge">
                      {label(f.analysisMethod || "manual")}
                    </Badge>
                    <strong>{f.provision}</strong>
                  </div>
                  <div className="confidence">
                    <span>{f.confidence}% confidence</span>
                    <Progress value={f.confidence} />
                  </div>
                </div>
                <p className="reason">{f.reason}</p>
                <blockquote>
                  <span>SOURCE TEXT</span>“{f.sourceText}”
                </blockquote>
                {f.status === "open" || (f.status === "escalated" && ["approver", "administrator"].includes(role)) ? (
                  <Button
                    onClick={() => {
                      setActive(f);
                      setReason("");
                    }}
                  >
                    {f.status === "escalated" ? "Resolve escalation" : "Review finding"}
                  </Button>
                ) : (
                  <div className="decision">
                    <CheckCircle2 size={17} />
                    <span>
                      {label(f.status)} — {f.decisionReason}
                    </span>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty">
              <CheckCircle2 />
              <h3>No findings yet</h3>
              <p>Add a manual finding while automated analysis is pending.</p>
            </div>
          )}
        </div>
        <ManualFinding agreementId={current.id} submit={decide} />
      </section>
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disposition: {active?.provision}</DialogTitle>
            <DialogDescription>
              Your decision and reason become part of the permanent audit
              record.
            </DialogDescription>
          </DialogHeader>
          <div className="decision-form">
            <Label>Decision</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Accept finding</SelectItem>
                <SelectItem value="dismissed">Dismiss finding</SelectItem>
                <SelectItem value="escalated">Escalate to Approver</SelectItem>
              </SelectContent>
            </Select>
            <Label>Required reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the basis for this decision…"
            />
            <Button
              disabled={busy}
              onClick={async () => {
                if (
                  active &&
                  (await decide({
                    action: "decide_finding",
                    findingId: active.id,
                    decision,
                    reason,
                  }))
                )
                  setActive(null);
              }}
            >
              Record decision
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ManualFinding({
  agreementId,
  submit,
}: {
  agreementId: string;
  submit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [f, setF] = useState({
      provision: "Cap on Liability",
      confidence: 100,
      sourceText: "",
      reason: "",
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus size={16} /> Add manual finding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add source-linked finding</DialogTitle>
          <DialogDescription>
            Use this path when automation is unavailable or needs correction.
          </DialogDescription>
        </DialogHeader>
        <div className="decision-form">
          <Label>Provision</Label>
          <Input
            value={f.provision}
            onChange={(e) => setF({ ...f, provision: e.target.value })}
          />
          <Label>Confidence (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={f.confidence}
            onChange={(e) =>
              setF({ ...f, confidence: Number(e.target.value) })
            }
          />
          <Label>Exact source text</Label>
          <Textarea
            value={f.sourceText}
            onChange={(e) => setF({ ...f, sourceText: e.target.value })}
          />
          <Label>Reviewer note (optional)</Label>
          <Textarea
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
          <Button
            onClick={async () => {
              if (
                await submit({
                  action: "add_manual_finding",
                  agreementId,
                  ...f,
                })
              )
                setOpen(false);
            }}
          >
            Add finding
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function Agreements({
  rows,
  search,
  setSearch,
  type,
  setType,
  onSelect,
}: {
  rows: Agreement[];
  search: string;
  setSearch: (s: string) => void;
  type: string;
  setType: (s: string) => void;
  onSelect?: (s: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="table-tools">
        <div>
          <CardTitle>Agreement register</CardTitle>
          <p>All versions, workflow states, and due dates</p>
        </div>
        <div>
          <div className="global-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All types</SelectItem>
              {agreementTypes.map((agreementType) => (
                <SelectItem key={agreementType} value={agreementType}>
                  {agreementType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="registry">
        <div className="registry-head">
          <span>Agreement</span>
          <span>Type / unit</span>
          <span>Needed by</span>
          <span>Status</span>
          <span />
        </div>
        {rows.map((a) => (
          <button key={a.id} disabled={!onSelect} onClick={() => onSelect?.(a.id)}>
            <span>
              <FileText size={18} />
              <b>
                {a.vendor}
                <small>
                  {a.id} · {a.filename}
                </small>
              </b>
            </span>
            <span>
              {a.agreementType}
              <small>{a.businessUnit}</small>
            </span>
            <span>{new Date(a.neededBy).toLocaleDateString()}</span>
            <Badge variant="outline" className={tone(a.status)}>
              {label(a.status)}
            </Badge>
            <ChevronRight size={17} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
function Playbook({
  rules,
  update,
}: {
  rules: Rule[];
  update: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<string>(agreementTypes[0]),
    shown = rules.filter((r) => r.agreementType === tab);
  return (
    <>
      <div className="section-title">
        <h2>Contract-type playbooks</h2>
        <p>
          Contract type selects the provision categories to identify. The
          baseline records presence, source text, and confidence only.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="playbook-tabs">
          {agreementTypes.map((agreementType) => (
            <TabsTrigger key={agreementType} value={agreementType}>
              {agreementType}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="rule-table">
          <div className="rule-head">
            <span>Provision</span>
            <span>Presence description</span>
            <span>Method</span>
            <span>Active</span>
          </div>
          {shown.map((r) => (
            <div key={r.id}>
              <strong>{r.provision}</strong>
              <span>{taxonomyDescription(r.provision) || "Identify supporting clause text."}</span>
              <span>{r.method}</span>
              <Switch
                checked={r.active}
                onCheckedChange={(active) =>
                  update({ action: "update_rule", ruleId: r.id, active })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="playbook-note">
        <Settings2 size={20} />
        <div>
          <strong>Presence-only baseline</strong>
          <span>
            Prior standard-position, severity, deviation, and gap work is
            preserved as disabled stretch-backlog metadata. It is not used to
            create baseline findings.
          </span>
        </div>
      </div>
      <section className="method-guide" aria-labelledby="method-guide-title">
        <div className="method-guide-heading">
          <FileSearch size={19} />
          <div>
            <h3 id="method-guide-title">Detection method guide</h3>
            <p>
              These methods describe how Calder can identify presence. They do
              not determine whether contract language is acceptable.
            </p>
          </div>
        </div>
        <dl>
          {detectionMethodDefinitions.map((method) => (
            <div key={method.name}>
              <dt>{method.name}</dt>
              <dd>{method.description}</dd>
            </div>
          ))}
        </dl>
        <p className="method-guide-footnote">
          Automatic mode attempts hosted analysis with deterministic
          corroboration. If the hosted service is unavailable, Calder runs the
          deterministic path automatically; manual review remains available at
          all times.
        </p>
      </section>
    </>
  );
}
function Reports({ data }: { data: Data }) {
  const categories = [...new Set(data.findings.map((f) => f.provision))];
  return (
    <>
      <section className="kpis">
        <Kpi
          label="Total agreements"
          value={data.agreements.length}
          note="Current demonstration set"
          icon={FileText}
        />
        <Kpi
          label="Open findings"
          value={data.findings.filter((f) => f.status === "open").length}
          note="Awaiting human decision"
          icon={AlertTriangle}
        />
        <Kpi
          label="Escalated"
          value={data.findings.filter((f) => f.status === "escalated").length}
          note="Approver queue"
          icon={Gavel}
        />
        <Kpi
          label="Decisions recorded"
          value={data.findings.filter((f) => f.status !== "open").length}
          note="Durable audit history"
          icon={ShieldCheck}
        />
      </section>
      <div className="report-grid">
        <Card>
          <CardHeader>
            <CardTitle>Agreements by type</CardTitle>
          </CardHeader>
          <CardContent>
            {agreementTypes.map((t) => {
              const n = data.agreements.filter(
                (a) => a.agreementType === t,
              ).length;
              return (
                <div className="bar-row" key={t}>
                  <span>{t}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(8, (n / data.agreements.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>{n}</b>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provision frequency</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.map((c) => {
              const n = data.findings.filter((f) => f.provision === c).length;
              return (
                <div className="bar-row" key={c}>
                  <span>{c}</span>
                  <div>
                    <i
                      className="orange"
                      style={{ width: `${(n / data.findings.length) * 100}%` }}
                    />
                  </div>
                  <b>{n}</b>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Presence identification coverage</CardTitle>
          <p>What the required baseline measures and reports</p>
        </CardHeader>
        <CardContent className="empty">
          <FileSearch />
          <h3>Provision counts replace risk comparisons</h3>
          <p>
            Reports count which provisions appear most often across submitted
            agreements. Standard positions, deviations, and gap detection remain
            stretch work.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
function ProfileAccess({
  me,
  users,
  update,
}: {
  me: Data["me"];
  users: NonNullable<Data["users"]>;
  update: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [name, setName] = useState(me.name);
  const permissions: Record<UserRole, string[]> = {
    submitter: ["Submit agreements", "Track your submissions", "View final outcomes"],
    reviewer: ["Work the review queue", "Add manual findings", "Accept, dismiss, or escalate"],
    approver: ["Reviewer capabilities", "Resolve escalated items", "Set final disposition"],
    administrator: ["Manage playbooks", "Assign access", "View reporting and audit history"],
  };
  return (
    <div className="profile-access-grid">
      <Card>
        <CardHeader>
          <CardTitle>Profile & access</CardTitle>
          <p>Your assigned role controls the work areas and actions available to you.</p>
        </CardHeader>
        <CardContent className="profile-form">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <span className="field-help">
            Your role is assigned by an Administrator. Profile settings cannot change permissions.
          </span>
          <Button onClick={() => update({ action: "update_profile", name })}>
            Save profile
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Current access</CardTitle></CardHeader>
        <CardContent className="access-summary">
          <Badge variant="outline" className="green-tone">{roleLabels[me.role]}</Badge>
          <h3>{me.name}</h3><p>{me.email}</p>
          <ul>{permissions[me.role].map((permission) => <li key={permission}><CheckCircle2 size={16}/>{permission}</li>)}</ul>
        </CardContent>
      </Card>
      {me.role === "administrator" && (
        <Card className="access-admin-card">
          <CardHeader><CardTitle>Access administration</CardTitle><p>Approve requests and assign each user’s operating role.</p></CardHeader>
          <CardContent className="access-user-list">
            {users.map((user) => <AccessUser key={user.id} user={user} update={update}/>) }
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function AccessUser({ user, update }: { user: NonNullable<Data["users"]>[number]; update: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [role, setRole] = useState<UserRole>(user.role);
  return <div className="access-user-row"><div><strong>{user.name}</strong><span>Current: {roleLabels[user.role]}</span></div><Select value={role} onValueChange={(value)=>setRole(value as UserRole)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="submitter">Submitter</SelectItem><SelectItem value="reviewer">Reviewer</SelectItem><SelectItem value="approver">Approver</SelectItem><SelectItem value="administrator">Administrator</SelectItem></SelectContent></Select><Button variant="outline" disabled={role===user.role} onClick={()=>update({action:"assign_role",userId:user.id,role})}>Assign</Button></div>;
}
function AuditLog({ events }: { events: Audit[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attributable audit history</CardTitle>
        <p>
          Append-only activity across intake, analysis, review, playbook, and
          disposition.
        </p>
      </CardHeader>
      <CardContent className="timeline">
        {events.map((e) => (
          <div key={e.id}>
            <span className="timeline-dot" />
            <time>{new Date(e.createdAt).toLocaleString()}</time>
            <section>
              <strong>{e.eventType}</strong>
              <p>{e.detail}</p>
              <small>
                {e.actorName}
                {e.agreementId ? ` · ${e.agreementId}` : ""}
              </small>
            </section>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
