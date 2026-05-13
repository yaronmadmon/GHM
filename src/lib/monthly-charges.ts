type ChargeLike = {
  amount: unknown;
  isActive?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

export function isMonthlyChargeActiveForPeriod(
  charge: ChargeLike,
  year: number,
  month: number,
) {
  if (charge.isActive === false) return false;
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);
  const startsOn = charge.startDate ? new Date(charge.startDate) : null;
  const endsOn = charge.endDate ? new Date(charge.endDate) : null;
  if (startsOn && startsOn > periodEnd) return false;
  if (endsOn && endsOn < periodStart) return false;
  return true;
}

export function monthlyChargeTotalForPeriod(
  charges: ChargeLike[],
  year: number,
  month: number,
) {
  return charges
    .filter((charge) => isMonthlyChargeActiveForPeriod(charge, year, month))
    .reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0);
}

export function leaseMonthlyDueForPeriod(
  rentAmount: unknown,
  charges: ChargeLike[],
  year: number,
  month: number,
) {
  return Number(rentAmount ?? 0) + monthlyChargeTotalForPeriod(charges, year, month);
}
