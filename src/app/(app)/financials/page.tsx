import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Plus, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function FinancialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ytdIncome, ytdExpenses, monthIncome, monthExpenses, recentTxns] = await Promise.all([
    prisma.transaction.aggregate({ where: { organizationId: session.user.organizationId, type: "income", date: { gte: startOfYear } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId: session.user.organizationId, type: "expense", date: { gte: startOfYear } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId: session.user.organizationId, type: "income", date: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId: session.user.organizationId, type: "expense", date: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { organizationId: session.user.organizationId },
      include: { property: true },
      orderBy: { date: "desc" },
      take: 30,
    }),
  ]);

  const ytdNet = Number(ytdIncome._sum.amount ?? 0) - Number(ytdExpenses._sum.amount ?? 0);
  const monthNet = Number(monthIncome._sum.amount ?? 0) - Number(monthExpenses._sum.amount ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Financials</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Income & expense tracking</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          <Link href="/financials/new-transaction">
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Add transaction</Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Month Income</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{formatCurrency(Number(monthIncome._sum.amount ?? 0))}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Month Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(Number(monthExpenses._sum.amount ?? 0))}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Month Net</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-1 ${monthNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {monthNet >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {formatCurrency(Math.abs(monthNet))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">YTD Net</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${ytdNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(ytdNet))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 className="text-base font-semibold mb-3">Recent transactions</h2>
        {recentTxns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
            No transactions yet. Log income and expenses to track financials.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentTxns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(txn.date)}</td>
                    <td className="px-4 py-3 font-medium">{txn.description || txn.category}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">{txn.category.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{txn.property?.name ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${txn.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                      {txn.type === "expense" ? "−" : "+"}{formatCurrency(Number(txn.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
