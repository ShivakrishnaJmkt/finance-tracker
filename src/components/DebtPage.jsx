// components/DebtPage.jsx
import { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { collection, doc, writeBatch, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { CreditCard } from "lucide-react";

/* ============ CONSTANTS ============ */
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

/* ============ MAIN COMPONENT ============ */
export default function DebtPage() {
  const { user } = useAuth();
  const [debts, setDebts] = useState([]); // {id,lender,amount}
  const [viewMode, setViewMode] = useState("analytics"); // analytics | excel
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  /* -------- Load data from Firestore on mount -------- */
  useEffect(() => {
    if (!user?.uid) return;

    const loadDebts = async () => {
      try {
        setLoadingData(true);
        const debtsCol = collection(db, "users", user.uid, "debts");
        const snap = await getDocs(debtsCol);
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setDebts(data);
        console.log("debts from firestore", data);
      } catch (err) {
        console.error("Load debts error", err);
        setError("Cloud నుంచీ data load అవడంలో సమస్య వచ్చింది.");
      } finally {
        setLoadingData(false);
      }
    };

    loadDebts();
  }, [user?.uid]);

  /* -------- Excel upload (Lender + amount) -------- */
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setError("");
    setUploading(true);

    try {
      const debtsCol = collection(db, "users", user.uid, "debts");

      // 1) delete old docs
      const oldSnap = await getDocs(debtsCol);
      const deleteBatch = writeBatch(db);
      oldSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
      await deleteBatch.commit();

      // 2) read excel
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          if (!sheet) throw new Error("Sheet not found");

          const rows = XLSX.utils.sheet_to_json(sheet);// [{Lender:..., amount:...}, ...]

          console.log("RAW EXCEL ROWS ===>", rows);

          const batch = writeBatch(db);

          rows.forEach((row) => {
            const lenderName = row["Lender"];
            const amount = Number(row["amount"] || 0); // header must be 'amount'

            if (!lenderName || amount <= 0) return;

            const id = String(lenderName).trim();
            const ref = doc(debtsCol, id);
            batch.set(ref, {
              lender: id,
              amount,
            });
          });

          await batch.commit();

          // 3) reload into state
          const snapAfter = await getDocs(debtsCol);
          const dataAfter = snapAfter.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setDebts(dataAfter);
          console.log("debts after upload", dataAfter);
          alert("Debts uploaded from Excel ✅");
        } catch (err) {
          console.error("Excel process error", err);
          setError("Excel చదవడంలో లేదా save చేయడంలో సమస్య వచ్చింది.");
        } finally {
          setUploading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Upload error", err);
      setError("Upload failed, మరొకసారి ప్రయత్నించండి.");
      setUploading(false);
    }
  };

  /* -------- Add empty row -------- */
  const handleAddRow = () => {
    setDebts((prev) => [
      ...prev,
      { id: Date.now().toString(), lender: "", amount: 0 },
    ]);
  };

  /* -------- Cell change -------- */
  const handleCellChange = (rowIndex, field, value) => {
    setDebts((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              [field]: field === "lender" ? value : Number(value) || 0,
            }
          : row
      )
    );
  };

  /* -------- Save to Firestore (from table) -------- */
  const handleSaveDebts = async () => {
    if (!user?.uid) return;

    try {
      const debtsCol = collection(db, "users", user.uid, "debts");
      const batch = writeBatch(db);

      // overwrite using lender name as doc id
      debts.forEach((row) => {
        if (!row.lender || row.amount <= 0) return;
        const id = String(row.lender).trim();
        const ref = doc(debtsCol, id);
        batch.set(ref, {
          lender: id,
          amount: Number(row.amount) || 0,
        });
      });

      await batch.commit();
      alert("Debts saved to cloud ✅");
    } catch (err) {
      console.error("Save debts error", err);
      alert("Saving failed, try again ❌");
    }
  };

  /* ============ DERIVED DATA ============ */
  const validDebts = useMemo(
    () => debts.filter((d) => d.lender && d.amount > 0),
    [debts]
  );

  const totalAmount = validDebts.reduce((s, d) => s + d.amount, 0);

  const pieData = useMemo(
    () =>
      validDebts.map((d) => ({
        name: d.lender,
        amount: d.amount,
      })),
    [validDebts]
  );

  /* ============ LOADING UI ============ */
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center px-4">
        <p className="text-xl text-purple-200">Debts load అవుతున్నాయి...</p>
      </div>
    );
  }

  /* ============ MAIN UI ============ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white px-4 py-10 md:px-8 md:py-14">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-10 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-300">
        Debt Tracker
      </h1>

      {/* Toggle */}
      <div className="flex justify-center gap-4 mb-10">
        <button
          onClick={() => setViewMode("analytics")}
          className={`px-4 py-2 rounded-xl text-sm md:text-base font-semibold transition ${
            viewMode === "analytics"
              ? "bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/40"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setViewMode("excel")}
          className={`px-4 py-2 rounded-xl text-sm md:text-base font-semibold transition ${
            viewMode === "excel"
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          📋 Excel View
        </button>
      </div>

      {/* EXCEL VIEW */}
      {viewMode === "excel" && (
        <Section title="Debt – Excel Style" icon={<CreditCard className="w-5 h-5" />}>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
            />
            <button
              onClick={handleAddRow}
              className="px-3 py-2 rounded-lg bg-purple-600 text-xs md:text-sm hover:bg-purple-700"
            >
              + Add Debt
            </button>
            <button
              onClick={handleSaveDebts}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-xs md:text-sm hover:bg-emerald-700"
            >
              💾 Save to Cloud
            </button>
          </div>

          {uploading && (
            <p className="text-xs text-blue-200 mb-2">
              Uploading & replacing old data...
            </p>
          )}
          {error && (
            <p className="text-xs text-red-300 mb-2">
              {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-white/20 bg-black/10">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 py-2 text-left">Lender</th>
                  <th className="px-3 py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((row, rowIndex) => (
                  <tr
                    key={row.id || rowIndex}
                    className="border-t border-white/10 odd:bg-white/5"
                  >
                    <td className="px-3 py-2">
                      <input
                        value={row.lender || ""}
                        onChange={(e) =>
                          handleCellChange(rowIndex, "lender", e.target.value)
                        }
                        className="w-full bg-transparent border border-white/30 rounded px-2 py-1 focus:outline-none focus:border-purple-400"
                        placeholder="Axis / Stan Chart / Gold loan"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={row.amount || 0}
                        onChange={(e) =>
                          handleCellChange(rowIndex, "amount", e.target.value)
                        }
                        className="w-24 bg-transparent border border-white/30 rounded px-2 py-1 text-right focus:outline-none focus:border-emerald-400"
                        min="0"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-yellow-500/20 font-semibold border-t border-yellow-300/60">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right text-amber-300">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ANALYTICS VIEW */}
      {viewMode === "analytics" && (
        <>
          <Section
            title="Total Debt"
            icon={<CreditCard className="w-5 h-5" />}
          >
            <div className="text-center py-6">
              <div className="text-4xl md:text-5xl font-bold text-amber-300 mb-2">
                ₹{totalAmount.toLocaleString("en-IN")}
              </div>
              <p className="text-sm text-purple-200">
                Active loans: {validDebts.length}
              </p>
            </div>
          </Section>

          <Section title="Debt Distribution" icon={<CreditCard className="w-5 h-5" />}>
            {pieData.length === 0 ? (
              <p className="text-center text-sm text-gray-200 py-10">
                Debt data లేదు. Excel view లో debts add చేసి save చేయండి.
              </p>
            ) : (
              <div className="h-80 md:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        `${Number(value).toLocaleString("en-IN")} ₹`
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* ============ SHARED SECTION COMPONENT ============ */
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
