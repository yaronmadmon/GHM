import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index);
    const value = line.slice(index + 1).replace(/^["']|["']$/g, "");
    process.env[key] = process.env[key] ?? value;
  }
}

const prisma = new PrismaClient();
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const runId = `codex-smoke-${Date.now()}`;
const results = [];

function record(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function api(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function expectStatus(name, promise, status) {
  const { res, data } = await promise;
  const passed = res.status === status;
  record(name, passed, passed ? String(status) : `expected ${status}, got ${res.status}: ${JSON.stringify(data)}`);
  if (!passed) throw new Error(`${name} failed`);
  return data;
}

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found");
  const user = await prisma.user.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No user found");

  const property = await prisma.property.create({
    data: {
      organizationId: org.id,
      name: `Codex Smoke Property ${runId}`,
      addressLine1: "100 Smoke Test Ave",
      city: "Brooklyn",
      state: "NY",
      zip: "11230",
      propertyType: "single_family",
      unitCount: 1,
      status: "vacant",
      units: { create: { unitNumber: "1", status: "vacant" } },
    },
    include: { units: true },
  });
  const unit = property.units[0];
  const application = await prisma.application.create({
    data: {
      organizationId: org.id,
      propertyId: property.id,
      unitId: unit.id,
      firstName: "Codex",
      lastName: "Applicant",
      email: `${runId}@example.com`,
      phone: "555-0100",
      employerName: "Smoke Test LLC",
      monthlyIncome: 7200,
      desiredMoveInDate: new Date(),
      intendedLeaseTerm: "12 months",
      signedAt: new Date(),
      references: { create: { type: "landlord", name: "Prior Landlord", phone: "555-0101" } },
    },
  });
  await prisma.activityEvent.create({
    data: {
      organizationId: org.id,
      actorId: user.id,
      entityType: "application",
      entityId: application.id,
      eventType: "created",
      metadata: { action: "application_received", runId },
    },
  });
  record("sample application created", true, application.id);

  await expectStatus("open application detail API", api("GET", `/api/applications/${application.id}`), 200);
  await expectStatus("invalid pending -> screening jump is blocked", api("PATCH", `/api/applications/${application.id}`, { status: "screening" }), 400);
  await expectStatus("request documents", api("PATCH", `/api/applications/${application.id}`, { status: "documents_requested" }), 200);
  await expectStatus("add pay stub document", api("POST", `/api/applications/${application.id}/documents`, { name: "Pay stub", url: `https://example.com/${runId}/pay-stub.pdf`, docType: "pay_stub" }), 201);
  await expectStatus("under_review blocked until all required docs", api("PATCH", `/api/applications/${application.id}`, { status: "under_review" }), 400);
  await expectStatus("add government ID", api("POST", `/api/applications/${application.id}/documents`, { name: "Government ID", url: `https://example.com/${runId}/id.pdf`, docType: "government_id" }), 201);
  await expectStatus("add bank statement", api("POST", `/api/applications/${application.id}/documents`, { name: "Bank statement", url: `https://example.com/${runId}/bank.pdf`, docType: "bank_statement" }), 201);
  await expectStatus("move to under_review", api("PATCH", `/api/applications/${application.id}`, { status: "under_review" }), 200);
  await expectStatus("move to screening", api("PATCH", `/api/applications/${application.id}`, { status: "screening" }), 200);
  await expectStatus("conversion blocked until screening passes", api("POST", `/api/applications/${application.id}/convert`, { startDate: "2026-07-01", rentAmount: 1800, depositAmount: 1800 }), 400);
  await expectStatus("set screening result", api("PATCH", `/api/applications/${application.id}`, { backgroundCheckStatus: "passed", backgroundCheckNotes: "Smoke test passed", backgroundCheckDate: "2026-06-01" }), 200);
  const converted = await expectStatus("approve and convert to tenant/lease", api("POST", `/api/applications/${application.id}/convert`, { startDate: "2026-07-01", rentAmount: 1800, depositAmount: 1800 }), 201);
  await expectStatus("move-in blocked before fully signed lease", api("POST", `/api/leases/${converted.lease.id}/move-in`), 400);

  await prisma.lease.update({
    where: { id: converted.lease.id },
    data: { signingStatus: "fully_signed", tenantSignedAt: new Date(), landlordSignedAt: new Date() },
  });
  await expectStatus("confirm move-in", api("POST", `/api/leases/${converted.lease.id}/move-in`), 200);

  const finalApp = await prisma.application.findUnique({
    where: { id: application.id },
    include: { documents: true, convertedTenant: true, convertedLease: true },
  });
  record("final status persisted", finalApp?.status === "approved", finalApp?.status ?? "missing");
  record("required documents persisted", (finalApp?.documents.length ?? 0) >= 3, `${finalApp?.documents.length ?? 0} docs`);
  record("screening persisted", finalApp?.backgroundCheckStatus === "passed", finalApp?.backgroundCheckStatus ?? "missing");
  record("tenant record created", Boolean(finalApp?.convertedTenantId && finalApp.convertedTenant), finalApp?.convertedTenantId ?? "missing");
  record("lease record created", Boolean(finalApp?.convertedLeaseId && finalApp.convertedLease), finalApp?.convertedLeaseId ?? "missing");
  record("move-in persisted", finalApp?.convertedLease?.moveInCompleted === true, String(finalApp?.convertedLease?.moveInCompleted));

  const events = await prisma.activityEvent.findMany({
    where: { organizationId: org.id, entityType: "application", entityId: application.id },
    orderBy: { createdAt: "asc" },
  });
  const eventSummary = events.map((event) => `${event.eventType}:${event.metadata && typeof event.metadata === "object" && "action" in event.metadata ? event.metadata.action : event.metadata && typeof event.metadata === "object" && "to" in event.metadata ? event.metadata.to : ""}`);
  record("activity log contains major steps", events.length >= 8 && eventSummary.some((e) => e.includes("application_received")) && eventSummary.some((e) => e.includes("approved")) && eventSummary.some((e) => e.includes("move_in_confirmed")), eventSummary.join(", "));

  const toolsSource = fs.readFileSync("src/lib/ai/tools.ts", "utf8");
  const handlersSource = fs.readFileSync("src/lib/ai/handlers.ts", "utf8");
  for (const name of ["list_applications", "get_application", "advance_application_status", "set_screening_status", "add_application_document", "approve_application_and_create_lease", "confirm_move_in"]) {
    record(`AI tool declared: ${name}`, toolsSource.includes(`name: "${name}"`));
    record(`AI handler wired: ${name}`, handlersSource.includes(`case "${name}"`));
  }

  const failures = results.filter((result) => !result.passed);
  console.log(`\nSMOKE_APPLICATION_ID=${application.id}`);
  console.log(`SMOKE_TENANT_ID=${finalApp?.convertedTenantId ?? ""}`);
  console.log(`SMOKE_LEASE_ID=${finalApp?.convertedLeaseId ?? ""}`);
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
