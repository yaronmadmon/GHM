export type HealthLevel = "healthy" | "needs_attention" | "high_risk";

export interface PropertyHealthInput {
  totalUnits: number;
  occupiedUnits: number;
  openMaintenanceCount: number;
  emergencyMaintenanceCount: number;
  overdueRentCount: number;
  expiringLeaseCount: number; // within 30 days
}

export function computePropertyHealth(data: PropertyHealthInput): {
  level: HealthLevel;
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  if (data.totalUnits > 0) {
    const vacancyRate = (data.totalUnits - data.occupiedUnits) / data.totalUnits;
    if (vacancyRate > 0.5) {
      score += 2;
      reasons.push(`${Math.round(vacancyRate * 100)}% vacancy`);
    } else if (vacancyRate > 0.2) {
      score += 1;
      reasons.push(`${Math.round(vacancyRate * 100)}% vacancy`);
    }
  }

  if (data.emergencyMaintenanceCount > 0) {
    score += 2;
    reasons.push(`${data.emergencyMaintenanceCount} emergency maintenance`);
  } else if (data.openMaintenanceCount >= 5) {
    score += 1;
    reasons.push(`${data.openMaintenanceCount} open maintenance requests`);
  }

  if (data.overdueRentCount >= 3) {
    score += 2;
    reasons.push(`${data.overdueRentCount} overdue payments`);
  } else if (data.overdueRentCount > 0) {
    score += 1;
    reasons.push(`${data.overdueRentCount} overdue payment${data.overdueRentCount > 1 ? "s" : ""}`);
  }

  if (data.expiringLeaseCount > 0) {
    score += 1;
    reasons.push(`${data.expiringLeaseCount} lease${data.expiringLeaseCount > 1 ? "s" : ""} expiring soon`);
  }

  const level: HealthLevel =
    score === 0 ? "healthy" : score <= 2 ? "needs_attention" : "high_risk";

  return { level, score, reasons };
}

export const HEALTH_STYLES: Record<HealthLevel, string> = {
  healthy: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  needs_attention: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  high_risk: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
};

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  healthy: "Healthy",
  needs_attention: "Needs Attention",
  high_risk: "High Risk",
};
