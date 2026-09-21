const allowedTypes = new Set([
  "Software Subscription",
  "Professional Services",
  "Licensing",
  "Logistics and Freight",
  "Data Processing Addendum",
  "Mutual NDA",
  "Other",
]);
const allowedCategories = new Set([
  "Cap on Liability",
  "Auto Renewal",
  "Renewal Notice",
  "Governing Law",
  "Exclusivity",
  "Termination for Convenience",
  "Assignment / Control",
  "Audit Rights",
  "Insurance",
  "Warranty Duration",
]);

async function runCuadClassifier({ text, agreementType, categories }) {
  const baseUrl = process.env.CUAD_CLASSIFIER_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;
  const response = await fetch(`${baseUrl}/analyze`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.CUAD_CLASSIFIER_TOKEN
        ? { "x-calder-token": process.env.CUAD_CLASSIFIER_TOKEN }
        : {}),
    },
    body: JSON.stringify({
      text,
      agreement_type: agreementType,
      categories,
    }),
  });
  if (!response.ok) throw new Error("CUAD classifier unavailable");
  const result = await response.json();
  if (!Array.isArray(result.findings))
    throw new Error("CUAD classifier response invalid");
  return {
    findings: result.findings
      .filter(
        (finding) =>
          finding.present === true &&
          categories.includes(finding.provision) &&
          typeof finding.sourceText === "string" &&
          finding.sourceText.length > 0,
      )
      .map((finding) => ({
        provision: finding.provision,
        present: true,
        sourceText: finding.sourceText,
      })),
  };
}

async function verifyUser(req) {
  const auth = req.headers.authorization;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!auth?.startsWith("Bearer ") || !url || !key) return false;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: auth, apikey: key },
  });
  return response.ok;
}

async function runGeneralPurposeExtractor({ text, agreementType, definitions }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const categories = definitions.map((definition) => definition.provision);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You identify whether named provision categories are present in a commercial contract. Apply each supplied definition and exclusion criterion. Return only categories with direct supporting text copied exactly from the agreement. Do not infer that a missing result is absent. Do not extract values, compare standards, characterize deviations, assign severity, report self-confidence, or give legal advice.",
        },
        {
          role: "user",
          content: `Agreement type: ${agreementType}\nPresence categories, definitions, and exclusions: ${JSON.stringify(definitions)}\n\nFor each active category that is present, return the category and an exact supporting source span copied from the agreement. Return no item for a category that is not found.\n\n${text}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "contract_findings",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["findings"],
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["provision", "present", "sourceText"],
                  properties: {
                    provision: { type: "string", enum: categories },
                    present: { type: "boolean", const: true },
                    sourceText: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error("General-purpose extractor unavailable");
  const result = await response.json();
  const outputText =
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
  const parsed = JSON.parse(outputText);
  if (!Array.isArray(parsed.findings))
    throw new Error("General-purpose extractor response invalid");
  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!(await verifyUser(req)))
    return res.status(401).json({ error: "Authenticated user required" });
  const { text, agreementType, playbook = [] } = req.body ?? {};
  if (
    !allowedTypes.has(agreementType) ||
    typeof text !== "string" ||
    text.length < 40
  )
    return res
      .status(400)
      .json({ error: "Valid agreement text and type are required" });

  const definitions = playbook
    .filter(
      (rule) =>
        typeof rule?.provision === "string" &&
        allowedCategories.has(rule.provision),
    )
    .map((rule) => ({
      provision: rule.provision,
      description:
        typeof rule.description === "string" ? rule.description : "",
      exclusions: Array.isArray(rule.exclusions)
        ? rule.exclusions.filter((item) => typeof item === "string")
        : [],
    }));
  const categories = definitions.map((definition) => definition.provision);
  if (!categories.length) return res.status(200).json({ findings: [] });

  try {
    const extracted = await runGeneralPurposeExtractor({
      text,
      agreementType,
      definitions,
    });
    if (extracted) return res.status(200).json(extracted);
  } catch {
    // The optional classifier can be tried next. The browser still owns the
    // deterministic/manual fallback if both hosted services are unavailable.
  }

  try {
    const classified = await runCuadClassifier({
      text,
      agreementType,
      categories,
    });
    if (classified) return res.status(200).json(classified);
  } catch {
    // Let the client use deterministic/manual fallback.
  }
  return res.status(503).json({ error: "Hosted analysis is disabled" });
}
