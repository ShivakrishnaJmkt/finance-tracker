// components/TracksPage.jsx
import { useState, useEffect, useMemo } from "react";
import { Wallet, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { collection, doc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const SEGMENTS = ["Rent", "Kirana", "Petrol", "Online Bills"];

const SEGMENT_MAPPING = {
  rent: "Rent",
  kirana: "Kirana",
  petrol: "Petrol",
  online: "Online Bills",
};

const getMonthTotal = (monthData = {}) =>
  SEGMENTS.reduce((sum, seg) => sum + (Number(monthData[seg]) || 0), 0);

export default function TracksPage() {
  const { user } = useAuth();
  const [editingData, setEditingData] = useState({});
  const [uploadStatus, setUploadStatus] = useState("");
  const [loading, setLoading] = useState(false);

  /* ============ LOAD FROM FIRESTORE ============ */
  useEffect(() => {
    if (!user?.uid) return;

    const loadTracks = async () => {
      try {
        setLoading(true);
        const col = collection(db, "users", user.uid, "tracks");
        const snap = await getDocs(col);

        // We will store as single doc per month: {month, segments:{...}}
        const data = {};
        snap.docs.forEach((d) => {
          const docData = d.data();
          const month = docData.month;
          data[month] = docData.segments || {};
        });

        setEditingData(data);
      } catch (err) {
        console.error("Load tracks error", err);
      } finally {
        setLoading(false);
      }
    };

    loadTracks();
  }, [user?.uid]);

  /* ============ EXCEL UPLOAD ============ */
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !user?.uid) return;

    setUploadStatus("Reading file...");
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Assume layout: Month | Segment | Amount (same as your current logic)
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const parsed = MONTHS.reduce((acc, month) => {
          acc[month] = SEGMENTS.reduce(
            (inner, seg) => ({ ...inner, [seg]: 0 }),
            {}
          );
          return acc;
        }, {});

        let currentMonth = null;
        rows.forEach((row) => {
          if (!row || row.length < 3) return;

          const rawMonth = String(row[0] || "").trim();
          const segCell = String(row[1] || "").trim();
          const amtCell = row[2];

          if (rawMonth) {
            const monthMatch = MONTHS.find(
              (m) => m.toLowerCase() === rawMonth.toLowerCase()
            );
            if (monthMatch) currentMonth = monthMatch;
          }

          if (!currentMonth || !segCell) return;
          const key = segCell.toLowerCase();
          const mappedSegment = SEGMENT_MAPPING[key];
          if (!mappedSegment) return;

          parsed[currentMonth][mappedSegment] = Number(amtCell) || 0;
        });

        // Save to Firestore
        const col = collection(db, "users", user.uid, "tracks");
        const snap = await getDocs(col);
        const batch = writeBatch(db);

        // delete old docs
        snap.docs.forEach((d) => batch.delete(d.ref));

        // create one doc per month
        MONTHS.forEach((month) => {
          const segments = parsed[month] || {};
          const ref = doc(col, month); // month as id
          batch.set(ref, { month, segments });
        });

        await batch.commit();

        setEditingData(parsed);
        setUploadStatus("✓ Excel uploaded & saved to cloud");
        setTimeout(() => setUploadStatus(""), 3000);
      } catch (err) {
        console.error(err);
        setUploadStatus("✗ Error: " + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  /* ============ MANUAL EDIT SAVE ============ */
  const handleSaveToCloud = async () => {
    if (!user?.uid) return;
    try {
      const col = collection(db, "users", user.uid, "tracks");
      const snap = await getDocs(col);
      const batch = writeBatch(db);

      // delete old
      snap.docs.forEach((d) => batch.delete(d.ref));

      // save current editingData
      MONTHS.forEach((month) => {
        const segments = editingData[month] || {};
        const ref = doc(col, month);
        batch.set(ref, { month, segments });
      });

      await batch.commit();
      setUploadStatus("✓ Saved to cloud");
      setTimeout(() => setUploadStatus(""), 3000);
    } catch (err) {
      console.error("Save tracks error", err);
      setUploadStatus("✗ Save failed");
      setTimeout(() => setUploadStatus(""), 3000);
    }
  };

  /* ============ LOCAL EDIT ============ */
  const handleSegmentChange = (month, segment, value) => {
    const newData = {
      ...editingData,
      [month]: {
        ...(editingData[month] || {}),
        [segment]: Number(value || 0),
      },
    };
    setEditingData(newData);
  };

  /* ============ ANALYTICS DATA ============ */
  const chartData = useMemo(
    () =>
      MONTHS.map((month) => ({
        month: month.slice(0, 3),
        Rent: editingData[month]?.Rent || 0,
        Kirana: editingData[month]?.Kirana || 0,
        Petrol: editingData[month]?.Petrol || 0,
        "Online Bills": editingData[month]?.["Online Bills"] || 0,
        total: getMonthTotal(editingData[month]),
      })),
    [editingData]
  );

  const yearlyTotals = useMemo(
    () =>
      SEGMENTS.map((seg) => ({
        segment: seg,
        amount: MONTHS.reduce(
          (sum, m) => sum + (Number(editingData[m]?.[seg]) || 0),
          0
        ),
      })),
    [editingData]
  );

  /* ============ UI ============ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black text-white px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-8">
        Segment Tracks
      </h1>

      {/* Upload + Save */}
      <Section title="Excel Upload & Cloud Save" icon={<Upload className="w-6 h-6" />}>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-purple-700 file:text-white hover:file:from-purple-700 file:hover:to-purple-800 px-4 py-3 bg-black/50 border-2 border-purple-800 rounded-xl text-sm w-full md:w-auto"
          />
          <button
            onClick={handleSaveToCloud}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold shadow-lg shadow-emerald-500/30"
          >
            💾 Save current table to Cloud
          </button>
          {uploadStatus && (
            <div
              className={`px-3 py-2 rounded-xl text-xs md:text-sm border ${
                uploadStatus.startsWith("✓")
                  ? "border-emerald-500/60 bg-emerald-900/40 text-emerald-300"
                  : "border-red-500/60 bg-red-900/40 text-red-300"
              }`}
            >
              {uploadStatus}
            </div>
          )}
        </div>
      </Section>

      {/* Chart */}
      <Section title="Monthly Segment Chart" icon={<Wallet className="w-6 h-6" />}>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fill: "#a1a1aa" }} />
              <YAxis tick={{ fill: "#a1a1aa" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Rent" fill="#8b5cf6" />
              <Bar dataKey="Kirana" fill="#10b981" />
              <Bar dataKey="Petrol" fill="#f59e0b" />
              <Bar dataKey="Online Bills" fill="#ef4444" />
              <Bar dataKey="total" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Year summary */}
      <Section title="Yearly Totals" icon={<Wallet className="w-6 h-6" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {yearlyTotals.map((row) => (
            <div
              key={row.segment}
              className="bg-black/40 border border-purple-800 rounded-xl p-4 text-center"
            >
              <div className="text-sm text-purple-200">{row.segment}</div>
              <div className="text-lg font-bold text-amber-300">
                ₹{row.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Editable table */}
      <Section title="Data Editor" icon={<Wallet className="w-6 h-6" />}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-purple-900/80 to-black/60">
              <tr>
                <th className="px-6 py-4 text-left font-black text-purple-200 rounded-l-2xl">
                  Month
                </th>
                {SEGMENTS.map((seg) => (
                  <th
                    key={seg}
                    className="px-6 py-4 font-black text-purple-200"
                  >
                    {seg}
                  </th>
                ))}
                <th className="px-6 py-4 text-right font-black text-purple-200 rounded-r-2xl">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month) => {
                const data = editingData[month] || {};
                const total = getMonthTotal(data);
                return (
                  <tr
                    key={month}
                    className="bg-gradient-to-r from-black/50 to-purple-900/20 hover:from-purple-900/40 border-b border-purple-900/30"
                  >
                    <td className="px-6 py-4 font-bold text-purple-300">
                      {month}
                    </td>
                    {SEGMENTS.map((seg) => (
                      <td key={seg} className="px-6 py-4">
                        <input
                          type="number"
                          value={data[seg] ?? 0}
                          onChange={(e) =>
                            handleSegmentChange(month, seg, e.target.value)
                          }
                          className="w-28 bg-black/70 border border-purple-700 rounded-xl px-3 py-2 text-purple-100 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-6 py-4 font-bold text-right text-amber-400">
                      ₹{total.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ============ SHARED SECTION ============ */
function Section({ title, icon, children }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/70 to-black/50 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-2xl shadow-purple-500/30 border border-purple-900/50">
      <div className="flex items-center gap-4 mb-6">
        {icon}
        <h2 className="font-black text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
