import { useState, useEffect } from "react";
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

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SEGMENTS = ["Rent", "Kirana", "Petrol", "Online Bills"];
const SEGMENT_MAPPING = {"rent": "Rent","kirana": "Kirana","petrol": "Petrol","online": "Online Bills"};

const getMonthTotal = (monthData = {}) => SEGMENTS.reduce((sum, seg) => sum + (Number(monthData[seg]) || 0), 0);

export default function TracksPage({ segmentMonthly, setSegmentMonthly }) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [editingData, setEditingData] = useState({});

  // 🔥 Sync local edits with App state (CardsPage style)
  useEffect(() => {
    setEditingData(segmentMonthly || {});
  }, [segmentMonthly]);
  

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const parsed = MONTHS.reduce((acc, month) => {
          acc[month] = SEGMENTS.reduce((inner, seg) => ({ ...inner, [seg]: 0 }), {});
          return acc;
        }, {});

        let currentMonth = null;
        rows.forEach((row) => {
          if (!row || row.length < 3) return;
          const rawMonth = String(row[0] || "").trim();
          const segCell = String(row[1] || "").trim();
          const amtCell = row[2];

          if (rawMonth) {
            const monthMatch = MONTHS.find(m => m.toLowerCase() === rawMonth.toLowerCase());
            if (monthMatch) currentMonth = monthMatch;
          }

          if (!currentMonth || !segCell) return;
          const key = segCell.toLowerCase();
          const mappedSegment = SEGMENT_MAPPING[key];
          if (!mappedSegment) return;

          parsed[currentMonth][mappedSegment] = parseFloat(amtCell) || 0;
        });

        // 🔥 EXACT CardsPage pattern - setSegmentMonthly triggers App.jsx → Firestore
        setSegmentMonthly(parsed);
        setUploadStatus("✓ Saved permanently!");
        setTimeout(() => setUploadStatus(""), 3000);
      } catch (err) {
        setUploadStatus("✗ Error: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSegmentChange = (month, segment, value) => {
    const newData = {
      ...editingData,
      [month]: { 
        ...editingData[month], 
        [segment]: Number(value || 0) 
      }
    };
    
    // 🔥 Update local + App state (triggers Firestore)
    setEditingData(newData);
    setSegmentMonthly(newData);
  };

  const chartData = MONTHS.map((month) => ({
    month: month.slice(0,3),
    Rent: editingData[month]?.Rent || 0,
    Kirana: editingData[month]?.Kirana || 0,
    Petrol: editingData[month]?.Petrol || 0,
    "Online Bills": editingData[month]?.["Online Bills"] || 0,
    total: getMonthTotal(editingData[month]),
  }));

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-8">
        Segment Tracks
      </h1>

      {/* Upload */}
      <Section title="Excel Upload" icon={<Upload className="w-6 h-6" />}>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-purple-700 file:text-white hover:file:from-purple-700 file:hover:to-purple-800 px-4 py-3 bg-black/50 border-2 border-purple-800 rounded-xl text-sm w-full md:w-auto"
          />
          {uploadStatus && (
            <div className={`p-3 rounded-xl font-semibold border ${
              uploadStatus.includes("✓") 
                ? "text-green-400 bg-green-900/40 border-green-500/50" 
                : "text-red-400 bg-red-900/40 border-red-500/50"
            }`}>
              {uploadStatus}
            </div>
          )}
        </div>
      </Section>

      {/* Chart */}
      <Section title="Trading Chart" icon={<Wallet className="w-6 h-6" />}>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fill: '#a1a1aa' }} />
              <YAxis tick={{ fill: '#a1a1aa' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Rent" fill="url(#rentGradient)" />
              <Bar dataKey="Kirana" fill="url(#kiranaGradient)" />
              <Bar dataKey="Petrol" fill="url(#petrolGradient)" />
              <Bar dataKey="Online Bills" fill="url(#onlineGradient)" />
              <Bar dataKey="total" fill="url(#totalGradient)" />
              <defs>
                <linearGradient id="rentGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="kiranaGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="petrolGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="onlineGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="totalGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Table */}
      <Section title="Data Editor" icon={<Wallet className="w-6 h-6" />}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-purple-900/80 to-black/60">
              <tr>
                <th className="px-6 py-4 text-left font-black text-purple-200 rounded-l-2xl">Month</th>
                {SEGMENTS.map((seg) => (
                  <th key={seg} className="px-6 py-4 font-black text-purple-200">{seg}</th>
                ))}
                <th className="px-6 py-4 text-right font-black text-purple-200 rounded-r-2xl">Total</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month) => {
                const data = editingData[month] || {};
                const total = getMonthTotal(data);
                return (
                  <tr key={month} className="bg-gradient-to-r from-black/50 to-purple-900/20 hover:from-purple-900/40 border-b border-purple-900/30">
                    <td className="px-6 py-4 font-bold text-purple-300">{month}</td>
                    {SEGMENTS.map((seg) => (
                      <td key={seg} className="px-6 py-4">
                        <input
                          type="number"
                          value={data[seg] ?? 0}
                          onChange={(e) => handleSegmentChange(month, seg, e.target.value)}
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

function Section({ title, icon, children }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/70 to-black/50 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-2xl shadow-purple-500/30 border border-purple-900/50">
      <div className="flex items-center gap-4 mb-8">
        {icon}
        <h2 className="font-black text-3xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
