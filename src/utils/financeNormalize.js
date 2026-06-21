export const YEARS = [2025, 2026, 2027];

export const formatMoney = (n) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN")}`;

export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = String(dateStr).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function getTotalPaid(p = {}) {
  const stored = Number(p.totalPaid ?? 0);
  if (stored > 0) return stored;

  const premium = Number(p.premiumAmount ?? 0);
  const paidPremiums = Number(p.paidPremiums ?? 0);

  if (premium > 0 && paidPremiums > 0) {
    return premium * paidPremiums;
  }

  const start = parseLocalDate(p.startDate);
  if (!start || Number.isNaN(start.getTime()) || premium <= 0) return 0;

  const today = new Date();
  let yearsPaid = today.getFullYear() - start.getFullYear();

  const beforeAnniversary =
    today.getMonth() < start.getMonth() ||
    (today.getMonth() === start.getMonth() && today.getDate() < start.getDate());

  if (beforeAnniversary) yearsPaid -= 1;

  yearsPaid = Math.max(0, yearsPaid + 1);
  return premium * yearsPaid;
}

export function normalizeDebt(d = {}) {
  return {
    id: d.id,
    lender: d.lender || d.name || "Debt",
    currentBalance: Number(
      d.currentBalance ?? d.amount ?? d.remainingBalance ?? 0
    ),
    monthlyPayment: Number(
      d.monthlyPayment ?? d.monthlyDue ?? d.payment ?? 0
    ),
    dueDay: d.dueDay ?? null,
    dueDate: d.dueDate ?? null,
    startDate: d.startDate ?? null,
    interestRate: Number(d.interestRate ?? d.rate ?? 0),
    year: Number(d.year ?? 0),
    raw: d,
  };
}

export function normalizeLic(p = {}) {
  const totalPaid = getTotalPaid(p);

  return {
    id: p.id,
    policyName: p.policyName ?? p.planName ?? "LIC Policy",
    totalPaid,
    premiumPaid: totalPaid,
    estimatedBonus: Number(p.bonusEstimate ?? p.bonus ?? 0),
    loanPrincipal: Number(p.loanPrincipal ?? p.loan ?? 0),
    loanTrackedInDebt: Boolean(p.loanTrackedInDebt ?? false),
    maturityValue: Number(p.maturityValue ?? 0),
    premiumAmount: Number(p.premiumAmount ?? 0),
    paidPremiums: Number(p.paidPremiums ?? 0),
    premiumFrequency: p.premiumFrequency ?? "Yearly",
    startDate: p.startDate ?? null,
    policyStatus: p.policyStatus ?? "Active",
    year: Number(p.year ?? 0),
    raw: p,
  };
}

export function filterBySelectedYear(items = [], selectedYear) {
  return items.filter((item) => {
    if (!item?.year) return true;
    return Number(item.year) === Number(selectedYear);
  });
}