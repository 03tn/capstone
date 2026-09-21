import taxonomyData from "@/data/cuad-calder-taxonomy.json";

export type TaxonomyEntry = {
  calderProvision: string;
  cuadCategories: string[];
  description: string;
  exclusions: string[];
  contractTypes: string[];
  candidatePhrases: string[];
};

export const taxonomy = taxonomyData.provisions as TaxonomyEntry[];

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export function segmentContract(text: string) {
  const pageAware = text.replace(/\[Page (\d+)\]/g, "\n[Page $1] ");
  const parts = pageAware
    .split(/\n{2,}|(?<=[.;!?])\s+(?=(?:\(?\d+[.)]|\(?[a-z][.)]|[A-Z]))/g)
    .map(clean)
    .filter((part) => part.length >= 20);
  if (!parts.length) return [clean(text)];
  return parts.map((part, index) =>
    clean([parts[index - 1], part, parts[index + 1]].filter(Boolean).join(" ")),
  );
}

function phraseScore(segment: string, phrases: string[]) {
  const lower = segment.toLowerCase();
  return phrases.reduce(
    (score, phrase) => score + (lower.includes(phrase.toLowerCase()) ? 1 : 0),
    0,
  );
}

export function findCandidateClause(text: string, entry: TaxonomyEntry) {
  const candidates = segmentContract(text)
    .map((sourceText) => ({
      sourceText,
      score: phraseScore(sourceText, entry.candidatePhrases),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.min(b.sourceText.length, 700) - Math.min(a.sourceText.length, 700),
    );
  const best = candidates[0];
  if (!best) return null;
  return {
    sourceText: best.sourceText.slice(0, 900),
    confidence: Math.min(96, 60 + best.score * 9 + (best.sourceText.length > 100 ? 4 : 0)),
    matchedCues: best.score,
  };
}

export function entriesForAgreementType(agreementType: string) {
  return taxonomy.filter((entry) => entry.contractTypes.includes(agreementType));
}

export function taxonomyDescription(provision: string) {
  return taxonomy.find((entry) => entry.calderProvision === provision)?.description;
}

export function taxonomyGuidance(provision: string) {
  const entry = taxonomy.find((item) => item.calderProvision === provision);
  return entry
    ? { description: entry.description, exclusions: entry.exclusions }
    : undefined;
}
