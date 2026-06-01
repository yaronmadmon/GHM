import OpenAI from "openai";

let _client: OpenAI | null = null;
function getOpenAI() {
  _client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export type ExpenseField =
  | "property_tax"
  | "water_sewer"
  | "electricity"
  | "gas"
  | "insurance"
  | "mortgage"
  | "hoa"
  | "other_expense"
  | null;

export type BillingPeriod = "monthly" | "quarterly" | "annual" | "unknown";

export type LegalSubtype =
  | "court_summons"      // court summons, subpoena, order to appear
  | "eviction_filing"   // eviction complaint, unlawful detainer, dispossessory
  | "lawsuit"           // civil complaint, lawsuit, legal action filed against owner
  | "lien"              // mechanic's lien, tax lien, judgment lien
  | "code_violation"    // municipal/building code violation, health inspection failure
  | "demand_letter"     // attorney demand letter, formal written demand
  | "shut_off_warning"  // utility shut-off / termination warning
  | "past_due_notice"   // past-due / delinquency notice from vendor or municipality
  | "violation_notice"  // HOA violation, lease violation, zoning notice
  | "other_notice"      // any other notice not fitting above
  | null;               // not a notice/legal document

export interface ParsedDocument {
  confidence_score: number;
  extracted_data: {
    property_id: string | null;
    property_name_found: string | null;
    document_type: "utility" | "maintenance" | "tax" | "insurance" | "legal" | "notice" | "other";
    /** Fine-grained classification for notices and legal documents */
    legal_subtype: LegalSubtype;
    vendor: string | null;
    /** Current period charges ONLY — never the total-due or past-due balance */
    amount: number | null;
    /** Past-due / overdue balance shown on the document, separate from current charges */
    past_due_amount: number | null;
    /** True when the document is primarily a past-due / delinquency / shut-off / legal notice */
    is_past_due_notice: boolean;
    issue_date: string | null;
    due_date: string | null;
    expense_field: ExpenseField;
    billing_period: BillingPeriod;
  };
  flags: {
    is_amount_uncertain: boolean;
    requires_manual_split: boolean;
    extraction_notes: string;
  };
}

const SCHEMA_DESCRIPTION = `
Return a JSON object with exactly this structure:
{
  "confidence_score": <number 0-1>,
  "extracted_data": {
    "property_id": <string id from properties list, or null if no confident match>,
    "property_name_found": <string name/address found on document, or null>,
    "document_type": <one of: "utility" | "maintenance" | "tax" | "insurance" | "legal" | "notice" | "other">,
    "legal_subtype": <one of the legal subtypes below, or null if not a notice/legal document>,
    "vendor": <string vendor/issuer/plaintiff/agency name, or null>,
    "amount": <number — CURRENT PERIOD charges only, or null. See amount rules below.>,
    "past_due_amount": <number — any past-due/overdue balance shown, or null>,
    "is_past_due_notice": <boolean — true if document is primarily a delinquency/shut-off/legal notice>,
    "issue_date": <string "YYYY-MM-DD" or null>,
    "due_date": <string "YYYY-MM-DD" — for legal docs use the response/hearing/compliance deadline if present>,
    "expense_field": <one of the expense fields below, or null>,
    "billing_period": <one of: "monthly" | "quarterly" | "annual" | "unknown">
  },
  "flags": {
    "is_amount_uncertain": <boolean>,
    "requires_manual_split": <boolean — true if document covers multiple properties>,
    "extraction_notes": <string — any caveats, deadlines, or action items the owner should know>
  }
}

legal_subtype values — assign the most specific one that applies:
- "court_summons"     → court summons, subpoena, order to show cause, order to appear in court
- "eviction_filing"   → eviction complaint, unlawful detainer, dispossessory warrant, summary possession
- "lawsuit"           → civil complaint, lawsuit, legal action filed against the property owner or LLC
- "lien"              → mechanic's lien, materialman's lien, tax lien, judgment lien filed on the property
- "code_violation"    → building code violation, fire code violation, health/housing inspection failure, city/municipal notice of violation
- "demand_letter"     → formal attorney demand letter, cease-and-desist, written legal demand for payment or action
- "shut_off_warning"  → utility shut-off notice, termination of service warning (gas, electric, water)
- "past_due_notice"   → past-due / delinquency notice from a vendor, lender, or municipality (not a court filing)
- "violation_notice"  → HOA violation notice, lease violation warning, zoning violation, regulatory notice
- "other_notice"      → any other notice, warning, or demand that requires owner attention but doesn't fit above
- null                → regular bill, receipt, insurance policy, tax document, or other non-notice document

document_type rules:
- Court filing, lawsuit, lien → "legal"
- Past-due notice, shut-off, code violation, demand letter, HOA violation → "notice"
- Regular utility/tax/insurance/maintenance bill → use that specific type
- Unknown → "other"

CRITICAL — amount extraction rules:
Many bills show multiple dollar figures. You MUST separate them correctly:
- "amount" = ONLY the current billing period's new charges (e.g., "Current Charges: $200")
- "past_due_amount" = any overdue balance carried forward (e.g., "Past Due: $2,000")
- For legal documents, "amount" = the amount being claimed/demanded, "past_due_amount" = null
- NEVER use "Total Amount Due" as amount if it includes a past-due component
- If only one total exists with no breakdown, use it as amount; set past_due_amount null

expense_field mapping (only for regular recurring bills, not notices/legal docs):
- Property tax → "property_tax" | Water/sewer → "water_sewer" | Electric → "electricity"
- Gas → "gas" | Insurance → "insurance" | Mortgage → "mortgage" | HOA → "hoa"
- Other recurring → "other_expense" | Notice/legal/one-time → null

extraction_notes — for legal documents ALWAYS include:
- Any deadline, hearing date, or response-by date mentioned
- The nature of the claim or violation
- Any specific action required (appear in court, pay by X, remedy violation by X)

Property matching rules — CRITICAL:
- The property_id you return determines which folder the document is filed into. Get this right.
- Match on ANY of: street number, street name, city, zip, account number, service address, property name
- Street number + street name alone = confident match
- Utility bills always have a service address — extract and match it
- If portfolio has one property and doc appears property-related, match it
- Only return null if document is clearly unrelated to any listed property
- When uncertain between two properties, pick the closest match rather than returning null
`;

async function extractPdfText(base64: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require("pdf2json");
  const buf = Buffer.from(base64, "base64");
  return new Promise<string>((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    parser.on("pdfParser_dataError", (e: { parserError: unknown }) => reject(e.parserError));
    parser.on(
      "pdfParser_dataReady",
      (data: { Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }) => {
        const pages = data.Pages ?? [];
        const text = pages
          .map((page) => {
            const items = (page.Texts ?? [])
              .map((t) => ({
                x: "x" in t ? Number((t as { x?: number }).x ?? 0) : 0,
                y: "y" in t ? Number((t as { y?: number }).y ?? 0) : 0,
                text: decodeURIComponent(t.R?.[0]?.T ?? ""),
              }))
              .sort((a, b) => (Math.abs(a.y - b.y) < 0.25 ? a.x - b.x : a.y - b.y));
            const lines: string[] = [];
            let current = "";
            let lastY: number | null = null;
            for (const item of items) {
              if (lastY !== null && Math.abs(item.y - lastY) > 0.25) {
                if (current.trim()) lines.push(current.trim());
                current = "";
              }
              current += `${current ? " " : ""}${item.text}`;
              lastY = item.y;
            }
            if (current.trim()) lines.push(current.trim());
            return lines.join("\n");
          })
          .join("\n");
        resolve(text);
      },
    );
    parser.parseBuffer(buf);
  });
}

export async function parsePropertyDocument(
  fileBase64: string,
  mimeType: string,
  properties: { id: string; name: string; address: string }[],
): Promise<ParsedDocument> {
  const propertiesList =
    properties.length > 0
      ? properties.map((p) => `- ID: ${p.id} | Name: ${p.name} | Address: ${p.address}`).join("\n")
      : "(no properties in portfolio yet)";

  const systemPrompt =
    `You are a real estate document parsing engine for a property management company. ` +
    `Analyze this document and extract structured data.\n\n` +
    `You must correctly identify ALL types of documents landlords receive: utility bills, ` +
    `tax documents, insurance, maintenance invoices, court summonses, eviction filings, ` +
    `lawsuits, liens, code violations, demand letters, shut-off notices, and HOA/lease violations. ` +
    `For legal documents, extract any deadlines or required actions into extraction_notes.\n\n` +
    `Match the property using ANY identifying info on the document. ` +
    `Street number + street name alone is enough for a confident match.\n\n` +
    `Known properties:\n${propertiesList}\n\n` +
    SCHEMA_DESCRIPTION;

  let messages: OpenAI.ChatCompletionMessageParam[];

  if (mimeType === "application/pdf") {
    let textContent = "(PDF text extraction failed — no readable text found)";
    try {
      textContent = await extractPdfText(fileBase64);
    } catch {
      // fall through
    }
    messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Document text content:\n${textContent.slice(0, 8000)}` },
    ];
  } else {
    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${fileBase64}`, detail: "high" },
          },
        ],
      },
    ];
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("Empty response from OpenAI");
  const parsed = JSON.parse(content) as ParsedDocument;

  // Ensure new fields exist even if model omitted them
  if (parsed.extracted_data) {
    parsed.extracted_data.past_due_amount ??= null;
    parsed.extracted_data.is_past_due_notice ??= false;
    parsed.extracted_data.legal_subtype ??= null;
  }

  return parsed;
}
