// MonthlyPage.jsx
import { useMemo, useState } from "react";
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
} from "recharts";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MonthlyPage({
  excelMonthly,
  setExcelMonthly,   // App.jsx → Firestore నుండి వస్తుంది
  upiSpends,
  setUpiSpends,
  upiBudgets,
  setUpiBudgets,
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  /* HANDLERS */

  // 🔹 Monthly Excel → Firestore /users/{uid}/monthly
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

        const parsed = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;

          const maybeMonth = row[row.length - 2];
          const maybeAmount = row[row.length - 1];

          if (
            typeof maybeMonth === "string" &&
            maybeMonth.toLowerCase().includes("grand total")
          ) {
            continue;
          }
          if (
            typeof maybeMonth === "string" &&
            maybeMonth.toLowerCase().trim() === "month"
          ) {
            continue;
          }

          if (maybeMonth && maybeAmount !== undefined && maybeAmount !== "") {
            parsed.push({
              month: String(maybeMonth).trim(),
              amount: Number(maybeAmount) || 0,
            });
          }
        }

        const monthlyRef = collection(db, "users", user.uid, "monthly");
        const ops = parsed.map((row) => addDoc(monthlyRef, row));
        await Promise.all(ops);

        // setExcelMonthly local‌గా set చేయాల్సిన అవసరం లేదు;
        // App.jsxలో onSnapshot వల్ల Firestore data load అవుతుంది
      } catch (err) {
        console.error("Monthly upload error:", err);
        setError("Monthly Excel చదవడంలో లేదా data save చేయడంలో error వచ్చింది.");
      } finally {
        setUploading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ఇప్పటికీ UPI spends / budgetsని localStorageలోనే ఉంచాలనుకుంటే
  const handleAddUpiSpend = (entry) => {
    const d = entry.date ? new Date(entry.date) : new Date();
    const monthIndex = d.getMonth();
    const monthName = MONTHS[monthIndex];

    const newItem = {
      id: Date.now(),
      amount: Number(entry.amount),
      date: entry.date || d.toISOString().slice(0, 10),
      month: monthName,
      sector: entry.sector || "Other",
      note: entry.note || "",
    };

    setUpiSpends((prev) => [...prev, newItem]);
  };

  const handleUpdateBudget = (month, value) => {
    const num = Number(value || 0);
    setUpiBudgets((prev) => ({ ...prev, [month]: num }));
  };

  /* CALCULATIONS */
  const monthlyUpi = useMemo(() => {
    return MONTHS.map((month) => {
      const actual = upiSpends
        .filter((u) => u.month === month)
        .reduce((sum, u) => sum + u.amount, 0);

      const budget = Number(upiBudgets[month] || 0);

      return {
        month,
        budget,
        actual,
        over: actual > budget ? actual - budget : 0,
      };
    });
  }, [upiSpends, upiBudgets]);

  const totalUpiActual = monthlyUpi.reduce((s, m) => s + m.actual, 0);
  const totalUpiBudget = monthlyUpi.reduce((s, m) => s + m.budget, 0);

  const grandTotalExcel = excelMonthly.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  /* UI */
  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-3xl md:text-4xl font-bold text-purple-400 mb-8">
        Monthly Expenditure & UPI
      </h1>

      {/* Monthly Excel upload */}
      <Section
        title="Upload Monthly Expenditure Excel"
        icon={<Calendar className="w-5 h-5" />}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleMonthlyExcelUpload}
          className="mt-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-700 file:text-white hover:file:bg-purple-600"
        />
        {uploading && (
          <p className="mt-2 text-xs text-zinc-400">Uploading & saving…</p>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </Section>

      {/* Excel-based monthly chart (glow style) */}
      <Section
        title="Excel-based Monthly Expenditure"
        icon={<Calendar className="w-5 h-5" />}
      >
        {excelMonthly.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Upload monthly expenditure Excel to view chart.
          </p>
        ) : (
          <div className="w-full h-80 md:h-96">
            <div className="h-full rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-black border border-purple-900/60 shadow-[0_0_40px_rgba(168,85,247,0.35)] px-3 py-3 md:px-4 md:py-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={excelMonthly}
                  margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#e9d5ff", fontSize: 11 }}
                    interval={0}
                    angle={-40}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: "#e9d5ff", fontSize: 11 }} />
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
                    dataKey="amount"
                    name="Expenditure"
                    fill="url(#monthlyGlow)"
                    radius={[10, 10, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="monthlyGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#166534" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Section>

      {/* Month-wise table with GRAND TOTAL */}
      <Section
        title="Month-wise Expenditure (Excel View)"
        icon={<Wallet className="w-5 h-5" />}
      >
        {excelMonthly.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Upload monthly expenditure Excel to view table.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-purple-900/60 text-purple-300">
                <tr>
                  <th className="text-left px-3 py-2">Month</th>
                  <th className="text-right px-3 py-2">Expenditure</th>
                </tr>
              </thead>
              <tbody>
                {excelMonthly.map((row) => (
                  <tr key={row.id || row.month} className="bg-purple-900/20">
                    <td className="px-3 py-2">{row.month}</td>
                    <td className="px-3 py-2 text-right">
                      ₹{row.amount}
                    </td>
                  </tr>
                ))}

                <tr className="bg-black/70 border-t border-purple-800 font-semibold">
                  <td className="px-3 py-2 text-purple-200">GRAND TOTAL</td>
                  <td className="px-3 py-2 text-right text-amber-300">
                    ₹{grandTotalExcel}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ===== shared components ===== */
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
