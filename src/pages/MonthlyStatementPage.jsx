import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  CalendarDays,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
  BadgePercent,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { formatMoney } from "../utils/financeNormalize";

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const normalizeDate = (value) => {
  if (!value) return null;

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (value?.toDate && typeof value.toDate === "function") {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const formatDisplayDate = (value) => {
  const d = normalizeDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("en-IN");
};

export default function MonthlyStatementPage({
  selectedYear = new Date().getFullYear(),
}) {
  const { user } = useAuth();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [incomeInput, setIncomeInput] = useState(0);
  const [incomeSaved, setIncomeSaved] = useState(0);

  const [debts, setDebts] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [monthlyDocs, setMonthlyDocs] = useState([]);

  const [loading, setLoading] = useState(true);

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label || "January";

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    const debtsRef = collection(db, `users/${user.uid}/debts`);
    const tracksRef = collection(db, `users/${user.uid}/tracks`);
    const monthlyRef = collection(db, `users/${user.uid}/monthly`);
    const statementMetaRef = doc(
      db,
      `users/${user.uid}/statementMeta/${selectedYear}-${selectedMonth}`
    );

    const unsubDebts = onSnapshot(
      debtsRef,
      (snap) => {
        setDebts(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => console.error("Debts load error", err)
    );

    const unsubTracks = onSnapshot(
      tracksRef,
      (snap) => {
        setTracks(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => console.error("Tracks load error", err)
    );

    const unsubMonthly = onSnapshot(
      monthlyRef,
      (snap) => {
        setMonthlyDocs(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => console.error("Monthly load error", err)
    );

    const unsubMeta = onSnapshot(
      statementMetaRef,
      (snap) => {
        const data = snap.data() || {};
        const savedIncome = Number(data.income || 0);
        setIncomeSaved(savedIncome);
        setIncomeInput(savedIncome);
        setLoading(false);
      },
      (err) => {
        console.error("Statement meta load error", err);
        setLoading(false);
      }
    );

    return () => {
      unsubDebts();
      unsubTracks();
      unsubMonthly();
      unsubMeta();
    };
  }, [user?.uid, selectedYear, selectedMonth]);

  const handleSaveIncome = async () => {
    if (!user?.uid) return;

    try {
      await setDoc(
        doc(db, `users/${user.uid}/statementMeta/${selectedYear}-${selectedMonth}`),
        {
          year: Number(selectedYear),
          month: selectedMonth,
          monthLabel: selectedMonthLabel,
          income: Number(incomeInput || 0),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      alert("Monthly income saved");
    } catch (err) {
      console.error(err);
      alert("Income save failed");
    }
  };

  const filteredDebts = useMemo(() => {
    return debts.filter((item) => Number(item.year) === Number(selectedYear));
  }, [debts, selectedYear]);

  const filteredTracks = useMemo(() => {
    return tracks.filter((item) => {
      const itemMonth = String(item.month || item.monthName || "").toLowerCase();
      const itemYear = Number(item.year || 0);

      if (
        itemMonth === String(selectedMonthLabel).toLowerCase() &&
        itemYear === Number(selectedYear)
      ) {
        return true;
      }

      const d = normalizeDate(item.date || item.createdAt);
      if (!d) return false;

      const y = d.getFullYear();
      const m = d.toLocaleString("en-US", { month: "long" });

      return Number(y) === Number(selectedYear) && m === selectedMonthLabel;
    });
  }, [tracks, selectedYear, selectedMonthLabel]);

  const filteredMonthlyDocs = useMemo(() => {
    return monthlyDocs.filter((item) => {
      const sameYear = Number(item.year || 0) === Number(selectedYear);
      const sameMonth =
        String(item.month || "").toLowerCase() ===
          String(selectedMonthLabel).toLowerCase() ||
        String(item.id || "").includes(`${selectedYear}-${selectedMonthLabel}`);

      return sameYear && sameMonth;
    });
  }, [monthlyDocs, selectedYear, selectedMonthLabel]);

  const totals = useMemo(() => {
    const trackSpent = filteredTracks.reduce(
      (sum, item) =>
        sum +
        Number(item.amount ?? item.total ?? item.spent ?? item.value ?? 0),
      0
    );

    const monthlySpent = filteredMonthlyDocs.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const debtBalance = filteredDebts.reduce(
      (sum, item) => sum + Number(item.currentBalance || item.amount || 0),
      0
    );

    const totalExpenses = trackSpent + monthlySpent;
    const netCashFlow = Number(incomeSaved || 0) - totalExpenses;
    const savingsRate =
      Number(incomeSaved || 0) > 0
        ? (netCashFlow / Number(incomeSaved || 0)) * 100
        : 0;

    return {
      income: Number(incomeSaved || 0),
      trackSpent,
      monthlySpent,
      debtBalance,
      totalExpenses,
      netCashFlow,
      savingsRate,
    };
  }, [filteredTracks, filteredMonthlyDocs, filteredDebts, incomeSaved]);

  const combinedTransactions = useMemo(() => {
    const trackRows = filteredTracks.map((item) => ({
      id: `track-${item.id}`,
      source: "Track",
      item:
        item.title ||
        item.name ||
        item.category ||
        item.label ||
        `${selectedMonthLabel} Track`,
      date:
        item.date ||
        item.createdAt ||
        `${selectedYear}-${selectedMonth}-01`,
      amount: Number(
        item.amount ?? item.total ?? item.spent ?? item.value ?? 0
      ),
      tone: "text-amber-300",
    }));

    const monthlyRows = filteredMonthlyDocs.map((item) => ({
      id: `monthly-${item.id}`,
      source: "Monthly",
      item: `${item.month || selectedMonthLabel} Expenditure`,
      date: `${item.year || selectedYear}-${selectedMonth}-01`,
      amount: Number(item.amount || 0),
      tone: "text-cyan-300",
    }));

    return [...trackRows, ...monthlyRows].sort((a, b) => {
      const da = normalizeDate(a.date);
      const db = normalizeDate(b.date);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
  }, [
    filteredTracks,
    filteredMonthlyDocs,
    selectedMonth,
    selectedMonthLabel,
    selectedYear,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading monthly statement...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Monthly Statement</h1>
          <p className="text-sm text-white/60 mt-2">
            Review your monthly inflow, outflow, and spending breakdown in one report.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <CalendarDays className="w-4 h-4" />
            Statement Month
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#08112b] border border-blue-900/70 rounded-2xl px-4 py-3 text-sm"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}, {selectedYear}
                </option>
              ))}
            </select>

            <button
              onClick={() => window.print()}
              className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs text-white/60 mb-2">
                Manual Monthly Income
              </label>
              <input
                type="number"
                value={incomeInput}
                onChange={(e) => setIncomeInput(Number(e.target.value || 0))}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3"
                placeholder="Enter monthly income"
              />
            </div>

            <button
              onClick={handleSaveIncome}
              className="px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-sm font-medium"
            >
              Save Income
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Income"
            value={formatMoney(totals.income)}
            icon={<TrendingUp className="w-4 h-4" />}
            tone="emerald"
          />
          <StatCard
            title="Expenses"
            value={formatMoney(totals.totalExpenses)}
            icon={<TrendingDown className="w-4 h-4" />}
            tone="rose"
          />
          <StatCard
            title="Net Cash Flow"
            value={formatMoney(totals.netCashFlow)}
            icon={<Wallet className="w-4 h-4" />}
            tone={totals.netCashFlow >= 0 ? "emerald" : "cyan"}
          />
          <StatCard
            title="Savings Rate"
            value={`${totals.savingsRate.toFixed(1)}%`}
            icon={<BadgePercent className="w-4 h-4" />}
            tone="cyan"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 mb-6">
          <SectionCard
            title={`${selectedMonthLabel} ${selectedYear}`}
            subtitle="Category-wise statement summary"
            extra={`${combinedTransactions.length} entries`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MiniSummary label="Debt Balance" value={formatMoney(totals.debtBalance)} />
              <MiniSummary label="Tracks" value={formatMoney(totals.trackSpent)} />
              <MiniSummary label="Monthly" value={formatMoney(totals.monthlySpent)} />
              <MiniSummary label="Balance" value={formatMoney(totals.netCashFlow)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Statement Notes"
            subtitle="This page summarizes one selected month."
          >
            <div className="rounded-2xl border border-blue-900/60 bg-[#07122d] p-4">
              <div className="text-cyan-300 text-sm font-medium mb-2">
                Statement view
              </div>
              <div className="text-sm text-white/70 leading-6">
                Income is manual for now. Monthly expenditure is synced from Firestore
                monthly docs, tracks are filtered using month/year or date fallback,
                and debt shows current year outstanding balance.
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Transactions"
          subtitle="All selected-month entries combined"
        >
          {combinedTransactions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/50">
              No statement entries found for this month.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.04] text-white/60">
                  <tr>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedTransactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-white/5">
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10">
                          {tx.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">{tx.item}</td>
                      <td className="px-4 py-3 text-white/60">
                        {formatDisplayDate(tx.date)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${tx.tone}`}>
                        {formatMoney(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, tone = "emerald" }) {
  const styles = {
    emerald: "bg-emerald-950/40 border-emerald-800/40 text-emerald-300",
    rose: "bg-rose-950/40 border-rose-800/40 text-rose-300",
    cyan: "bg-cyan-950/40 border-cyan-800/40 text-cyan-300",
  };

  return (
    <div className={`rounded-3xl border p-5 ${styles[tone]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/70">{title}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, extra, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-white/50 mt-1">{subtitle}</p>
          ) : null}
        </div>
        {extra ? (
          <div className="text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1 rounded-full">
            {extra}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function MiniSummary({ label, value }) {
  return (
    <div className="rounded-2xl border border-blue-900/50 bg-[#040b22] p-4">
      <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}