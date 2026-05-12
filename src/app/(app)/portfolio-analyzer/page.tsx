import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortfolioAnalyzerClient } from "@/components/portfolio/PortfolioAnalyzerClient";

export default async function PortfolioAnalyzerPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Financial Advisor</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          AI-assisted financial coaching for portfolio health, risk, and operating decisions.
        </p>
      </div>
      <PortfolioAnalyzerClient />
    </div>
  );
}
