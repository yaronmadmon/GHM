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

export interface ParsedDocument {
  confidence_score: number;
  extracted_data: {
    property_id: string | null;
    property_name_found: string | null;
    document_type: "utility" | "maintenance" | "tax" | "insurance" | "legal" | "other";
    vendor: string | null;
    amount: number | null;
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
    "document_type": <one of: "utility" | "maintenance" | "tax" | "insurance" | "legal" | "other">,
    "vendor": <string vendor/issuer name, or null>,
    "amount": <number total amount on the document, or null>,
    "issue_date": <string "YYYY-MM-DD" or null>,
    "due_date": <string "YYYY-MM-DD" or null>,
    "expense_field": <one of: "property_tax" | "water_sewer" | "electricity" | "gas" | "insurance" | "mortgage" | "hoa" | "other_expense" | null — map to the specific recurring expense this represents>,
    "billing_period": <one of: "monthly" | "quarterly" | "annual" | "unknown">
  },
  "flags": {
    "is_amount_uncertain": <boolean>,
    "requires_manual_split": <boolean — true if document covers multiple properties>,
    "extraction_notes": <string — any caveats or notes about extraction>
  }
}

expense_field mapping rules:
- Property tax bill → "property_tax"
- Water, sewer, or water+sewer bill → "water_sewer"
- Electric/electricity bill → "electricity"
- Gas/natural gas bill → "gas"
- Homeowners, landlord, or property insurance → "insurance"
- Mortgage statement → "mortgage"
- HOA or condo fee → "hoa"
- Other recurring expense → "other_expense"
- One-time expense, receipt, maintenance invoice, or unknown → null

billing_period rules:
- Monthly bill → "monthly"
- Quarterly bill → "quarterly"
- Annual property tax or yearly bill → "annual"
- Not determinable → "unknown"
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
    `You are a real estate document parsing engine. Analyze this landlord document and extract structured data. ` +
    `Match the property to the known properties list using any identifying info on the document — property name, address, account number, or vendor service area. ` +
    `If no confident match exists, set property_id to null.\n\n` +
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
  return JSON.parse(content) as ParsedDocument;
}
