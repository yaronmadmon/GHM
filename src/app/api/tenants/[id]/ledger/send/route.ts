import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { sendLedgerReport } from "@/lib/email";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: unknown) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { organizationId } = await requireOrg();

    const body = await req.json();
    const { recipientEmail, recipientName, message } = body as {
      recipientEmail: string;
      recipientName?: string;
      message?: string;
    };

    if (!recipientEmail?.trim()) {
      return Response.json({ error: "recipientEmail is required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: {
        leaseLinks: {
          include: {
            lease: {
              include: {
                unit: { include: { property: true } },
                rentPayments: { orderBy: { dueDate: "asc" } },
                transactions: { orderBy: { date: "asc" } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
    const tenantName = `${tenant.firstName} ${tenant.lastName}`;

    // Build ledger HTML for email
    interface LedgerRow { date: Date; description: string; charges: number; payments: number; balance: number; status?: string; }
    const rows: LedgerRow[] = [];

    if (activeLease) {
      const rawRows: Omit<LedgerRow, "balance">[] = [];

      for (const p of activeLease.rentPayments) {
        rawRows.push({
          date: new Date(p.dueDate),
          description: `Rent — ${MONTHS[p.periodMonth - 1]} ${p.periodYear}${p.notes ? ` (${p.notes})` : ""}`,
          charges: Number(p.amountDue),
          payments: 0,
          status: p.status,
        });
        const paid = Number(p.amountPaid);
        if (paid > 0) {
          rawRows.push({
            date: p.paidAt ? new Date(p.paidAt) : new Date(p.dueDate),
            description: `Payment received${p.paymentMethod ? ` (${p.paymentMethod})` : ""}`,
            charges: 0,
            payments: paid,
            status: "paid",
          });
        }
      }

      for (const t of activeLease.transactions) {
        const amt = Number(t.amount);
        const desc = (t.description ?? `${t.category.replace(/_/g, " ")} — ${t.type}`).replace(/^\[Imported\] /, "");
        rawRows.push({
          date: new Date(t.date),
          description: desc,
          charges: t.type === "income" ? amt : 0,
          payments: t.type === "expense" ? amt : 0,
        });
      }

      rawRows.sort((a, b) => a.date.getTime() - b.date.getTime());

      let balance = 0;
      for (const r of rawRows) {
        balance = balance + r.charges - r.payments;
        rows.push({ ...r, balance });
      }
    }

    const totalCharges = rows.reduce((s, r) => s + r.charges, 0);
    const totalPayments = rows.reduce((s, r) => s + r.payments, 0);
    const currentBalance = totalCharges - totalPayments;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const ledgerHtml = `
      <div style="font-size:13px;font-family:monospace">
        <h3 style="font-family:sans-serif;margin-bottom:4px">Tenant: ${tenantName}</h3>
        ${tenant.email ? `<p style="font-family:sans-serif;color:#666;margin:2px 0">${tenant.email}</p>` : ""}
        ${tenant.phone ? `<p style="font-family:sans-serif;color:#666;margin:2px 0">${tenant.phone}</p>` : ""}
        ${activeLease ? `
          <h3 style="font-family:sans-serif;margin-top:16px;margin-bottom:4px">Property: ${activeLease.unit.property.name}</h3>
          <p style="font-family:sans-serif;color:#666;margin:2px 0">${activeLease.unit.property.addressLine1}, Unit ${activeLease.unit.unitNumber}</p>
          <p style="font-family:sans-serif;color:#666;margin:2px 0">${activeLease.unit.property.city}, ${activeLease.unit.property.state} ${activeLease.unit.property.zip}</p>
          <p style="font-family:sans-serif;margin:4px 0">Lease: ${fmtDate(activeLease.startDate)} – ${activeLease.endDate ? fmtDate(activeLease.endDate) : "Month-to-month"} · ${fmt(activeLease.rentAmount)}/mo</p>
        ` : ""}
        <table style="width:100%;border-collapse:collapse;margin-top:20px">
          <thead>
            <tr style="background:#f0f0f0">
              <th style="text-align:left;padding:8px 6px;font-family:sans-serif;font-size:11px;text-transform:uppercase">Date</th>
              <th style="text-align:left;padding:8px 6px;font-family:sans-serif;font-size:11px;text-transform:uppercase">Description</th>
              <th style="text-align:right;padding:8px 6px;font-family:sans-serif;font-size:11px;text-transform:uppercase">Charges</th>
              <th style="text-align:right;padding:8px 6px;font-family:sans-serif;font-size:11px;text-transform:uppercase">Payments</th>
              <th style="text-align:right;padding:8px 6px;font-family:sans-serif;font-size:11px;text-transform:uppercase">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? "#fff" : "#fafafa"}${r.status === "overdue" ? ";background:#fff5f5" : ""}">
                <td style="padding:7px 6px;border-bottom:1px solid #eee;white-space:nowrap;color:#666">${fmtDate(r.date)}</td>
                <td style="padding:7px 6px;border-bottom:1px solid #eee">${r.description}${r.status && r.status !== "paid" && r.charges > 0 ? ` <span style="color:${r.status === "overdue" ? "#dc2626" : "#666"};font-size:11px">[${r.status}]</span>` : ""}</td>
                <td style="padding:7px 6px;border-bottom:1px solid #eee;text-align:right">${r.charges > 0 ? fmt(r.charges) : "—"}</td>
                <td style="padding:7px 6px;border-bottom:1px solid #eee;text-align:right;color:#16a34a">${r.payments > 0 ? fmt(r.payments) : "—"}</td>
                <td style="padding:7px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:${r.balance > 0 ? "#dc2626" : "#16a34a"}">${fmt(r.balance)}</td>
              </tr>
            `).join("")}
            <tr style="font-weight:700;border-top:2px solid #ccc">
              <td colspan="2" style="padding:9px 6px;font-family:sans-serif">Total</td>
              <td style="padding:9px 6px;text-align:right">${fmt(totalCharges)}</td>
              <td style="padding:9px 6px;text-align:right;color:#16a34a">${fmt(totalPayments)}</td>
              <td style="padding:9px 6px;text-align:right;color:${currentBalance > 0 ? "#dc2626" : "#16a34a"}">${fmt(currentBalance)}</td>
            </tr>
          </tbody>
        </table>
        <p style="font-family:sans-serif;font-size:12px;color:#999;margin-top:16px">Prepared by ${org?.name ?? ""} on ${today}. All figures in USD.</p>
      </div>
    `;

    await sendLedgerReport({
      to: recipientEmail.trim(),
      toName: recipientName,
      tenantName,
      orgName: org?.name ?? "",
      ledgerHtml,
      message,
    });

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unauthorized")) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
