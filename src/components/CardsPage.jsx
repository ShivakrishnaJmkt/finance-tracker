// CardsPage.jsx
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CreditCard, Calendar, Wallet } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const getCardTotal = (row) =>
  MONTHS.reduce((sum, m) => sum + (Number(row[m]) || 0), 0);


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

const COLORS = [
  "#facc15", // yellow
  "#22d3ee", // cyan
  "#fb7185", // pink
  "#a855f7",
  "#9333ea",
  "#7c3aed",
  "#6d28d9",
  "#4c1d95",
];

export default function CardsPage( {
    excelBills,
    setExcelBills,
    upiSpends,
    upiBudgets,
    setUpiSpends,
    setUpiBudgets,
}) {
  
  const [viewMode, setViewMode] = useState("analytics"); // analytics | excel

  // UPI state (ఇక్కడ కూడా need అయితే ఉంచాం)
 

  /* ================= LOAD / SAVE ================= */
  

  /* ================= HANDLERS ================= */
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const formatted = rows.map((row) => {
        const obj = { card: row["Cards"] };
        MONTHS.forEach((m) => {
          obj[m] = Number(row[m] || 0);
        });
        return obj;
      });

      setExcelBills(formatted);
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

    setUpiSpends((prev) => [...prev, newItem]);
  };

  const handleUpdateBudget = (month, value) => {
    const num = Number(value || 0);
    setUpiBudgets((prev) => ({ ...prev, [month]: num }));
  };

  /* ================= CALCULATIONS ================= */
  const cardTotals = useMemo(
    () =>
      excelBills.map((row) => ({
        card: row.card,
        total: MONTHS.reduce((s, m) => s + row[m], 0),
      })),
    [excelBills]
  );

  const totalSpend = cardTotals.reduce((s, c) => s + c.total, 0);

  const usedCards = cardTotals.filter((c) => c.total > 0);
  const unusedCards = cardTotals.filter((c) => c.total === 0);

  const mostUsed = usedCards.length
    ? usedCards.reduce((a, b) => (b.total > a.total ? b : a))
    : null;

  const leastUsed = usedCards.length
    ? usedCards.reduce((a, b) => (b.total < a.total ? b : a))
    : null;

  const pieData = usedCards.map((c) => ({ name: c.card, value: c.total }));

  const monthlyTotals = useMemo(() => {
    return MONTHS.map((month) => {
      const totalForMonth = excelBills.reduce((sum, row) => {
        return sum + Number(row[month] || 0);
      }, 0);
      return { month, total: totalForMonth };
    });
  }, [excelBills]);

  const barData = usedCards.map((c) => ({
    name: c.card,
    total: c.total,
  }));

  const cardInsights = useMemo(() => {
    return cardTotals.map((c) => {
      const row = excelBills.find((r) => r.card === c.card);
      const usedMonths = MONTHS.filter((m) => row[m] > 0);
      const unusedMonths = MONTHS.filter((m) => row[m] === 0);

      return {
        card: c.card,
        total: c.total,
        usedMonths: usedMonths.length,
        unusedMonths: unusedMonths.length,
        avgPerMonth: Math.round(c.total / 12),
        percentOfTotal:
          totalSpend > 0 ? ((c.total / totalSpend) * 100).toFixed(1) : 0,
      };
    });
  }, [cardTotals, excelBills, totalSpend]);

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

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-3xl md:text-4xl font-bold text-purple-400 mb-8">
        Credix – Credit Card Analytics
      </h1>

      <Section title="Upload Excel" icon={<CreditCard />}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
          className="mt-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-700 file:text-white hover:file:bg-purple-600"
        />
      </Section>

      {/* VIEW TOGGLE */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setViewMode("analytics")}
          className={`px-4 py-2 rounded-lg text-sm md:text-base transition ${
            viewMode === "analytics"
              ? "bg-purple-600 shadow-lg shadow-purple-500/30"
              : "bg-purple-900"
          }`}
        >
          Analytics View
        </button>
        <button
          onClick={() => setViewMode("excel")}
          className={`px-4 py-2 rounded-lg text-sm md:text-base transition ${
            viewMode === "excel"
              ? "bg-purple-600 shadow-lg shadow-purple-500/30"
              : "bg-purple-900"
          }`}
        >
          Excel View
        </button>
      </div>

      {viewMode === "analytics" && (
        <>
          {/* summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <SummaryCard
              title="Total Spend"
              value={`₹${totalSpend}`}
              amount={totalSpend}
            />
            <SummaryCard
              title="Most Used Card"
              value={mostUsed?.card || "-"}
              amount={mostUsed?.total}
            />
            <SummaryCard
              title="Least Used Card"
              value={leastUsed?.card || "-"}
              amount={leastUsed?.total}
            />
            <SummaryCard
              title="Unused Cards"
              value={unusedCards.length}
            />
          </div>

          <Section title="Unused Cards">
            {unusedCards.length === 0 ? (
              <p className="text-gray-400">No unused cards 🎉</p>
            ) : (
              <ul className="list-disc list-inside text-purple-300 space-y-1">
                {unusedCards.map((c) => (
                  <li key={c.card}>{c.card}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* Pie + card bar */}
          <Section title="Spends Overview (Pie & Bar)">
            {pieData.length === 0 ? (
              <p className="text-gray-400">No usage data</p>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-1/2 h-80 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={120}
                        label
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full lg:w-1/2 h-80 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#e9d5ff", fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: "#e9d5ff", fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="total"
                        name="Total Spend"
                        fill="#facc15"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Section>

          {/* Month-wise from card excel */}
          <Section
            title="Monthly Spends Overview"
            icon={<Calendar className="w-5 h-5" />}
          >
            {monthlyTotals.every((m) => m.total === 0) ? (
              <p className="text-gray-400 text-sm">
                No monthly spend data available. Please upload Excel file.
              </p>
            ) : (
              <div className="w-full h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyTotals}
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
                      dataKey="total"
                      name="Total Spend"
                      fill="#22c55e"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* UPI Budget & Spends + chart కూడా cards page లో ఉంచాలనుకుంటే */}
          <Section
            title="UPI Budget & Spends"
            icon={<Wallet className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-black/40 border border-purple-800 rounded-xl p-3 md:p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-300">
                      Total UPI Budget (Year)
                    </span>
                    <span className="text-amber-300 font-semibold">
                      ₹{totalUpiBudget}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-purple-300">
                      Total UPI Actual (Year)
                    </span>
                    <span className="text-cyan-300 font-semibold">
                      ₹{totalUpiActual}
                    </span>
                  </div>
                </div>

                <UPIEntryForm onAdd={handleAddUpiSpend} />
              </div>

              <UPIBudgetEditor
                months={MONTHS}
                budgets={upiBudgets}
                onChange={handleUpdateBudget}
              />
            </div>
          </Section>

          <UPIBudgetSection data={monthlyUpi} />

          <Section title="Card-wise Insights">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cardInsights.map((c) => (
                <div
                  key={c.card}
                  className="bg-black/40 border border-purple-800 rounded-xl p-4 md:p-5"
                >
                  <h3 className="text-lg font-semibold text-purple-300 mb-3">
                    {c.card}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Total Spent</div>
                    <div className="text-amber-300 font-semibold">
                      ₹{c.total}
                    </div>
                    <div>Usage %</div>
                    <div className="text-cyan-300 font-semibold">
                      {c.percentOfTotal}%
                    </div>
                    <div>Avg / Month</div>
                    <div className="text-pink-300 font-semibold">
                      ₹{c.avgPerMonth}
                    </div>
                    <div>Months Used</div>
                    <div className="text-purple-300">{c.usedMonths}</div>
                    <div>Unused Months</div>
                    <div className="text-gray-300">{c.unusedMonths}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

  {viewMode === "excel" && (
  <Section title="Month-wise Bills (Excel Format)">
    <div className="overflow-x-auto rounded-lg border border-purple-800">
      <table className="min-w-full text-xs md:text-sm">
        <thead className="text-purple-400 bg-black/60 border-b border-purple-900">
          <tr>
            <th className="text-left p-2 md:p-3">Card</th>
            {MONTHS.map((m) => (
              <th
                key={m}
                className="text-right px-2 md:px-3 py-2"
              >
                {m}
              </th>
            ))}
            <th className="text-right px-2 md:px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {excelBills.map((row) => {
            const total = getCardTotal(row);
            return (
              <tr
                key={row.card}
                className="border-b border-purple-900 odd:bg-black/40"
              >
                <td className="p-2 md:p-3 font-medium">{row.card}</td>
                {MONTHS.map((m) => (
                  <td
                    key={m}
                    className="text-right px-2 md:px-3 py-2 text-purple-200"
                  >
                    ₹{row[m]}
                  </td>
                ))}
                <td className="text-right px-2 md:px-3 py-2 font-semibold text-amber-300">
                  ₹{total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Section>
)}


    </div>
  );
}

/* ================= SHARED COMPONENTS (ఇవి రెండు pages లో share కావొచ్చు) */
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

function SummaryCard({ title, value, amount }) {
  return (
    <div className="bg-gradient-to-r from-purple-900 to-black rounded-2xl p-4 md:p-5 shadow-lg shadow-purple-900/40 flex flex-col gap-1">
      <div className="text-purple-300 text-xs md:text-sm">{title}</div>
      <div className="text-lg md:text-xl font-semibold text-white">
        {value}
      </div>
      {amount !== undefined && (
        <div className="text-amber-300 font-extrabold text-sm md:text-base">
          ₹{amount}
        </div>
      )}
    </div>
  );
}

function UPIEntryForm({ onAdd }) {
  const [form, setForm] = useState({
    amount: "",
    date: "",
    sector: "",
    note: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount) return;
    onAdd(form);
    setForm({ amount: "", date: "", sector: "", note: "" });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-black/40 border border-purple-800 rounded-xl p-3 md:p-4 space-y-3 text-sm"
    >
      <div className="font-semibold text-purple-200 mb-1">
        Add UPI Spend
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-purple-300 mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            className="w-full rounded-lg bg-black/60 border border-purple-700 px-2 py-1 text-xs md:text-sm outline-none focus:border-purple-400"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-purple-300 mb-1">
            Date
          </label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="w-full rounded-lg bg-black/60 border border-purple-700 px-2 py-1 text-xs md:text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-purple-300 mb-1">
            Sector
          </label>
          <input
            type="text"
            name="sector"
            placeholder="Food, Travel..."
            value={form.sector}
            onChange={handleChange}
            className="w-full rounded-lg bg-black/60 border border-purple-700 px-2 py-1 text-xs md:text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-xs text-purple-300 mb-1">
            Note
          </label>
          <input
            type="text"
            name="note"
            value={form.note}
            onChange={handleChange}
            className="w-full rounded-lg bg-black/60 border border-purple-700 px-2 py-1 text-xs md:text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full mt-1 bg-purple-600 hover:bg-purple-500 text-xs md:text-sm font-semibold py-2 rounded-lg"
      >
        Save UPI Spend
      </button>
    </form>
  );
}

function UPIBudgetEditor({ months, budgets, onChange }) {
  return (
    <div className="bg-black/40 border border-purple-800 rounded-xl p-3 md:p-4 text-xs md:text-sm max-h-80 overflow-y-auto">
      <div className="font-semibold text-purple-200 mb-2">
        Monthly UPI Budget (₹)
      </div>
      <div className="grid grid-cols-2 gap-2">
        {months.map((m) => (
          <div key={m} className="flex flex-col gap-1">
            <span className="text-purple-300 text-xs">{m}</span>
            <input
              type="number"
              value={budgets[m]}
              onChange={(e) => onChange(m, e.target.value)}
              className="w-full rounded-lg bg-black/60 border border-purple-700 px-2 py-1 text-xs outline-none focus:border-purple-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function UPIBudgetSection({ data }) {
  const hasData = data.some((d) => d.budget > 0 || d.actual > 0);

  return (
    <Section
      title="UPI Budget vs Actual"
      icon={<Wallet className="w-5 h-5" />}
    >
      {!hasData ? (
        <p className="text-gray-400 text-sm">
          Set monthly budget and add some UPI spends to see the chart.
        </p>
      ) : (
        <div className="w-full h-80 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
                dataKey="budget"
                name="Budget"
                fill="#22c55e"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="actual"
                name="Actual"
                fill="#fb7185"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}
