import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EstimatedExpenses {
  propertyTaxMonthly: number | null;
  waterSewerMonthly: number | null;
  electricityMonthly: number | null;
  gasMonthly: number | null;
  insuranceMonthly: number | null;
}

interface SerperResult {
  organic?: { title: string; snippet: string; link: string }[];
}

async function serperSearch(query: string): Promise<SerperResult> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.SERPER_API_KEY ?? "",
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  if (!res.ok) return {};
  return res.json();
}

async function firecrawlScrape(url: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY ?? ""}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const text: string = data?.data?.markdown ?? "";
    return text.slice(0, 3000);
  } catch {
    return "";
  }
}

export async function estimatePropertyExpenses(property: {
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}): Promise<EstimatedExpenses> {
  const { addressLine1, city, state } = property;
  const location = `${city} ${state}`;

  // Run all searches in parallel
  const [taxResults, waterResults, electricResults, insuranceResults] = await Promise.all([
    serperSearch(`"${addressLine1}" ${location} property tax annual amount site:*.gov OR assessor`),
    serperSearch(`average monthly water sewer bill ${location}`),
    serperSearch(`average monthly electricity bill ${location}`),
    serperSearch(`average homeowners insurance ${state} per month 2025`),
  ]);

  // Scrape top tax result (county assessor pages have actual dollar amounts)
  const taxUrl = taxResults.organic?.[0]?.link ?? "";
  const taxPageContent = taxUrl ? await firecrawlScrape(taxUrl) : "";

  // Build context for OpenAI
  const formatSnippets = (r: SerperResult, label: string) =>
    (r.organic ?? [])
      .slice(0, 3)
      .map((s) => `[${label}] ${s.title}: ${s.snippet}`)
      .join("\n");

  const context = [
    taxPageContent ? `=== Property Tax Page (${taxUrl}) ===\n${taxPageContent}` : "",
    formatSnippets(taxResults, "Property Tax Search"),
    formatSnippets(waterResults, "Water/Sewer"),
    formatSnippets(electricResults, "Electricity"),
    formatSnippets(insuranceResults, "Insurance"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `You are extracting monthly expense estimates for a rental property at ${addressLine1}, ${location}.

Use ONLY the data below. Do not guess. Return null for any value you cannot find with reasonable confidence.
Return ONLY valid JSON, no explanation.

Data:
${context}

Return this exact JSON shape:
{
  "propertyTaxMonthly": <number or null>,
  "waterSewerMonthly": <number or null>,
  "electricityMonthly": <number or null>,
  "gasMonthly": <number or null>,
  "insuranceMonthly": <number or null>
}

Rules:
- propertyTaxMonthly: annual tax ÷ 12. If you see an annual figure, divide it.
- All values are monthly USD amounts (numbers, no $ signs).
- gasMonthly: return null if the area is likely warm-climate with no gas heating.
- Do not invent numbers. null is correct when data is absent.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 256,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);

    return {
      propertyTaxMonthly: typeof parsed.propertyTaxMonthly === "number" ? parsed.propertyTaxMonthly : null,
      waterSewerMonthly: typeof parsed.waterSewerMonthly === "number" ? parsed.waterSewerMonthly : null,
      electricityMonthly: typeof parsed.electricityMonthly === "number" ? parsed.electricityMonthly : null,
      gasMonthly: typeof parsed.gasMonthly === "number" ? parsed.gasMonthly : null,
      insuranceMonthly: typeof parsed.insuranceMonthly === "number" ? parsed.insuranceMonthly : null,
    };
  } catch {
    return {
      propertyTaxMonthly: null,
      waterSewerMonthly: null,
      electricityMonthly: null,
      gasMonthly: null,
      insuranceMonthly: null,
    };
  }
}
