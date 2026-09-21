import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { supabase } from "./data";
import {
  entriesForAgreementType,
  findCandidateClause,
  taxonomyGuidance,
} from "./candidateRetrieval";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type AnalysisMode = "automatic" | "deterministic" | "manual";
export type AnalysisRule = {
  provision: string;
  active: boolean;
};
export type AnalysisFinding = {
  provision: string;
  present: true;
  confidence: number;
  sourceText: string;
  reason: string;
  analysisMethod: "ai" | "deterministic" | "manual";
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function")
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("The selected file could not be read."));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(file);
  });
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

function pdfErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error || "");
  if (/password/i.test(detail))
    return "Password-protected PDFs are not supported. Upload an unlocked searchable PDF.";
  if (/No searchable text was found/.test(detail)) return detail;
  return "This browser could not extract the PDF text. Update the browser, try Chrome or Edge, resave the file as a searchable PDF, or use a TXT copy for testing.";
}

export async function extractDocumentText(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Upload a PDF or TXT file no larger than 10 MB.");
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt"))
    return clean(await readTextFile(file));
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  )
    throw new Error("Only PDF and TXT agreements are supported.");
  try {
    const loadingTask = pdfjs.getDocument({
      data: await readFileBytes(file),
    });
    const document = await loadingTask.promise;
    try {
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) =>
            typeof item === "object" && item !== null && "str" in item
              ? item.str
              : "",
          )
          .join(" ");
        pages.push(`[Page ${pageNumber}] ${clean(pageText)}`);
      }
      const text = pages.join("\n");
      if (text.replace(/\[Page \d+\]/g, "").trim().length < 40)
        throw new Error(
          "No searchable text was found. Route this scanned PDF to manual review or add OCR.",
        );
      return text;
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    throw new Error(pdfErrorMessage(error), { cause: error });
  }
}

function presenceFinding(
  provision: string,
  sourceText: string,
  confidence: number,
): AnalysisFinding {
  return {
    provision,
    present: true,
    confidence,
    sourceText,
    reason:
      "Provision language was identified. A reviewer must verify the category and supporting text.",
    analysisMethod: "deterministic" as const,
  };
}

export function runDeterministicAnalysis(
  text: string,
  agreementType: string,
  playbook: AnalysisRule[] = [],
): AnalysisFinding[] {
  const enabled = new Set(
    playbook.filter((rule) => rule.active).map((rule) => rule.provision),
  );
  const categories = entriesForAgreementType(agreementType).filter(
    (entry) => !playbook.length || enabled.has(entry.calderProvision),
  );
  return categories
    .map((entry) => {
      const match = findCandidateClause(text, entry);
      return match
        ? presenceFinding(
            entry.calderProvision,
            match.sourceText,
            match.confidence,
          )
        : null;
    })
    .filter((finding): finding is AnalysisFinding => finding !== null);
}

async function runAiAnalysis(
  text: string,
  agreementType: string,
  playbook: AnalysisRule[],
): Promise<AnalysisFinding[]> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text: text.slice(0, 120_000),
      agreementType,
      playbook: playbook
        .filter((rule) => rule.active)
        .map((rule) => ({
          provision: rule.provision,
          ...taxonomyGuidance(rule.provision),
        })),
    }),
  });
  if (!response.ok) throw new Error("AI analysis is unavailable.");
  const payload = await response.json();
  if (!Array.isArray(payload.findings))
    throw new Error("AI analysis returned an invalid response.");
  const normalizedText = clean(text).toLowerCase();
  const independentlyDetected = new Set(
    runDeterministicAnalysis(text, agreementType, playbook).map(
      (finding) => finding.provision,
    ),
  );
  return payload.findings
    .filter(
      (finding: Partial<AnalysisFinding>) =>
        finding.present === true &&
        typeof finding.provision === "string" &&
        typeof finding.sourceText === "string" &&
        normalizedText.includes(clean(finding.sourceText).toLowerCase()),
    )
    .map((finding: Partial<AnalysisFinding>) => {
      const provision = String(finding.provision);
      const corroborated = independentlyDetected.has(provision);
      return {
        provision,
        present: true as const,
        confidence: corroborated ? 90 : 75,
        sourceText: String(finding.sourceText),
        reason: corroborated
          ? "The returned span appears in the document and independent deterministic retrieval found the same category."
          : "The returned span appears in the document; deterministic retrieval did not independently corroborate the category.",
        analysisMethod: "ai" as const,
      };
    });
}

export async function analyzeExtractedText(
  text: string,
  agreementType: string,
  mode: AnalysisMode,
  playbook: AnalysisRule[] = [],
) {
  if (mode === "manual")
    return {
      method: "manual" as const,
      findings: [] as AnalysisFinding[],
      notice: "Agreement routed directly to guided manual review.",
    };
  if (mode === "automatic") {
    try {
      const findings = await runAiAnalysis(text, agreementType, playbook);
      return {
        method: "ai" as const,
        findings,
        notice:
          "AI analysis completed; all findings require human verification.",
      };
    } catch {
      return {
        method: "deterministic" as const,
        findings: runDeterministicAnalysis(text, agreementType, playbook),
        notice:
          "AI was unavailable, so deterministic analysis ran automatically.",
      };
    }
  }
  return {
    method: "deterministic" as const,
    findings: runDeterministicAnalysis(text, agreementType, playbook),
    notice:
      "Deterministic analysis completed; all findings require human verification.",
  };
}

export async function analyzeDocument(
  file: File,
  agreementType: string,
  mode: AnalysisMode,
  playbook: AnalysisRule[] = [],
) {
  const text = await extractDocumentText(file);
  return analyzeExtractedText(text, agreementType, mode, playbook);
}
