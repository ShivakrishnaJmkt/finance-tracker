// MonthlyPage.jsx
import { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Calendar, Wallet } from "lucide-react";
import {
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  Line,
  CartesianGrid,
} from "recharts";
import { collection, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const CURRENT_YEAR = new Date().getFullYear();

export default function MonthlyPage({
  excelMonthly,
  setExcelMonthly,
  upiSpends,
  setUpiSpends,
  upiBudgets,
  setUpiBudgets,
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("analytics"); // analytics | excel
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [availableYears, setAvailableYears] = useState([CURRENT_YEAR]);
  const [editingMonthly, setEditingMonthly] = useState([]); // 12 rows only

  /* ---------- Load selectedYear monthly data ---------- */
  useEffect(() => {
    if (!user?.uid) return;

    const loadYearData = async () => {
      try {
        const col = collection(db, "users", user.uid, "monthly");

        // load current year rows
        const qYear = query(col, where("year", "==", selectedYear));
        const snapYear = await getDocs(qYear);
        const rows = snapYear.docs.map((d) => d.data());
        setExcelMonthly(rows);

        // load all years
        const allSnap = await getDocs(col);
        const yearSet = new Set();
        allSnap.docs.forEach((d) => {
          const y = d.data().year;
          if (y) yearSet.add(y);
        });
        if (!yearSet.has(selectedYear)) yearSet.add(selectedYear);
        setAvailableYears(Array.from(yearSet).sort());
      } catch (err) {
        console.error("load monthly error", err);
      }
    };

    loadYearData();
  }, [user?.uid, selectedYear, setExcelMonthly]);

  /* ---------- build 12 editable rows for selectedYear ---------- */
  useEffect(() => {
    const byMonth = new Map(
      excelMonthly
        .filter((r) => r.year === selectedYear)
        .map((r) => [String(r.month), Number(r.amount || 0)])
    );

    const rows = MONTHS.map((m) => ({
      id: `${selectedYear}-${m}`,
      year: selectedYear,
      month: m,
      amount: byMonth.get(m) || 0,
    }));

    setEditingMonthly(rows);
  }, [excelMonthly, selectedYear]);

  /* ============ Excel → Firestore (selectedYear) ============ */
  const handleMonthlyExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setError("");
    setUploading(true);

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // assume: row0 headers, then Month | Amount
        const parsedByMonth = new Map();
        for (let i = 1; i < rows.length; i++) {
          const [monthCell, amountCell] = rows[i];
          if (!monthCell || amountCell === undefined || amountCell === "") continue;
          const monthName = String(monthCell).trim();
          const amt = Number(amountCell) || 0;
          parsedByMonth.set(monthName, amt);
        }

        const finalRows = MONTHS.map((m) => ({
          year: selectedYear,
          month: m,
          amount: parsedByMonth.get(m) || 0,
        }));

        const col = collection(db, "users", user.uid, "monthly");
        const qYear = query(col, where("year", "==", selectedYear));
        const snapYear = await getDocs(qYear);
        const batch = writeBatch(db);

        snapYear.docs.forEach((d) => batch.delete(d.ref));
        finalRows.forEach((row) => {
          const ref = doc(col, `${row.year}-${row.month}`);
          batch.set(ref, row);
        });

        await batch.commit();
        setExcelMonthly(finalRows);
        setUploading(false);
        alert(`Excel uploaded & saved for ${selectedYear} ✅`);
      } catch (err) {
        console.error("Excel upload error", err);
        setError("Excel చదవడంలో లేదా save చేయడంలో సమస్య వచ్చింది.");
        setUploading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  /* ============ manual edit helpers ============ */
  const handleCellChange = (index, value) => {
    const amt = Number(value || 0);
    setEditingMonthly((prev) =>
      prev.map((row, i) => (i === index ? { ...row, amount: amt } : row))
    );
  };

  const handleSaveMonthlyToCloud = async () => {
    if (!user?.uid) return;
    try {
      const col = collection(db, "users", user.uid, "monthly");
      const qYear = query(col, where("year", "==", selectedYear));
      const snapYear = await getDocs(qYear);
      const batch = writeBatch(db);

      snapYear.docs.forEach((d) => batch.delete(d.ref));
      editingMonthly.forEach((row) => {
        const ref = doc(col, `${row.year}-${row.month}`);
        batch.set(ref, {
          year: row.year,
          month: row.month,
          amount: Number(row.amount || 0),
        });
      });

      await batch.commit();
      setExcelMonthly(
        editingMonthly.map((r) => ({
          year: r.year,
          month: r.month,
          amount: r.amount,
        }))
      );
      alert(`Saved ${selectedYear} table to cloud ✅`);
    } catch (err) {
      console.error("Save monthly error", err);
      alert("Saving failed, try again ❌");
    }
  };

  /* ============ analytics data ============ */
  const grandTotalExcel = editingMonthly.reduce(
    (s, r) => s + Number(r.amount || 0),
    0
  );

  const bestMonth =
    editingMonthly.length &&
    editingMonthly.reduce((a, b) => (b.amount > a.amount ? b : a));

  const avgPerMonth =
    editingMonthly.length ? Math.round(grandTotalExcel / editingMonthly.length) : 0;

  const chartData = editingMonthly.map((r) => ({
    month: r.month.slice(0, 3),
    excelAmount: r.amount,
  }));

  /* ============ UI ============ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-black text-white px-4 py-6 md:px-8 md:py-8">
      {/* header + year selector */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-300">
          Monthly Expenditure
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-sm text-purple-200">Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-black/60 border border-purple-700 rounded-lg px-3 py-2 text-sm"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            className="px-3 py-2 rounded-lg bg-purple-600 text-xs md:text-sm hover:bg-purple-700"
          >
            + Next Year
          </button>
        </div>
      </div>

      {/* view toggle */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setViewMode("analytics")}
          className={`px-4 py-2 rounded-xl text-sm md:text-base ${
            viewMode === "analytics"
              ? "bg-purple-600 shadow-lg shadow-purple-500/40"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setViewMode("excel")}
          className={`px-4 py-2 rounded-xl text-sm md:text-base ${
            viewMode === "excel"
              ? "bg-emerald-600 shadow-lg shadow-emerald-500/40"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          📋 Editable Table
        </button>
      </div>

      {/* upload */}
      <Section
        title={`Upload Excel for ${selectedYear}`}
        icon={<Calendar className="w-5 h-5" />}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleMonthlyExcelUpload}
          className="mt-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-700 file:text-white hover:file:bg-purple-600"
        />
        {uploading && (
          <p className="mt-2 text-xs text-zinc-300">
            Uploading & saving to cloud…
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </Section>

      {/* analytics */}
      {viewMode === "analytics" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              title={`Total Spend (${selectedYear})`}
              value={`₹${grandTotalExcel.toLocaleString("en-IN")}`}
            />
            <SummaryCard
              title="Highest Month"
              value={
                bestMonth
                  ? `${bestMonth.month} – ₹${bestMonth.amount.toLocaleString(
                      "en-IN"
                    )}`
                  : "-"
              }
            />
            <SummaryCard
              title="Avg per Month"
              value={`₹${avgPerMonth.toLocaleString("en-IN")}`}
            />
          </div>

          <Section
            title={`Monthly Expenditure (${selectedYear})`}
            icon={<Wallet className="w-5 h-5" />}
          >
            <div className="h-80 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
                >
                  <CartesianGrid
                    stroke="#374151"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#e5e7eb", fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis tick={{ fill: "#e5e7eb", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #4c1d95",
                      borderRadius: "0.75rem",
                      fontSize: "11px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="excelAmount"
                    name="Expenditure"
                    fill="#22c55e"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </>
      )}

      {/* editable table – 12 months only, no extra row */}
      {viewMode === "excel" && (
        <Section
          title={`Editable Monthly Table (${selectedYear})`}
          icon={<Wallet className="w-5 h-5" />}
        >
          <div className="flex justify-end mb-3">
            <button
              onClick={handleSaveMonthlyToCloud}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-xs md:text-sm hover:bg-emerald-700"
            >
              💾 Save {selectedYear} to Cloud
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-purple-900/60 text-purple-300">
                <tr>
                  <th className="text-left px-3 py-2">Month</th>
                  <th className="text-right px-3 py-2">Expenditure (₹)</th>
                </tr>
              </thead>
              <tbody>
                {editingMonthly.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="bg-purple-900/20 border-b border-purple-900/40"
                  >
                    <td className="px-3 py-2">{row.month}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={row.amount}
                        onChange={(e) =>
                          handleCellChange(idx, e.target.value)
                        }
                        className="w-28 bg-black/70 border border-purple-700 rounded-xl px-2 py-1 text-right focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                      />
                    </td>
                  </tr>
                ))}

                <tr className="bg-black/70 border-t border-purple-800 font-semibold">
                  <td className="px-3 py-2 text-purple-200">
                    TOTAL ({selectedYear})
                  </td>
                  <td className="px-3 py-2 text-right text-amber-300">
                    ₹{grandTotalExcel.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

/* shared components */
function Section({ title, icon, children }) {
  return (
    <div className="bg-gradient-to-r from-purple-900 to-black rounded-2xl p-4 md:p-6 mb-6 md:mb-8 shadow-lg shadow-purple-900/40">
      <div className="flex items-center gap-2 text-purple-300 mb-4">
        {icon}
        <h2 className="font-semibold text-base md:text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="bg-black/40 border border-purple-800 rounded-xl p-4">
      <div className="text-xs text-purple-300 mb-1">{title}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
