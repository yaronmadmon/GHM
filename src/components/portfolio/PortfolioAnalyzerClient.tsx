"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  DollarSign,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type Snapshot = {
  generatedAt: string;
  propertyDetails?: {
    id: string;
    name: string;
    address: string;
    unitCount: number;
    occupiedUnits: number;
    occupancyRate: number;
    monthlyRentRoll: number;
    monthlyExpenses: number | null;
    openMaintenanceCount: number;
    overdueTenantCount: number;
    overdueBalance: number;
  }[];
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
    currentMonthlyNet: number;
    knownRecurringExpensesMonthly: number;
  };
  financials: {
    trailingTwelveMonths: {
      income: number;
      expenses: number;
      net: number;
      expenseRatio: number | null;
    };
    yearToDate: { income: number; expenses: number; net: number };
    currentMonth: { income: number; rentCollected: number; expenses: number; net: number };
    expensesByCategory: { category: string; amount: number; count: number }[];
    expensesByProperty: { propertyName: string; amount: number; count: number }[];
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
  dataSources?: Record<string, { source: string; confidence: string }>;
  dataQuality?: {
    missingExpenseProperties: string[];
    partialExpenseProperties: { propertyName: string; missing: string[] }[];
    warnings: string[];
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
  advisorPlan?: {
    coachBrief: string[];
    potential: {
      today: {
        monthlyRentRoll: number;
        monthlyCollectedRent: number;
        currentMonthlyNet: number;
        occupancyRate: number;
        outstandingBalance: number;
      };
      ifExecuted: {
        monthlyRentRoll: number;
        vacancyMonthlyUpside: number;
        monthlyExpenseSavingsTarget: number;
        projectedMonthlyNet: number;
        annualUpside: number;
        collectionTarget30: number;
      };
      assumptions: string[];
    };
    priorities: {
      title: string;
      directive: string;
      why: string;
      impact: string;
      source: string;
      confidence: string;
    }[];
    dataConfidence: Record<string, { source: string; confidence: string }>;
    dataWarnings: string[];
  };
};

type PropertyAnalysis = {
  propertyId: string;
  healthScore: number;
  priority: "good" | "attention" | "critical";
  issues: string[];
  opportunities: string[];
  summary: string;
};

type Result = {
  snapshot: Snapshot;
  analysis: Analysis;
  propertyAnalyses?: PropertyAnalysis[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SavedPlan = {
  id: string;
  title: string;
  createdAt: string;
  score: number;
  projectedMonthlyUpside: string;
  summary: string;
  nextActions: string[];
};

const RESULT_KEY = "ghm.financialAdvisor.result.v2";
const CHAT_KEY = "ghm.financialAdvisor.chat.v2";
const SAVED_PLANS_KEY = "ghm.financialAdvisor.savedPlans";

function categoryLabel(value: string) {
  return value.replace(/_/g, " ");
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function PortfolioAnalyzerClient() {
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

  useEffect(() => {
    setResult(loadJson<Result | null>(RESULT_KEY, null));
    setMessages(loadJson<ChatMessage[]>(CHAT_KEY, []));
    setSavedPlans(loadJson<SavedPlan[]>(SAVED_PLANS_KEY, []));
  }, []);

  useEffect(() => {
    if (result) window.localStorage.setItem(RESULT_KEY, JSON.stringify(result));
  }, [result]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(savedPlans));
  }, [savedPlans]);


  async function runAnalysis() {
    setLoading(true);
    try {
      const response = await fetch("/api/portfolio-analysis", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to analyze portfolio");
      setResult(data);
      if (messages.length === 0) {
        setMessages([
          {
            role: "assistant",
            content: "I reviewed the portfolio snapshot. Start with the brief and action plan, then ask me where you want to go deeper.",
          },
        ]);
      }
      toast.success("Financial advisor refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to analyze portfolio");
    } finally {
      setLoading(false);
    }
  }

  async function askAdvisor(e?: FormEvent<HTMLFormElement>, prompt?: string) {
    e?.preventDefault();
    const text = (prompt ?? question).trim();
    if (!text) return;
    if (!result) {
      toast.error("Run the advisor first so it can use the latest portfolio data");
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setQuestion("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/portfolio-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          question: text,
          history: messages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Advisor could not answer");
      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Advisor could not answer");
      setMessages(nextMessages);
    } finally {
      setChatLoading(false);
    }
  }

  function saveCurrentPlan() {
    if (!result) return;
    const plan: SavedPlan = {
      id: crypto.randomUUID(),
      title: result.analysis.projectPlan.name,
      createdAt: new Date().toISOString(),
      score: result.analysis.priorityScore,
      projectedMonthlyUpside: result.analysis.projectPlan.projectedMonthlyUpside,
      summary: result.analysis.executiveSummary[0] ?? result.analysis.projectPlan.goal,
      nextActions: result.analysis.nextActions.slice(0, 5),
    };
    setSavedPlans((plans) => [plan, ...plans].slice(0, 8));
    toast.success("Action plan saved");
  }

  function clearConversation() {
    setMessages([]);
    toast.success("Conversation cleared");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">Financial Advisor</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A portfolio coach that watches vacancy, collections, expenses, cash flow, maintenance, and rent opportunity.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={saveCurrentPlan} disabled={!result} variant="outline">
                  <Bookmark className="h-4 w-4" />
                  Save plan
                </Button>
                <Button onClick={runAnalysis} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {result ? "Refresh advisor" : "Run advisor"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {!result ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center">
                <Bot className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-3 text-base font-semibold">Your advisor is ready</h3>
                <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                  Run the advisor to produce a brief, risk map, opportunity queue, and operating plan from live portfolio data.
                </p>
                <Button onClick={runAnalysis} disabled={loading} className="mt-5">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Start financial review
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-4 w-4" /> Portfolio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.snapshot.portfolio.propertyCount}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.snapshot.portfolio.occupiedUnits}/{result.snapshot.portfolio.unitCount} occupied
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-4 w-4" /> Rent roll
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(result.snapshot.portfolio.monthlyActualRentRoll)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">current monthly rent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-4 w-4" /> Cash flow
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${result.snapshot.financials.trailingTwelveMonths.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(result.snapshot.financials.trailingTwelveMonths.net)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">trailing 12-month net</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Wrench className="h-4 w-4" /> Operations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.snapshot.risks.openMaintenanceCount}</div>
                    <p className="mt-1 text-xs text-muted-foreground">open maintenance items</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Coach brief</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(result.analysis.advisorPlan?.coachBrief ?? result.analysis.executiveSummary).slice(0, 3).map((item) => (
                      <div key={item} className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio potential</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Today rent roll</p>
                        <p className="mt-1 text-xl font-semibold">{formatCurrency(result.analysis.advisorPlan?.potential.today.monthlyRentRoll ?? result.snapshot.portfolio.monthlyActualRentRoll)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{result.snapshot.portfolio.occupancyRate}% occupied</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-500/5 p-3">
                        <p className="text-xs text-muted-foreground">Potential rent roll</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-600">{formatCurrency(result.analysis.advisorPlan?.potential.ifExecuted.monthlyRentRoll ?? result.snapshot.portfolio.monthlyPotentialRent)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(result.snapshot.portfolio.vacancyLossMonthly)}/mo vacancy upside</p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Potential if plan is executed</p>
                      <p className="mt-1 text-sm">
                        Monthly net could move from <span className="font-semibold">{formatCurrency(result.snapshot.portfolio.currentMonthlyNet)}</span> toward{" "}
                        <span className="font-semibold text-emerald-600">{formatCurrency(result.analysis.advisorPlan?.potential.ifExecuted.projectedMonthlyNet ?? result.snapshot.portfolio.currentMonthlyNet + result.snapshot.portfolio.vacancyLossMonthly)}</span>,
                        based only on visible vacancy upside and recorded expense opportunities.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {(result.analysis.advisorPlan?.priorities ?? result.analysis.focusAreas).slice(0, 3).map((area) => (
                  <Card key={area.title} className="border-primary/10">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">{area.title}</CardTitle>
                        <Badge variant="secondary" className="capitalize">{"confidence" in area ? area.confidence : area.urgency}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {"directive" in area && <p className="text-sm font-medium">{area.directive}</p>}
                      <p className="text-sm text-muted-foreground">{area.why}</p>
                      <p className="text-sm font-medium">{area.impact}</p>
                      {"source" in area && <p className="text-xs text-muted-foreground">Source: {area.source}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>{result.analysis.projectPlan.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{result.analysis.projectPlan.goal}</p>
                    <div className="rounded-lg border bg-emerald-500/5 p-3">
                      <p className="text-xs text-muted-foreground">Projected monthly upside</p>
                      <p className="text-xl font-semibold text-emerald-600">{result.analysis.projectPlan.projectedMonthlyUpside}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {result.analysis.projectPlan.phases.map((phase) => (
                        <div key={phase.name} className="rounded-lg border p-3">
                          <h3 className="text-sm font-semibold">{phase.name}</h3>
                          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                            {phase.actions.slice(0, 3).map((action) => (
                              <li key={action} className="flex gap-2">
                                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Opportunity queue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.analysis.nextActions.slice(0, 5).map((action) => (
                      <div key={action} className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p>{action}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Data confidence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.analysis.advisorPlan?.dataWarnings.length ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-500/5 p-3 text-sm text-amber-800">
                      {result.analysis.advisorPlan.dataWarnings[0]}
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      No major missing-data warnings in the current snapshot.
                    </div>
                  )}
                  <div className="grid gap-2 md:grid-cols-2">
                    {Object.entries(result.analysis.advisorPlan?.dataConfidence ?? result.snapshot.dataSources ?? {}).map(([key, value]) => (
                      <div key={key} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium capitalize">{categoryLabel(key)}</p>
                          <Badge variant={value.confidence === "high" ? "secondary" : "outline"} className="capitalize">{value.confidence}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{value.source}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </>
          )}
        </section>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Ask the advisor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Ask about vacancy loss, expense trends, rent strategy, collections, or what to do this week.
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`rounded-lg p-3 text-sm ${message.role === "user" ? "ml-6 bg-primary text-primary-foreground" : "mr-6 border bg-muted/20"}`}
                    >
                      {message.content}
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="mr-6 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                    Thinking through the portfolio...
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  "Where am I losing the most money?",
                  "What should I do this week?",
                  "Which vacancies should I prioritize?",
                ].map((prompt) => (
                  <Button key={prompt} type="button" variant="outline" size="xs" onClick={() => askAdvisor(undefined, prompt)} disabled={!result || chatLoading}>
                    {prompt}
                  </Button>
                ))}
              </div>

              <form onSubmit={askAdvisor} className="space-y-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a follow-up..."
                  className="min-h-24 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={!result || chatLoading || !question.trim()} className="flex-1">
                    <Send className="h-4 w-4" />
                    Ask
                  </Button>
                  <Button type="button" variant="outline" onClick={clearConversation} disabled={messages.length === 0}>
                    Clear
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                Saved plans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedPlans.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Save advisor-generated action plans to revisit later.
                </p>
              ) : (
                savedPlans.map((plan) => (
                  <details key={plan.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">{plan.title}</summary>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                        <span>Score {plan.score}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.summary}</p>
                      <p className="text-sm font-medium text-emerald-600">{plan.projectedMonthlyUpside} monthly upside</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {plan.nextActions.map((action) => <li key={action}>{action}</li>)}
                      </ul>
                    </div>
                  </details>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {result?.propertyAnalyses?.length ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Property Health
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...result.propertyAnalyses]
              .sort((a, b) => {
                const order = { critical: 0, attention: 1, good: 2 };
                return order[a.priority] - order[b.priority];
              })
              .map((pa) => {
                const detail = result.snapshot.propertyDetails?.find((p) => p.id === pa.propertyId);
                const noi = detail && detail.monthlyExpenses !== null
                  ? detail.monthlyRentRoll - detail.monthlyExpenses
                  : null;
                const scoreColor =
                  pa.healthScore >= 80 ? "text-emerald-600" :
                  pa.healthScore >= 60 ? "text-amber-500" : "text-destructive";
                const borderColor =
                  pa.priority === "good" ? "border-emerald-500/30" :
                  pa.priority === "attention" ? "border-amber-500/30" : "border-destructive/30";
                const badgeClass =
                  pa.priority === "good" ? "bg-emerald-500/10 text-emerald-600" :
                  pa.priority === "attention" ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive";
                return (
                  <Card key={pa.propertyId} className={`border ${borderColor}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold truncate">{detail?.name ?? "Property"}</CardTitle>
                          <p className="text-xs text-muted-foreground truncate">{detail?.address ?? ""}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xl font-bold ${scoreColor}`}>{pa.healthScore}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
                            {pa.priority}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {detail && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="text-muted-foreground">Occupancy</div>
                          <div className="text-right font-medium">{detail.occupancyRate}%</div>
                          <div className="text-muted-foreground">Rent roll</div>
                          <div className="text-right font-medium">{formatCurrency(detail.monthlyRentRoll)}/mo</div>
                          {noi !== null && (
                            <>
                              <div className="text-muted-foreground">Est. NOI</div>
                              <div className={`text-right font-medium ${noi >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                {formatCurrency(noi)}/mo
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {pa.issues.length > 0 && (
                        <div className="space-y-1">
                          {pa.issues.map((issue) => (
                            <div key={issue} className="flex items-start gap-1.5 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {pa.opportunities.length > 0 && (
                        <div className="space-y-1">
                          {pa.opportunities.map((opp) => (
                            <div key={opp} className="flex items-start gap-1.5 text-xs text-emerald-600">
                              <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{opp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground border-t pt-2">{pa.summary}</p>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ) : null}

      {result?.analysis.caveats?.length ? (
        <p className="text-xs text-muted-foreground">{result.analysis.caveats.join(" ")}</p>
      ) : null}
    </div>
  );
}
