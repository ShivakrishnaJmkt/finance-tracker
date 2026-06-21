import { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import {
  CreditCard,
  Clock,
  Download,
  Wallet,
  DatabaseBackup,
  CalendarDays,
  Upload,
  Save,
  TrendingDown,
  BadgeIndianRupee,
} from "lucide-react";
import { YEARS, formatMoney } from "../utils/financeNormalize";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#8dd1e1",
  "#a4de6c",
  "#d0ed57",
  "#ff9ff3",
];

const todayStr = () => new Date().toISOString().split("T")[0];

const monthKeyFromDate = (dateStr) => {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

const calculateDebtFreeMonths = (balance, monthlyPayment) => {
  const b = Number(balance || 0);
  const p = Number(monthlyPayment || 0);
  if (b <= 0 || p <= 0) return null;
  return Math.ceil(b / p);
};

const formatDebtFreeDate = (months) => {
  if (!months) return "N/A";
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
};

export default function DebtPage({ selectedYear, setSelectedYear }) {
  const { user } = useAuth();

  const [debts, setDebts] = useState([]);
  const [history, setHistory] = useState([]);
  const [viewMode, setViewMode] = useState("analytics");

  const [loadingData, setLoadingData] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [statementPreview, setStatementPreview] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;

    setLoadingData(true);
    setError("");

    const debtsCol = collection(db, "users", user.uid, "debts");
    const historyCol = collection(db, "users", user.uid, "debtHistory");

    const debtsQuery = query(debtsCol, where("year", "==", selectedYear));
    const historyQuery = query(historyCol, where("year", "==", selectedYear));

    const unsubscribeDebts = onSnapshot(
      debtsQuery,
      (snapshot) => {
        const debtsData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          repayInput: "",
          repayDate: todayStr(),
          repayNote: "",
        }));
        setDebts(debtsData);
        setLoadingData(false);
      },
      (err) => {
        console.error("Debts listener error:", err);
        setError("Debt data load అవడంలో సమస్య వచ్చింది.");
        setLoadingData(false);
      }
    );

    const unsubscribeHistory = onSnapshot(
      historyQuery,
      (snapshot) => {
        const historyData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setHistory(historyData);
      },
      (err) => {
        console.error("History listener error:", err);
      }
    );

    return () => {
      unsubscribeDebts();
      unsubscribeHistory();
    };
  }, [user?.uid, selectedYear]);

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setUploading(true);
    setError("");

    try {
      const debtsCol = collection(db, "users", user.uid, "debts");

      const oldSnap = await getDocs(
        query(debtsCol, where("year", "==", selectedYear))
      );
      const delBatch = writeBatch(db);
      oldSnap.docs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const wb = XLSX.read(new Uint8Array(evt.target.result), {
            type: "array",
          });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet);

          const batch = writeBatch(db);

          rows.forEach((r) => {
            const lender = String(r.Lender || r.lender || "").trim();
            const amount = Number(r.amount || r.Amount || 0);
            const monthlyDue = Number(r.monthlyDue || r.MonthlyDue || 0);
            const dueDay = Number(r.dueDay || r.DueDay || 0);

            if (!lender || amount <= 0) return;
            if (lender.toLowerCase() === "total") return;

            const ref = doc(debtsCol, `${selectedYear}_${lender}`);
            batch.set(
              ref,
              {
                lender,
                amount,
                currentBalance: amount,
                monthlyDue: monthlyDue || 0,
                dueDay: dueDay || 1,
                year: selectedYear,
                status: "active",
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          });

          await batch.commit();
          alert("Excel uploaded successfully");
        } catch (err) {
          console.error(err);
          setError("Excel process error");
        } finally {
          setUploading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleAddRow = () => {
    setDebts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        lender: "",
        amount: 0,
        currentBalance: 0,
        monthlyDue: 0,
        dueDay: 1,
        year: selectedYear,
        repayInput: "",
        repayDate: todayStr(),
        repayNote: "",
      },
    ]);
  };

  const handleCellChange = (rowIndex, field, value) => {
    setDebts((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex
          ? {
              ...row,
              [field]:
                field === "amount" ||
                field === "currentBalance" ||
                field === "monthlyDue" ||
                field === "dueDay"
                  ? Number(value || 0)
                  : value,
            }
          : row
      )
    );
  };

  const handleSaveDebtsToCloud = async () => {
    if (!user?.uid) {
      alert("User not found");
      return;
    }

    try {
      const batch = writeBatch(db);
      const debtsCol = collection(db, "users", user.uid, "debts");

      debts.forEach((row) => {
        const lender = String(row.lender || "").trim();
        const amount = Number(row.amount || row.currentBalance || 0);
        const currentBalance = Number(row.currentBalance || row.amount || 0);
        const monthlyDue = Number(row.monthlyDue || 0);
        const dueDay = Number(row.dueDay || 1);

        if (!lender) return;

        const ref = doc(debtsCol, `${selectedYear}_${lender}`);
        batch.set(
          ref,
          {
            lender,
            amount,
            currentBalance,
            monthlyDue,
            dueDay,
            year: selectedYear,
            status: row.status || "active",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      alert("Debt values synced to cloud successfully");
    } catch (error) {
      console.error("Cloud sync failed:", error);
      alert("Failed to sync debts to cloud");
    }
  };

  const handleRepay = async (rowIndex) => {
    const row = debts[rowIndex];
    if (!row || !user?.uid) return;

    const repayAmount = Number(row.repayInput || 0);
    const paymentDate = row.repayDate || todayStr();
    const note = String(row.repayNote || "").trim();

    const baseBalance = Number(row.currentBalance || row.amount || 0);

    if (repayAmount <= 0) {
      alert("Repay amount ఇవ్వండి.");
      return;
    }

    if (repayAmount > baseBalance) {
      alert("Repay amount current debt కన్నా ఎక్కువగా ఉండకూడదు.");
      return;
    }

    try {
      const debtsCol = collection(db, "users", user.uid, "debts");
      const historyCol = collection(db, "users", user.uid, "debtHistory");
      const lenderClean = String(row.lender || "").trim();
      const debtId = `${row.year || selectedYear}_${lenderClean}`;
      const debtRef = doc(debtsCol, debtId);

      await runTransaction(db, async (transaction) => {
        const debtSnap = await transaction.get(debtRef);
        if (!debtSnap.exists()) {
          throw new Error("Debt document not found");
        }

        const currentData = debtSnap.data();
        const oldAmount = Number(
          currentData.currentBalance || currentData.amount || 0
        );
        const newAmount = Math.max(oldAmount - repayAmount, 0);

        if (newAmount === 0) {
          transaction.set(
            debtRef,
            {
              currentBalance: 0,
              amount: 0,
              status: "closed",
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          transaction.set(
            debtRef,
            {
              lender: lenderClean,
              amount: newAmount,
              currentBalance: newAmount,
              year: row.year || selectedYear,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }

        const historyRef = doc(historyCol);
        transaction.set(historyRef, {
          debtId,
          lender: lenderClean,
          paidAmount: repayAmount,
          paid: repayAmount,
          oldAmount,
          newAmount,
          paymentDate,
          paymentMonth: monthKeyFromDate(paymentDate),
          monthKey: monthKeyFromDate(paymentDate),
          year: selectedYear,
          note,
          createdAt: serverTimestamp(),
        });
      });

      alert("Payment saved ✅");
    } catch (err) {
      console.error("Repay error", err);
      alert("Payment save కాలేదు.");
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        userId: user?.uid || null,
        year: selectedYear,
        debts: debts.map(({ repayInput, repayDate, repayNote, ...rest }) => rest),
        history,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, `debt-backup-${selectedYear}.json`);
    } catch (err) {
      console.error(err);
      alert("Backup download కాలేదు.");
    }
  };

  const filteredStatement = useMemo(() => {
    return history
      .filter((h) => {
        const d = h.paymentDate || h.date || "";
        if (statementFrom && d < statementFrom) return false;
        if (statementTo && d > statementTo) return false;
        return true;
      })
      .sort((a, b) =>
        String(a.paymentDate || "").localeCompare(String(b.paymentDate || ""))
      );
  }, [history, statementFrom, statementTo]);

  const generateStatement = () => {
    setStatementPreview(filteredStatement);
  };

  const downloadStatementCSV = () => {
    if (!filteredStatement.length) {
      alert("Statement data లేదు.");
      return;
    }

    const rows = filteredStatement.map((h, index) => ({
      SNo: index + 1,
      Date: h.paymentDate || "",
      Lender: h.lender || "",
      Paid: h.paidAmount || h.paid || 0,
      OldAmount: h.oldAmount || 0,
      NewAmount: h.newAmount || 0,
      Month: h.monthKey || "",
      Note: h.note || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(
      wb,
      `debt-statement-${statementFrom || "start"}-to-${statementTo || "end"}.xlsx`
    );
  };

  const validDebts = useMemo(
    () =>
      debts.filter(
        (d) =>
          d.lender &&
          Number(d.currentBalance || d.amount || 0) > 0 &&
          String(d.status || "active").toLowerCase() !== "closed"
      ),
    [debts]
  );

  const totalAmount = validDebts.reduce(
    (s, d) => s + Number(d.currentBalance || d.amount || 0),
    0
  );

  const totalMonthlyDue = validDebts.reduce(
    (s, d) => s + Number(d.monthlyDue || 0),
    0
  );

  const estimatedDebtFreeMonths =
    totalMonthlyDue > 0 ? Math.ceil(totalAmount / totalMonthlyDue) : null;

  const estimatedDebtFreeDate = formatDebtFreeDate(estimatedDebtFreeMonths);

  const pieData = useMemo(
    () =>
      validDebts.map((d) => ({
        name: d.lender,
        amount: Number(d.currentBalance || d.amount || 0),
      })),
    [validDebts]
  );

  const monthlyHistory = useMemo(() => {
    const grouped = {};
    history.forEach((h) => {
      const key = h.monthKey || h.paymentMonth || "Other";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(h);
    });

    return Object.entries(grouped)
      .map(([month, items]) => ({
        month,
        totalPaid: items.reduce(
          (s, i) => s + Number(i.paidAmount || i.paid || 0),
          0
        ),
        count: items.length,
        items: items.sort((a, b) =>
          String(a.paymentDate || "").localeCompare(String(b.paymentDate || ""))
        ),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [history]);

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center px-4">
        <p className="text-xl text-purple-200">{selectedYear} data loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 text-white px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-pink-200 to-cyan-200">
            Debt Tracker
          </h1>
          <p className="text-sm text-purple-100/80 mt-1">
            Track balances, payments, payoff progress, and yearly debt health.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadBackup}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-sm flex items-center gap-2 shadow-lg"
          >
            <DatabaseBackup className="w-4 h-4" />
            Backup Data
          </button>

          <span className="text-sm text-purple-100">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-black/40 border border-purple-400/50 rounded-xl px-4 py-2 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-200 bg-red-900/40 border border-red-500/50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-8">
        {[
          ["analytics", "Analytics"],
          ["manage", "Manage Debts"],
          ["history", "Repayment History"],
          ["statement", "Statement"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition ${
              viewMode === key
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-900/40"
                : "bg-white/10 text-purple-100 hover:bg-white/15"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === "analytics" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              title="Total Active Debts"
              value={validDebts.length}
              subtitle="Open lenders this year"
              icon={<CreditCard className="w-5 h-5" />}
            />
            <SummaryCard
              title="Total Outstanding"
              value={formatMoney(totalAmount)}
              subtitle="Current unpaid balance"
              icon={<Wallet className="w-5 h-5" />}
            />
            <SummaryCard
              title="Monthly Due"
              value={formatMoney(totalMonthlyDue)}
              subtitle="Combined monthly payment"
              icon={<BadgeIndianRupee className="w-5 h-5" />}
            />
            <SummaryCard
              title="Debt Free Target"
              value={estimatedDebtFreeDate}
              subtitle={
                estimatedDebtFreeMonths
                  ? `${estimatedDebtFreeMonths} months approx`
                  : "Need monthly due values"
              }
              icon={<TrendingDown className="w-5 h-5" />}
              highlight
            />
          </div>

          <Section
            title={`Debt Distribution – ${selectedYear}`}
            icon={<CreditCard className="w-5 h-5" />}
          >
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-300">No active debts found.</p>
            ) : (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section
            title="Payoff Timeline"
            icon={<CalendarDays className="w-5 h-5" />}
          >
            {validDebts.length === 0 ? (
              <p className="text-sm text-gray-300">No active debts available.</p>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {validDebts.map((d) => {
                  const months = calculateDebtFreeMonths(
                    d.currentBalance || d.amount || 0,
                    d.monthlyDue || 0
                  );
                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-white/15 bg-white/5 p-4"
                    >
                      <div className="text-sm font-semibold text-cyan-200">
                        {d.lender}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Balance: {formatMoney(d.currentBalance || d.amount || 0)}
                      </div>
                      <div className="text-xs text-white/60">
                        Monthly Due: {formatMoney(d.monthlyDue || 0)}
                      </div>
                      <div className="mt-3 text-lg font-bold text-emerald-300">
                        {formatDebtFreeDate(months)}
                      </div>
                      <div className="text-xs text-white/60">
                        {months ? `${months} months estimated` : "Monthly due required"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}

      {viewMode === "manage" && (
        <Section
          title={`Manage Debts – ${selectedYear}`}
          icon={<Wallet className="w-5 h-5" />}
        >
          <div className="flex flex-wrap gap-3 mb-5">
            <label className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm cursor-pointer flex items-center gap-2 shadow-md">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload Excel"}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleAddRow}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-sm shadow-md"
            >
              Add Row
            </button>

            <button
              onClick={handleSaveDebtsToCloud}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm flex items-center gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              Save to Cloud
            </button>
          </div>

          {debts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm text-purple-100">
              No debt rows yet. Add a row or upload Excel.
            </div>
          ) : (
            <div className="space-y-4">
              {debts.map((row, idx) => {
                const debtFreeMonths = calculateDebtFreeMonths(
                  row.currentBalance || row.amount || 0,
                  row.monthlyDue || 0
                );

                return (
                  <div
                    key={row.id || idx}
                    className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-md p-4 md:p-5 shadow-lg shadow-black/20"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-purple-200/70">
                          Debt Row {idx + 1}
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {row.lender || "New Lender"}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <MiniStat
                          label="Balance"
                          value={formatMoney(row.currentBalance || 0)}
                          tone="amber"
                        />
                        <MiniStat
                          label="Monthly"
                          value={formatMoney(row.monthlyDue || 0)}
                          tone="cyan"
                        />
                        <MiniStat
                          label="Debt Free"
                          value={formatDebtFreeDate(debtFreeMonths)}
                          tone="emerald"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <FieldBlock label="Lender Name">
                        <input
                          value={row.lender || ""}
                          onChange={(e) =>
                            handleCellChange(idx, "lender", e.target.value)
                          }
                          placeholder="Enter full lender name"
                          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>

                      <FieldBlock label="Note">
                        <input
                          value={row.repayNote || ""}
                          onChange={(e) =>
                            handleCellChange(idx, "repayNote", e.target.value)
                          }
                          placeholder="Optional note"
                          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                      <FieldBlock label="Original Amount">
                        <input
                          type="number"
                          value={row.amount || 0}
                          onChange={(e) =>
                            handleCellChange(idx, "amount", e.target.value)
                          }
                          className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm text-right outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>

                      <FieldBlock label="Current Balance">
                        <input
                          type="number"
                          value={row.currentBalance || 0}
                          onChange={(e) =>
                            handleCellChange(idx, "currentBalance", e.target.value)
                          }
                          className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm text-right outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>

                      <FieldBlock label="Monthly Due">
                        <input
                          type="number"
                          value={row.monthlyDue || 0}
                          onChange={(e) =>
                            handleCellChange(idx, "monthlyDue", e.target.value)
                          }
                          className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm text-right outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>

                      <FieldBlock label="Due Day">
                        <input
                          type="number"
                          value={row.dueDay || 1}
                          onChange={(e) =>
                            handleCellChange(idx, "dueDay", e.target.value)
                          }
                          className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm text-center outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <FieldBlock label="Repay Amount" tone="emerald">
                        <input
                          type="number"
                          value={row.repayInput || ""}
                          onChange={(e) =>
                            handleCellChange(idx, "repayInput", e.target.value)
                          }
                          placeholder="Enter payment"
                          className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm text-right outline-none focus:border-emerald-400"
                        />
                      </FieldBlock>

                      <FieldBlock label="Payment Date" tone="cyan">
                        <input
                          type="date"
                          value={row.repayDate || todayStr()}
                          onChange={(e) =>
                            handleCellChange(idx, "repayDate", e.target.value)
                          }
                          className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-400"
                        />
                      </FieldBlock>

                      <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 p-4 flex flex-col justify-center">
                        <div className="text-xs text-amber-200 mb-1">
                          Payoff Estimate
                        </div>
                        <div className="text-lg font-bold text-amber-300">
                          {formatDebtFreeDate(debtFreeMonths)}
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {debtFreeMonths
                            ? `${debtFreeMonths} months approx at current due`
                            : "Set monthly due to calculate"}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => handleRepay(idx)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-medium"
                      >
                        Save Payment
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {viewMode === "history" && (
        <Section
          title={`Repayment History – ${selectedYear}`}
          icon={<Clock className="w-5 h-5" />}
        >
          {monthlyHistory.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-200">
              Repayment history లేదు.
            </p>
          ) : (
            <div className="space-y-4">
              {monthlyHistory.map(({ month, totalPaid, count, items }) => (
                <div key={month} className="bg-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-purple-200">{month}</span>
                    <div className="text-sm">
                      <span className="text-emerald-300 font-bold">
                        {formatMoney(totalPaid)}
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({count} payments)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
                    {items.map((h) => (
                      <div key={h.id} className="bg-black/20 rounded p-3">
                        <div className="font-semibold">{h.lender}</div>
                        <div className="text-emerald-400">
                          Paid: {formatMoney(h.paidAmount || h.paid || 0)}
                        </div>
                        <div className="text-gray-300">
                          Date: {h.paymentDate || "-"}
                        </div>
                        {h.note ? (
                          <div className="text-gray-400 text-[10px] mt-1">
                            {h.note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {viewMode === "statement" && (
        <Section
          title={`Statement – ${selectedYear}`}
          icon={<Download className="w-5 h-5" />}
        >
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1">From Date</label>
              <input
                type="date"
                value={statementFrom}
                onChange={(e) => setStatementFrom(e.target.value)}
                className="w-full bg-transparent border border-white/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs mb-1">To Date</label>
              <input
                type="date"
                value={statementTo}
                onChange={(e) => setStatementTo(e.target.value)}
                className="w-full bg-transparent border border-white/30 rounded px-3 py-2"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={generateStatement}
                className="w-full px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-sm"
              >
                Generate Preview
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={downloadStatementCSV}
                className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm"
              >
                Download Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-white/20 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Total Entries</div>
              <div className="text-lg font-semibold text-cyan-300">
                {statementPreview.length}
              </div>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Total Paid</div>
              <div className="text-lg font-semibold text-emerald-300">
                {formatMoney(
                  statementPreview.reduce(
                    (sum, item) => sum + Number(item.paidAmount || item.paid || 0),
                    0
                  )
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Selected Year</div>
              <div className="text-lg font-semibold text-amber-300">
                {selectedYear}
              </div>
            </div>
          </div>

          {statementPreview.length === 0 ? (
            <p className="text-sm text-gray-300">
              Select date range and click Generate Preview.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/20 bg-black/10">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Lender</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Old Amount</th>
                    <th className="px-3 py-2 text-right">New Balance</th>
                    <th className="px-3 py-2 text-left">Month</th>
                    <th className="px-3 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {statementPreview.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="px-3 py-2">{item.paymentDate || "-"}</td>
                      <td className="px-3 py-2">{item.lender || "-"}</td>
                      <td className="px-3 py-2 text-right text-emerald-300">
                        {formatMoney(item.paidAmount || item.paid || 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(item.oldAmount || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-300">
                        {formatMoney(item.newAmount || 0)}
                      </td>
                      <td className="px-3 py-2">{item.monthKey || "-"}</td>
                      <td className="px-3 py-2">{item.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, highlight = false }) {
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
      {subtitle ? (
        <div className="text-xs text-white/60 mt-1">{subtitle}</div>
      ) : null}
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

function FieldBlock({ label, children, tone = "default" }) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500/10 border-emerald-400/20"
      : tone === "cyan"
      ? "bg-cyan-500/10 border-cyan-400/20"
      : "bg-white/5 border-white/10";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <label className="block text-xs text-purple-200 mb-2">{label}</label>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone = "cyan" }) {
  const map = {
    cyan: "text-cyan-300 border-cyan-400/20 bg-cyan-500/10",
    amber: "text-amber-300 border-amber-400/20 bg-amber-500/10",
    emerald: "text-emerald-300 border-emerald-400/20 bg-emerald-500/10",
  };

  return (
    <div className={`rounded-xl border px-3 py-2 min-w-[120px] ${map[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}