#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const datasetDir = value("--dataset-dir", "evaluation/data/CUAD_v1");
const outputDir = value("--output-dir", "evaluation/pdf-extraction-results");
const limit = Number(value("--limit", "0"));
const MIN_MEDIAN_RECALL = 0.9;
const MIN_DOCUMENT_PASS_RATE = 0.95;
const DOCUMENT_RECALL_FLOOR = 0.8;

async function walk(directory, pattern, found = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, pattern, found);
    else if (pattern.test(entry.name)) found.push(full);
  }
  return found;
}

const key = (filename) =>
  path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

function bag(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function tokenScores(extracted, reference) {
  const actual = tokens(extracted);
  const expected = tokens(reference);
  const actualBag = bag(actual);
  const expectedBag = bag(expected);
  let overlap = 0;
  for (const [token, count] of actualBag)
    overlap += Math.min(count, expectedBag.get(token) ?? 0);
  const precision = actual.length ? overlap / actual.length : 0;
  const recall = expected.length ? overlap / expected.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, extractedTokens: actual.length, referenceTokens: expected.length };
}

async function extractPdf(filename) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(await readFile(filename)) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

const pdfRoot = path.join(datasetDir, "full_contract_pdf");
const txtRoot = path.join(datasetDir, "full_contract_txt");
const pdfs = await walk(pdfRoot, /\.pdf$/i);
const texts = await walk(txtRoot, /\.txt$/i);
const textByKey = new Map(texts.map((filename) => [key(filename), filename]));
const pairs = pdfs
  .map((pdf) => ({ pdf, txt: textByKey.get(key(pdf)) }))
  .filter((pair) => pair.txt)
  .slice(0, limit || undefined);

if (!pairs.length) throw new Error("No matching CUAD PDF/TXT pairs were found.");

const rows = [];
for (let index = 0; index < pairs.length; index += 1) {
  const pair = pairs[index];
  try {
    const [extracted, reference] = await Promise.all([
      extractPdf(pair.pdf),
      readFile(pair.txt, "utf8"),
    ]);
    rows.push({ file: path.basename(pair.pdf), status: "ok", ...tokenScores(extracted, reference) });
  } catch (error) {
    rows.push({
      file: path.basename(pair.pdf),
      status: "error",
      precision: 0,
      recall: 0,
      f1: 0,
      extractedTokens: 0,
      referenceTokens: 0,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if ((index + 1) % 25 === 0 || index + 1 === pairs.length)
    console.log(`Compared ${index + 1}/${pairs.length} PDF/TXT pairs`);
}

const recalls = rows.map((row) => row.recall).sort((a, b) => a - b);
const medianRecall = recalls[Math.floor(recalls.length / 2)];
const passingDocuments = rows.filter(
  (row) => row.status === "ok" && row.recall >= DOCUMENT_RECALL_FLOOR,
).length;
const documentPassRate = passingDocuments / rows.length;
const passed =
  medianRecall >= MIN_MEDIAN_RECALL && documentPassRate >= MIN_DOCUMENT_PASS_RATE;
const summary = {
  dataset: "CUAD v1 PDF/TXT pairs",
  documents: rows.length,
  matchedPairsAvailable: pairs.length,
  medianTokenRecall: Number(medianRecall.toFixed(4)),
  documentPassRate: Number(documentPassRate.toFixed(4)),
  thresholds: {
    minimumMedianTokenRecall: MIN_MEDIAN_RECALL,
    documentRecallFloor: DOCUMENT_RECALL_FLOOR,
    minimumDocumentPassRate: MIN_DOCUMENT_PASS_RATE,
  },
  decision: passed ? "continue" : "stop-and-fix-ingestion",
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
const columns = ["file", "status", "precision", "recall", "f1", "extractedTokens", "referenceTokens", "error"];
const escape = (entry) => `"${String(entry ?? "").replaceAll('"', '""')}"`;
await writeFile(
  path.join(outputDir, "documents.csv"),
  `${columns.join(",")}\n${rows.map((row) => columns.map((column) => escape(row[column])).join(",")).join("\n")}\n`,
);
console.log(JSON.stringify(summary, null, 2));
if (!passed) process.exitCode = 2;
