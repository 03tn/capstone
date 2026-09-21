#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: npm run verify:ingestion -- "/path/to/agreement.pdf"');
  process.exit(2);
}

const absolute = path.resolve(filename);
const fileStat = await stat(absolute);
if (fileStat.size > 10 * 1024 * 1024)
  throw new Error("Upload a PDF or TXT file no larger than 10 MB.");

const extension = path.extname(absolute).toLowerCase();
let text = "";
let pageCount = null;

if (extension === ".txt") {
  text = (await readFile(absolute, "utf8")).replace(/\s+/g, " ").trim();
} else if (extension === ".pdf") {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await readFile(absolute)),
  });
  try {
    const document = await loadingTask.promise;
    pageCount = document.numPages;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) =>
          typeof item === "object" && item !== null && "str" in item
            ? item.str
            : "",
        )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(`[Page ${pageNumber}] ${pageText}`);
    }
    text = pages.join("\n");
  } finally {
    await loadingTask.destroy();
  }
} else {
  throw new Error("Only PDF and TXT agreements are supported.");
}

const searchableCharacters = text
  .replace(/\[Page \d+\]/g, "")
  .trim().length;
if (searchableCharacters < 40)
  throw new Error(
    "No searchable text was found. Image-only PDFs require OCR and are outside this release.",
  );

console.log(
  JSON.stringify(
    {
      file: path.basename(absolute),
      type: extension.slice(1),
      bytes: fileStat.size,
      pages: pageCount,
      searchableCharacters,
      decision: "accepted",
      preview: text.replace(/\s+/g, " ").slice(0, 220),
    },
    null,
    2,
  ),
);
