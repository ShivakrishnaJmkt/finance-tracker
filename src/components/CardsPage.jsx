// CardsPage.jsx
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CreditCard, Calendar } from "lucide-react";
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

const COLORS = [
  "#facc15",
  "#22d3ee",
  "#fb7185",
  "#a855f7",
  "#9333ea",
  "#7c3aed",
  "#6d28d9",
  "#4c1d95",
];

const getCardTotal = (row) =>
  MONTHS.reduce((sum, m) => sum + (Number(row[m]) || 0), 0);

export default function CardsPage({
  excelBills,
  setExcelBills,  // App.jsx నుంచి వస్తుంది
  upiSpends,
  upiBudgets,
  setUpiSpends,
  setUpiBudgets,
}) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState("analytics"); // analytics | excel
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  /* ============ EXCEL → FIRESTORE (PERMANENT) ============ */
  const handleExcelUpload = (e) => {
  const file = e.target.files?.[0];
  if (!file || !user?.uid) return;

  setError("");
  setUploading(true);

  const reader = new FileReader();

  reader.onload = async (evt) => {
    try {
      console.log("FILE LOADED");

      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      console.log("WORKBOOK SHEETS:", workbook.SheetNames);

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        throw new Error("No first sheet in workbook");
      }

      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log("Parsed rows:", rows); // ← rows ఇక్కడ కనిపించాలి

      const billsRef = collection(db, "users", user.uid, "bills");

      const promises = rows.map((row, index) => {
        const cardName = row["Cards"] || row["Card"] || row["CARD"];
        if (!cardName) {
          console.warn("Row missing Cards column, index:", index, row);
          return Promise.resolve(); // skip
        }

        const docData = { card: cardName };
        MONTHS.forEach((m) => {
          docData[m] = Number(row[m] || 0);
        });

        console.log("Saving doc:", docData);
        return addDoc(billsRef, docData);
      });

      await Promise.all(promises);
      console.log("All docs saved to Firestore");
    } catch (err) {
      console.error("Upload error:", err);
      setError("Excel చదవడంలో లేదా data save చేయడంలో error వచ్చింది.");
    } finally {
      setUploading(false);
    }
  };

  reader.onerror = (err) => {
    console.error("FileReader error:", err);
    setError("File చదవడంలో సమస్య వచ్చింది.");
    setUploading(false);
  };

  reader.readAsArrayBuffer(file);
};


  /* ============ CALCULATIONS (Firestore data base) ============ */
  const cardTotals = useMemo(
    () =>
      excelBills.map((row) => ({
        card: row.card,
        total: MONTHS.reduce(
          (s, m) => s + (Number(row[m]) || 0),
          0
        ),
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
      const row = excelBills.find((r) => r.card === c.card) || {};
      const usedMonths = MONTHS.filter(
        (m) => (Number(row[m]) || 0) > 0
      );
      const unusedMonths = MONTHS.filter(
        (m) => (Number(row[m]) || 0) === 0
      );

      return {
        card: c.card,
        total: c.total,
        usedMonths: usedMonths.length,
        unusedMonths: unusedMonths.length,
        avgPerMonth: Math.round((c.total || 0) / 12),
        percentOfTotal:
          totalSpend > 0 ? ((c.total / totalSpend) * 100).toFixed(1) : 0,
      };
    });
  }, [cardTotals, excelBills, totalSpend]);

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
        {uploading && (
          <p className="mt-2 text-xs text-zinc-400">Uploading & saving…</p>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
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
                      key={row.id || row.card}
                      className="border-b border-purple-900 odd:bg-black/40"
                    >
                      <td className="p-2 md:p-3 font-medium">
                        {row.card}
                      </td>
                      {MONTHS.map((m) => (
                        <td
                          key={m}
                          className="text-right px-2 md:px-3 py-2 text-purple-200"
                        >
                          ₹{row[m] || 0}
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

/* ================= SHARED COMPONENTS ================= */
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
