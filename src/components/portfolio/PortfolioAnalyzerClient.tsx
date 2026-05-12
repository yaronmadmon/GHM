"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, Brain, DoorOpen, Loader2, RefreshCcw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type Snapshot = {
  generatedAt: string;
  portfolio: {
    propertyCount: number;
    unitCount: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    monthlyActualRentRoll: number;
    monthlyPotentialRent: number;
    vacancyLossMonthly: number;
    vacancyLossAnnual: number;
    medianActiveRent: number;
  };
  financials: {
    trailingTwelveMonths: {
      income: number;
      expenses: number;
      net: number;
      expenseRatio: number | null;
    };
    currentMonth: { income: number; expenses: number; net: number };
    expensesByCategory: { category: string; amount: number; count: number }[];
  };
  vacancies: {
    propertyName: string;
    unitNumber: string;
    daysVacant: number;
    lastRent: number | null;
    projectedRent: number;
    annualOpportunity: number;
  }[];
  risks: {
    overdueTenantCount: number;
    overdueBalance: number;
    openMaintenanceCount: number;
    emergencyMaintenanceCount: number;
    expiringLeaseCount: number;
    pendingApplicationCount: number;
  };
};

type Analysis = {
  executiveSummary: string[];
  priorityScore: number;
  focusAreas: { title: string; why: string; impact: string; urgency: string }[];
  projectPlan: {
    name: string;
    goal: string;
    projectedMonthlyUpside: string;
    phases: { name: string; actions: string[]; expectedOutcome: string }[];
  };
  rentStrategy: { unit: string; currentOrLastRent: string; suggestedRent: string; rationale: string }[];
  expenseWatchlist: { category: string; amount: string; recommendation: string }[];
  nextActions: string[];
  caveats: string[];
};

type Result = {
  snapshot: Snapshot;
  analysis: Analysis;
};

function urgencyVariant(urgency: string) {
  return urgency.toLowerCase() === "high" ? "destructive" : "secondary";
}

export function PortfolioAnalyzerClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function runAnalysis() {
    setLoading(true);
    try {
      const response = await fetch("/api/portfolio-analysis", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to analyze portfolio");
      setResult(data);
      toast.success("Portfolio analysis complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to analyze portfolio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Portfolio AI analyzer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review rent roll, vacancy loss, expenses, collections, maintenance, renewals, and applications in one pass.
            </p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="lg" className="w-full md:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : result ? <RefreshCcw className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
            {loading ? "Analyzing..." : result ? "Run again" : "Activate analyzer"}
          </Button>
        </CardContent>
      </Card>

      {!result && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-base font-semibold">No analysis yet</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Start the analyzer to generate a prioritized operating plan from the portfolio data already in GHM.
          </p>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DoorOpen className="h-4 w-4" /> Occupancy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.snapshot.portfolio.occupancyRate}%</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result.snapshot.portfolio.occupiedUnits} of {result.snapshot.portfolio.unitCount} units occupied
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> Rent upside
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(result.snapshot.portfolio.vacancyLossMonthly)}</div>
                <p className="mt-1 text-xs text-muted-foreground">monthly vacancy opportunity</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Expense ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {result.snapshot.financials.trailingTwelveMonths.expenseRatio == null
                    ? "N/A"
                    : `${result.snapshot.financials.trailingTwelveMonths.expenseRatio}%`}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">trailing 12 months</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> Risk score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.analysis.priorityScore}</div>
                <p className="mt-1 text-xs text-muted-foreground">higher means healthier</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Executive readout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.analysis.executiveSummary.map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{result.analysis.projectPlan.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{result.analysis.projectPlan.goal}</p>
                <div className="rounded-lg border bg-emerald-500/5 p-3">
                  <p className="text-xs text-muted-foreground">Projected monthly upside</p>
                  <p className="text-xl font-semibold text-emerald-600">{result.analysis.projectPlan.projectedMonthlyUpside}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {result.analysis.focusAreas.map((area) => (
              <Card key={area.title}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{area.title}</CardTitle>
                    <Badge variant={urgencyVariant(area.urgency)} className="capitalize">{area.urgency}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{area.why}</p>
                  <p className="text-sm font-medium">{area.impact}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Rent strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.analysis.rentStrategy.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vacant units to price right now.</p>
                ) : (
                  result.analysis.rentStrategy.map((unit) => (
                    <div key={unit.unit} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{unit.unit}</p>
                        <p className="font-mono text-sm text-emerald-600">{unit.suggestedRent}/mo</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Last/current: {unit.currentOrLastRent}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{unit.rationale}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense watchlist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.analysis.expenseWatchlist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses are recorded for the trailing 12 months.</p>
                ) : (
                  result.analysis.expenseWatchlist.map((expense) => (
                    <div key={expense.category} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium capitalize">{expense.category.replace("_", " ")}</p>
                        <p className="font-mono text-sm">{expense.amount}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{expense.recommendation}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Project phases</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {result.analysis.projectPlan.phases.map((phase) => (
                <div key={phase.name} className="rounded-lg border p-4">
                  <h3 className="font-semibold">{phase.name}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {phase.actions.map((action) => (
                      <li key={action} className="flex gap-2">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-medium">{phase.expectedOutcome}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {result.analysis.nextActions.map((action) => (
                <div key={action} className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>{action}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {result.analysis.caveats.length > 0 && (
            <p className="text-xs text-muted-foreground">{result.analysis.caveats.join(" ")}</p>
          )}
        </>
      )}
    </div>
  );
}
