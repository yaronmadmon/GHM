type MoneyLike = number | string | { toString(): string } | null | undefined;

export interface LedgerRentPayment {
  amountDue: MoneyLike;
  amountPaid: MoneyLike;
  periodYear?: number;
  periodMonth?: number;
}

export interface LedgerTransaction {
  type: string;
  category?: string | null;
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
  const transactionBalance = input.transactions
    .filter((transaction) => transaction.category !== "rent")
    .reduce((sum, transaction) => {
      const amount = toNumber(transaction.amount);
      return sum + (transaction.type === "income" ? amount : -amount);
    }, 0);

  return Math.round((calculateLeaseRentBalance(input) + transactionBalance) * 100) / 100;
}

export function calculateLeaseOutstandingBalance(input: {
  rentPayments: LedgerRentPayment[];
  transactions: LedgerTransaction[];
}) {
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
