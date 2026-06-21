import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  Landmark,
  Shield,
  Wallet,
  TrendingUp,
  CalendarDays,
  IndianRupee,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  YEARS,
  formatMoney,
  normalizeDebt,
  normalizeLic,
  filterBySelectedYear,
  getTotalPaid,
} from "../utils/financeNormalize";
import { calculatePolicyNetValue, getMaturityValue } from "../utils/policyUtils";

export default function NetWorthPage({ selectedYear, setSelectedYear }) {
  const { user } = useAuth();

  const [debts, setDebts] = useState([]);
  const [licPolicies, setLicPolicies] = useState([]);
  const [cashAssets, setCashAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    const debtsRef = collection(db, "users", user.uid, "debts");
    const debtsQuery = query(debtsRef, where("year", "==", selectedYear));

    const licRef = collection(db, "users", user.uid, "licPolicies");
    const cashRef = collection(db, "users", user.uid, "cashAssets");

    const unsubDebts = onSnapshot(
      debtsQuery,
      (snap) => {
        const debtRows = snap.docs.map((doc) =>
          normalizeDebt({ id: doc.id, ...doc.data() })
        );
        setDebts(debtRows);
      },
      (err) => {
        console.error("Debts load error", err);
        setDebts([]);
      }
    );

    const unsubLic = onSnapshot(
      licRef,
      (snap) => {
        const licRows = snap.docs.map((doc) =>
          normalizeLic({ id: doc.id, ...doc.data() })
        );
        setLicPolicies(licRows);
      },
      (err) => {
        console.error("LIC load error", err);
        setLicPolicies([]);
      }
    );

    const unsubCash = onSnapshot(
      cashRef,
      (snap) => {
        const cashRows = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          amount: Number(doc.data()?.amount || 0),
          year: Number(doc.data()?.year || 0),
        }));
        setCashAssets(cashRows);
        setLoading(false);
      },
      (err) => {
        console.error("Cash assets load error", err);
        setCashAssets([]);
        setLoading(false);
      }
    );

    return () => {
      unsubDebts();
      unsubLic();
      unsubCash();
    };
  }, [user?.uid, selectedYear]);

  const filteredLicPolicies = useMemo(() => {
    return filterBySelectedYear(licPolicies, selectedYear);
  }, [licPolicies, selectedYear]);

  const filteredCashAssets = useMemo(() => {
    return filterBySelectedYear(cashAssets, selectedYear);
  }, [cashAssets, selectedYear]);

  const totals = useMemo(() => {
    const totalDebt = debts.reduce(
      (sum, d) => sum + Number(d.currentBalance || 0),
      0
    );

    const activeLicValue = filteredLicPolicies.reduce((sum, p) => {
      return sum + calculatePolicyNetValue(p);
    }, 0);

    const totalLicPaid = filteredLicPolicies.reduce(
      (sum, p) => sum + Number(getTotalPaid(p) || 0),
      0
    );

    const totalCash = filteredCashAssets.reduce(
      (sum, a) => sum + Number(a.amount || 0),
      0
    );

    const totalAssets = totalCash + activeLicValue;
    const netWorth = totalAssets - totalDebt;

    return {
      totalDebt,
      activeLicValue,
      totalLicPaid,
      totalCash,
      totalAssets,
      netWorth,
    };
  }, [debts, filteredLicPolicies, filteredCashAssets]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center px-4">
        <p className="text-xl text-purple-200">
          {selectedYear} net worth loading...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-300">
          Net Worth
        </h1>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-purple-100">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-black/40 border border-purple-500 rounded-lg px-3 py-1 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Cash Assets"
          value={formatMoney(totals.totalCash)}
          icon={<Wallet className="w-5 h-5" />}
        />
        <SummaryCard
          title="LIC Current Value"
          value={formatMoney(totals.activeLicValue)}
          icon={<Shield className="w-5 h-5" />}
        />
        <SummaryCard
          title="Debt Balance"
          value={formatMoney(totals.totalDebt)}
          icon={<Landmark className="w-5 h-5" />}
        />
        <SummaryCard
          title="Net Worth"
          value={formatMoney(totals.netWorth)}
          icon={<TrendingUp className="w-5 h-5" />}
          highlight
        />
      </div>

      <Section
        title={`Assets vs Liabilities – ${selectedYear}`}
        icon={<IndianRupee className="w-5 h-5" />}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <InfoBlock
            label="Total Assets"
            value={formatMoney(totals.totalAssets)}
            tone="emerald"
          />
          <InfoBlock
            label="Total Liabilities"
            value={formatMoney(totals.totalDebt)}
            tone="red"
          />
          <InfoBlock
            label="LIC Total Paid"
            value={formatMoney(totals.totalLicPaid)}
            tone="cyan"
          />
          <InfoBlock
            label="Net Worth"
            value={formatMoney(totals.netWorth)}
            tone="amber"
          />
        </div>
      </Section>

      <Section title="Debt Snapshot" icon={<CalendarDays className="w-5 h-5" />}>
        {debts.length === 0 ? (
          <p className="text-sm text-gray-200">
            No debt records found for {selectedYear}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/20 bg-black/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 py-2 text-left">Lender</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Monthly Payment</th>
                  <th className="px-3 py-2 text-center">Due Day</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <tr key={d.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{d.lender}</td>
                    <td className="px-3 py-2 text-right text-amber-300">
                      {formatMoney(d.currentBalance)}
                    </td>
                    <td className="px-3 py-2 text-right text-cyan-300">
                      {formatMoney(d.monthlyPayment)}
                    </td>
                    <td className="px-3 py-2 text-center">{d.dueDay || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="LIC Snapshot" icon={<Shield className="w-5 h-5" />}>
        {filteredLicPolicies.length === 0 ? (
          <p className="text-sm text-gray-200">No LIC policy records found.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/20 bg-black/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 py-2 text-left">Policy</th>
                  <th className="px-3 py-2 text-right">Total Paid</th>
                  <th className="px-3 py-2 text-right">Estimated Bonus</th>
                  <th className="px-3 py-2 text-right">Maturity Value</th>
                  <th className="px-3 py-2 text-right">Visible Loan</th>
                  <th className="px-3 py-2 text-right">Current Value</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLicPolicies.map((p) => {
                  const totalPaid = getTotalPaid(p);

                  const estimatedBonus = Number(
                    p.estimatedBonus ?? p.estBonus ?? p.bonus ?? p.bonusAmount ?? 0
                  ) || 0;

                  const visibleLoanPrincipal = Number(
                    p.loanPrincipal ?? p.policyLoan ?? p.loan ?? 0
                  );

                  const currentValue = calculatePolicyNetValue(p);

                  const maturityValue = getMaturityValue(p);

                  return (
                    <tr key={p.id} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        {p.policyName || p.plan || p.name || "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-cyan-300">
                        {formatMoney(totalPaid)}
                      </td>
                      <td className="px-3 py-2 text-right text-purple-300">
                        {formatMoney(estimatedBonus)}
                      </td>
                      <td className="px-3 py-2 text-right text-violet-300">
                        {formatMoney(maturityValue)}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-300">
                        {formatMoney(visibleLoanPrincipal)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-300 font-semibold">
                        {formatMoney(currentValue)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.policyStatus || "Active"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function SummaryCard({ title, value, icon, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg shadow-black/30 ${
        highlight
          ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-300/30"
          : "bg-white/10 border-white/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-2 text-purple-100">
        {icon}
        <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value, tone = "cyan" }) {
  const toneMap = {
    emerald: "text-emerald-300",
    red: "text-red-300",
    cyan: "text-cyan-300",
    amber: "text-amber-300",
  };

  return (
    <div className="rounded-xl border border-white/20 bg-white/5 p-4">
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 md:p-7 mb-6 shadow-lg shadow-black/30">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-lg md:text-xl font-semibold text-purple-100">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}