// MonthlyPage.jsx
import { useEffect, useMemo } from "react";
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
  setExcelMonthly,
  upiSpends,
  setUpiSpends,
  upiBudgets,
  setUpiBudgets,
}) {
  /* LOAD / SAVE */
  useEffect(() => {
    const savedMonthly = localStorage.getItem("excelMonthly");
    if (savedMonthly) setExcelMonthly(JSON.parse(savedMonthly));

    const savedUpi = localStorage.getItem("upiSpends");
    if (savedUpi) setUpiSpends(JSON.parse(savedUpi));

    const savedBudgets = localStorage.getItem("upiBudgets");
    if (savedBudgets) setUpiBudgets(JSON.parse(savedBudgets));
  }, [setExcelMonthly, setUpiSpends, setUpiBudgets]);

  /* HANDLERS */
  const handleMonthlyExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const result = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const maybeMonth = row[row.length - 2];
        const maybeAmount = row[row.length - 1];

        // skip GRAND TOTAL row
        if (
          typeof maybeMonth === "string" &&
          maybeMonth.toLowerCase().includes("grand total")
        ) {
          continue;
        }

        // skip header row
        if (
          typeof maybeMonth === "string" &&
          maybeMonth.toLowerCase().trim() === "month"
        ) {
          continue;
        }

        if (maybeMonth && maybeAmount !== undefined && maybeAmount !== "") {
          result.push({
            month: String(maybeMonth).trim(),
            amount: Number(maybeAmount) || 0,
          });
        }
      }

      setExcelMonthly(result);
      localStorage.setItem("excelMonthly", JSON.stringify(result));
    };

    reader.readAsArrayBuffer(file);
  };

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

    setUpiSpends((prev) => {
      const next = [...prev, newItem];
      localStorage.setItem("upiSpends", JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateBudget = (month, value) => {
    const num = Number(value || 0);
    setUpiBudgets((prev) => {
      const next = { ...prev, [month]: num };
      localStorage.setItem("upiBudgets", JSON.stringify(next));
      return next;
    });
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
  }, [upiSpends, upiBudgets]); // [web:167][web:210]

  const totalUpiActual = monthlyUpi.reduce((s, m) => s + m.actual, 0);
  const totalUpiBudget = monthlyUpi.reduce((s, m) => s + m.budget, 0);

  // GRAND TOTAL for excelMonthly table
  const grandTotalExcel = excelMonthly.reduce(
    (sum, r) => sum + r.amount,
    0
  ); // [web:238][web:242]

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
      </Section>

      {/* Excel-based monthly chart */}
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
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="amount"
                  name="Expenditure"
                  fill="#22c55e"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
                  <tr key={row.month} className="bg-purple-900/20">
                    <td className="px-3 py-2">{row.month}</td>
                    <td className="px-3 py-2 text-right">₹{row.amount}</td>
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
