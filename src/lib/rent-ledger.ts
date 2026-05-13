type MoneyLike = number | string | { toString(): string } | null | undefined;

export interface LedgerRentPayment {
  amountDue: MoneyLike;
  amountPaid: MoneyLike;
  periodYear?: number;
  periodMonth?: number;
}

export interface LedgerTransaction {
  type: string;
  amount: MoneyLike;
  description?: string | null;
  date?: Date | string;
  createdAt?: Date | string;
}

function toNumber(value: MoneyLike) {
  return Number(value ?? 0);
}

export function calculateLeaseBalance(input: {
  rentPayments: LedgerRentPayment[];
  transactions: LedgerTransaction[];
}) {
  const transactionBalance = input.transactions.reduce((sum, transaction) => {
    const amount = toNumber(transaction.amount);
    return sum + (transaction.type === "income" ? amount : -amount);
  }, 0);

  return Math.round((calculateLeaseRentBalance(input) + transactionBalance) * 100) / 100;
}

function timestamp(value: Date | string | undefined) {
  return value ? new Date(value).getTime() || 0 : 0;
}

export function getLatestImportedRunningBalance(transactions: LedgerTransaction[]) {
  const rows = transactions
    .map((transaction) => {
      const match = transaction.description?.match(/\(balance: \$(-?[\d,.]+)\)/);
      if (!match) return null;
      return {
        balance: Number(match[1].replace(/,/g, "")),
        date: timestamp(transaction.date),
        createdAt: timestamp(transaction.createdAt),
      };
    })
    .filter((row): row is { balance: number; date: number; createdAt: number } => Boolean(row));

  if (!rows.length) return null;

  rows.sort((a, b) => a.date - b.date || a.createdAt - b.createdAt);
  return rows.at(-1)?.balance ?? null;
}

export function calculateLeaseOutstandingBalance(input: {
  rentPayments: LedgerRentPayment[];
  transactions: LedgerTransaction[];
}) {
  const importedBalance = getLatestImportedRunningBalance(input.transactions);
  if (importedBalance !== null) return Math.round(importedBalance * 100) / 100;
  return calculateLeaseBalance(input);
}

export function calculateLeaseRentBalance(input: {
  rentPayments: LedgerRentPayment[];
}) {
  const rentBalance = input.rentPayments.reduce(
    (sum, payment) => sum + toNumber(payment.amountDue) - toNumber(payment.amountPaid),
    0,
  );

  return Math.round(rentBalance * 100) / 100;
}
