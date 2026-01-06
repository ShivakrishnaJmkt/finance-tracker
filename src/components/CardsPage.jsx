// CardsPage.jsx
import { useMemo, useState, useEffect } from "react";
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
import { collection, addDoc, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";

/* ============ CONSTANTS ============ */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLORS = [
  "#facc15", "#22d3ee", "#fb7185", "#a855f7", "#9333ea",
  "#7c3aed", "#6d28d9", "#4c1d95",
];

const getCardTotal = (row) =>
  MONTHS.reduce((sum, m) => sum + (Number(row[m]) || 0), 0);

/* ============ COMPONENT ============ */
export default function CardsPage({
  excelBills,
  setExcelBills,
  upiSpends,
  upiBudgets,
  setUpiSpends,
  setUpiBudgets,
}) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState("analytics");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  /* ------- Load existing data from Firestore ------- */
  useEffect(() => {
    if (!user?.uid) return;
    
    const loadBillsData = async () => {
      try {
        setLoadingData(true);
        const billsCol = collection(db, "users", user.uid, "bills");
        const snapshot = await getDocs(billsCol);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setExcelBills(data);
      } catch (err) {
        console.error("Load bills error:", err);
      } finally {
        setLoadingData(false);
      }
    };

    loadBillsData();
  }, [user?.uid, setExcelBills]);

  /* ------- manual row add ------- */
  const emptyRow = useMemo(
    () => ({
      card: "",
      ...MONTHS.reduce((o, m) => ({ ...o, [m]: 0 }), {}),
    }),
    []
  );

  const handleAddRow = () => {
    setExcelBills((prev) => [...prev, { ...emptyRow, id: Date.now().toString() }]);
  };

  const handleCellChange = (rowIndex, field, value) => {
    setExcelBills((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              [field]: field === "card" ? value : Number(value) || 0,
            }
          : row
      )
    );
  };

  /* ============ FIXED EXCEL → FIRESTORE (NO DUPLICATES) ============ */
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setError("");
    setUploading(true);

    try {
      // First, delete all existing bills to avoid duplicates
      const billsCol = collection(db, "users", user.uid, "bills");
      const snapshot = await getDocs(billsCol);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();

      // Now read and upload new data
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          if (!sheet) {
            throw new Error("No first sheet in workbook");
          }

          const rows = XLSX.utils.sheet_to_json(sheet);
          const newBatch = writeBatch(db);

          rows.forEach((row) => {
            const cardName = row["Cards"] || row["Card"] || row["CARD"];
            if (!cardName || typeof cardName !== 'string') {
              console.warn("Skipping invalid row:", row);
              return;
            }

            const docData = { card: String(cardName).trim() };
            MONTHS.forEach((m) => {
              docData[m] = Number(row[m] || 0);
            });

            // Use card name as document ID to prevent duplicates
            const docRef = doc(billsCol, docData.card);
            newBatch.set(docRef, docData);
          });

          await newBatch.commit();
          
          // Reload data to local state
          const snapshotAfter = await getDocs(billsCol);
          const updatedData = snapshotAfter.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          setExcelBills(updatedData);
          
          alert("✅ Excel data uploaded & saved successfully (old data replaced)");
        } catch (err) {
          console.error("Excel processing error:", err);
          setError("Excel చదవడంలో లేదా save చేయడంలో error వచ్చింది.");
        } finally {
          setUploading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed. Try again.");
      setUploading(false);
    }
  };

  /* ============ FIXED SAVE BILLS (Uses doc ID properly) ============ */
  const handleSaveBills = async () => {
    if (!user?.uid) return;
    
    try {
      const batch = writeBatch(db);
      const billsCol = collection(db, "users", user.uid, "bills");

      excelBills.forEach((row) => {
        if (!row.card || typeof row.card !== 'string') return;
        
        // Always use card name as document ID to prevent duplicates
        const ref = doc(billsCol, String(row.card).trim());
        const data = { card: String(row.card).trim() };
        MONTHS.forEach((m) => {
          data[m] = Number(row[m] || 0);
        });
        batch.set(ref, data);
      });

      await batch.commit();
      alert("✅ Bills saved to Firestore successfully");
    } catch (err) {
      console.error("Save bills error", err);
      alert("❌ Saving failed, try again");
    }
  };

  /* ============ CALCULATIONS ============ */
  const cardTotals = useMemo(
    () =>
      excelBills
        .filter(row => row.card && String(row.card).trim()) // Filter valid cards only
        .map((row) => ({
          card: row.card,
          total: getCardTotal(row),
        }))
        .filter(c => c.total > 0), // Only cards with spend
    [excelBills]
  );

  const totalSpend = cardTotals.reduce((s, c) => s + c.total, 0);
  const unusedCards = useMemo(() => 
    excelBills
      .filter(row => row.card && String(row.card).trim())
      .filter(row => getCardTotal(row) === 0)
      .map(row => row.card),
    [excelBills]
  );

  const mostUsed = cardTotals.length ? cardTotals.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const leastUsed = cardTotals.length ? cardTotals.reduce((a, b) => (b.total < a.total ? b : a)) : null;
  const pieData = cardTotals.map((c) => ({ name: c.card, value: c.total }));
  const barData = cardTotals.map((c) => ({ name: c.card, total: c.total }));

  const monthlyTotals = useMemo(() => {
    return MONTHS.map((month) => {
      const totalForMonth = excelBills.reduce((sum, row) => {
        return sum + Number(row[month] || 0);
      }, 0);
      return { month, total: totalForMonth };
    });
  }, [excelBills]);

  const cardInsights = useMemo(() => {
    return cardTotals.map((c) => {
      const row = excelBills.find((r) => r.card === c.card) || {};
      const usedMonths = MONTHS.filter((m) => (Number(row[m]) || 0) > 0);
      const unusedMonthsCount = 12 - usedMonths.length;

      return {
        card: c.card,
        total: c.total,
        usedMonths: usedMonths.length,
        unusedMonths: unusedMonthsCount,
        avgPerMonth: Math.round((c.total || 0) / 12),
        percentOfTotal: totalSpend > 0 ? ((c.total / totalSpend) * 100).toFixed(1) : 0,
      };
    });
  }, [cardTotals, excelBills, totalSpend]);

  /* ================= UI ================= */
  if (loadingData) {
    return (
      <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8 md:py-8 flex items-center justify-center">
        <div className="text-purple-400">Loading your data...</div>
      </div>
    );
  }

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
          <p className="mt-2 text-xs text-zinc-400">Uploading & replacing old data...</p>
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

      {viewMode === "excel" && (
        <Section title="Month-wise Bills (Excel Format)">
          <div className="flex justify-between mb-3">
            <button
              onClick={handleAddRow}
              className="px-3 py-1 rounded bg-purple-600 text-xs md:text-sm hover:bg-purple-500"
            >
              + Add Card
            </button>
            <button
              onClick={handleSaveBills}
              className="px-3 py-1 rounded bg-emerald-600 text-xs md:text-sm hover:bg-emerald-500"
            >
              💾 Save to Cloud
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-purple-800">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="text-purple-400 bg-black/60 border-b border-purple-900">
                <tr>
                  <th className="text-left p-2 md:p-3">Card</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right px-2 md:px-3 py-2">
                      {m}
                    </th>
                  ))}
                  <th className="text-right px-2 md:px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {excelBills.map((row, rowIndex) => {
                  const total = getCardTotal(row);
                  return (
                    <tr
                      key={row.id || row.card || rowIndex}
                      className="border-b border-purple-900 odd:bg-black/40 hover:bg-black/60"
                    >
                      <td className="p-2 md:p-3 font-medium">
                        <input
                          value={row.card || ''}
                          onChange={(e) =>
                            handleCellChange(rowIndex, "card", e.target.value)
                          }
                          className="bg-transparent border border-purple-700 rounded px-2 py-1 w-full text-xs md:text-sm focus:border-purple-500 focus:outline-none"
                          placeholder="Card name"
                        />
                      </td>

                      {MONTHS.map((m) => (
                        <td key={m} className="text-right px-2 md:px-3 py-2 text-purple-200">
                          <input
                            type="number"
                            value={row[m] ?? 0}
                            onChange={(e) =>
                              handleCellChange(rowIndex, m, e.target.value)
                            }
                            className="bg-transparent border border-purple-700 rounded px-1 py-1 w-20 text-right focus:border-purple-500 focus:outline-none"
                            min="0"
                          />
                        </td>
                      ))}

                      <td className="text-right px-2 md:px-3 py-2 font-semibold text-amber-300">
                        ₹{total.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ============ ANALYTICS VIEW ============ */}
      {viewMode === "analytics" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <SummaryCard title="Total Spend" value={`₹${totalSpend.toLocaleString()}`} amount={totalSpend} />
            <SummaryCard title="Most Used Card" value={mostUsed?.card || "-"} amount={mostUsed?.total} />
            <SummaryCard title="Least Used Card" value={leastUsed?.card || "-"} amount={leastUsed?.total} />
            <SummaryCard title="Unused Cards" value={unusedCards.length} />
          </div>

          {/* Rest of analytics sections remain same... */}
          <Section title="Unused Cards">
            {unusedCards.length === 0 ? (
              <p className="text-gray-400">No unused cards 🎉</p>
            ) : (
              <ul className="list-disc list-inside text-purple-300 space-y-1">
                {unusedCards.map((card) => (
                  <li key={card}>{card}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* Pie + Bar charts */}
          <Section title="Spends Overview (Pie & Bar)">
            {pieData.length === 0 ? (
              <p className="text-gray-400">No usage data. Upload Excel first.</p>
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
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                      <XAxis dataKey="name" tick={{ fill: "#e9d5ff", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#e9d5ff", fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" name="Total Spend" fill="#facc15" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Section>

          {/* Monthly totals */}
          <Section title="Monthly Spends" icon={<Calendar className="w-5 h-5" />}>
            <div className="w-full h-80 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTotals} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
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
                  <Bar dataKey="total" name="Total Spend" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Card Insights */}
          <Section title="Card-wise Insights">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cardInsights.map((insight) => (
                <div key={insight.card} className="bg-black/40 border border-purple-800 rounded-xl p-4 md:p-5">
                  <h3 className="text-lg font-semibold text-purple-300 mb-3">{insight.card}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Total Spent</div>
                    <div className="text-amber-300 font-semibold">₹{insight.total.toLocaleString()}</div>
                    <div>Usage %</div>
                    <div className="text-cyan-300 font-semibold">{insight.percentOfTotal}%</div>
                    <div>Avg/Month</div>
                    <div className="text-pink-300 font-semibold">₹{insight.avgPerMonth.toLocaleString()}</div>
                    <div>Months Used</div>
                    <div className="text-purple-300">{insight.usedMonths}</div>
                    <div>Unused Months</div>
                    <div className="text-gray-300">{insight.unusedMonths}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
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
      <div className="text-lg md:text-xl font-semibold text-white">{value}</div>
      {amount !== undefined && (
        <div className="text-amber-300 font-extrabold text-sm md:text-base">
          ₹{amount.toLocaleString()}
        </div>
      )}
    </div>
  );
}
