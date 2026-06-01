export const APPLICATION_STATUSES = [
  "pending",
  "documents_requested",
  "under_review",
  "screening",
  "approved",
  "denied",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const REQUIRED_APPLICATION_DOCUMENT_TYPES = [
  "government_id",
  "pay_stub",
  "bank_statement",
] as const;

export const REQUIRED_APPLICATION_DOCUMENT_LABELS: Record<string, string> = {
  government_id: "Government ID",
  pay_stub: "Pay stub / proof of income",
  bank_statement: "Bank statement",
};

export type ApplicationWorkflowDoc = {
  docType: string | null;
};

export type ApplicationWorkflowRecord = {
  status: string;
  email: string | null;
  backgroundCheckStatus: string | null;
  documents: ApplicationWorkflowDoc[];
};

export function missingRequiredApplicationDocuments(documents: ApplicationWorkflowDoc[]) {
  const present = new Set(documents.map((doc) => doc.docType).filter(Boolean));
  return REQUIRED_APPLICATION_DOCUMENT_TYPES.filter((type) => !present.has(type));
}

export function applicationRequirements(application: ApplicationWorkflowRecord) {
  const missingDocuments = missingRequiredApplicationDocuments(application.documents);
  const blockers = [
    !application.email ? "Applicant email is required." : null,
    missingDocuments.length
      ? `Required documents missing: ${missingDocuments.map((type) => REQUIRED_APPLICATION_DOCUMENT_LABELS[type]).join(", ")}.`
      : null,
    !["passed", "conditional"].includes(application.backgroundCheckStatus ?? "")
      ? "Screening must be marked passed or conditional."
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    missingDocuments,
    screeningOk: ["passed", "conditional"].includes(application.backgroundCheckStatus ?? ""),
    blockers,
  };
}

export function validateApplicationStatusTransition(
  application: ApplicationWorkflowRecord,
  nextStatus: ApplicationStatus,
) {
  const current = application.status as ApplicationStatus;
  const { missingDocuments, screeningOk } = applicationRequirements(application);

  if (current === nextStatus) return { ok: true, blockers: [] as string[] };
  if (current === "approved") return { ok: false, blockers: ["Approved applications cannot be moved backward."] };
  if (nextStatus === "approved") return { ok: false, blockers: ["Use the convert endpoint to approve an application."] };
  if (nextStatus === "denied") return { ok: true, blockers: [] as string[] };

  const allowedNext: Record<ApplicationStatus, ApplicationStatus[]> = {
    pending: ["documents_requested"],
    documents_requested: ["under_review"],
    under_review: ["screening"],
    screening: [],
    approved: [],
    denied: [],
  };

  const blockers: string[] = [];
  if (!allowedNext[current]?.includes(nextStatus)) {
    blockers.push(`Invalid status transition: ${current} -> ${nextStatus}.`);
  }
  if ((nextStatus === "under_review" || nextStatus === "screening") && missingDocuments.length) {
    blockers.push(
      `Required documents missing: ${missingDocuments.map((type) => REQUIRED_APPLICATION_DOCUMENT_LABELS[type]).join(", ")}.`,
    );
  }
  if (nextStatus === "screening" && !application.email) {
    blockers.push("Applicant email is required before screening.");
  }
  if (current === "screening" && !screeningOk) {
    blockers.push("Screening must pass or be conditional before moving forward.");
  }

  return { ok: blockers.length === 0, blockers };
}
