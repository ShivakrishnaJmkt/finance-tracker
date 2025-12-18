import { useState, useEffect } from "react";
import { Wallet, Upload } from "lucide-react";
import * as XLSX from "xlsx";

const getMonthTotal = (monthData = {}) =>
  SEGMENTS.reduce((sum, seg) => sum + (Number(monthData[seg]) || 0), 0);


const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const SEGMENTS = ["Rent", "Kirana", "Petrol", "Online Bills"];


// Map Excel segment names to app segment names
const SEGMENT_MAPPING = {
  "rent": "Rent",
  "kirana": "Kirana",
  "petrol": "Petrol",
  "online": "Online Bills",
  
};




export default function TracksPage() {
  const [segmentMonthly, setSegmentMonthly] = useState(() =>
    MONTHS.reduce((acc, month) => {
      acc[month] = SEGMENTS.reduce(
        (inner, seg) => ({ ...inner, [seg]: 0 }),
        {}
      );
      return acc;
    }, {})
  );



  const [uploadStatus, setUploadStatus] = useState("");

  // LOAD from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("segmentMonthly");
    if (saved) {
        try{
                setSegmentMonthly(JSON.parse(saved));
        } catch {

        }
      
    }
  }, []);

  // SAVE to localStorage on change
  useEffect(() => {
    localStorage.setItem("segmentMonthly", JSON.stringify(segmentMonthly));
  }, [segmentMonthly]);

  // Handle XLSX file upload
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
  acc[month] = SEGMENTS.reduce(
    (inner, seg) => ({ ...inner, [seg]: 0 }),
    {}
  );
  return acc;
}, {});

let currentMonth = null;

rows.forEach((row) => {
  if (!row || row.length < 3) return;

  const rawMonth = String(row[0] || "").trim();   // month name or ""
  const segCell  = String(row[1] || "").trim();   // segment name or ""
  const amtCell  = row[2];                        // amount

  // month row ఉంటే
  if (rawMonth) {
    const monthMatch = MONTHS.find(
      (m) => m.toLowerCase() === rawMonth.toLowerCase()
    );
    if (monthMatch) currentMonth = monthMatch;
  }

  // segment row
  if (!currentMonth || !segCell) return;

  const key = segCell.toLowerCase();              // rent/kirana/petrol/online
  const mappedSegment = SEGMENT_MAPPING[key];
  if (!mappedSegment || !SEGMENTS.includes(mappedSegment)) return;

  const amount = parseFloat(amtCell) || 0;
  parsed[currentMonth][mappedSegment] = amount;
});

    
        setSegmentMonthly(parsed);
        setUploadStatus("✓ File uploaded successfully!");
        setTimeout(() => setUploadStatus(""), 3000);


    } catch (err) {
    setUploadStatus("✗ Error parsing file: " + err.message);
    }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSegmentChange = (month, segment, value) => {
    setSegmentMonthly((prev) => ({
      ...prev,
      [month]: { ...prev[month], [segment]: Number(value || 0) },
    }));
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-3xl md:text-4xl font-bold text-purple-400 mb-6">
        Segment Tracks
      </h1>

    {/* Upload Section */}
      <Section
        title="Upload Excel File"
        icon={<Upload className="w-5 h-5" />}
      >
        <div className="flex flex-col md:flex-row items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="px-4 py-2 bg-black/60 border border-purple-700 rounded-lg cursor-pointer hover:border-purple-400 transition text-sm"
          />
          {uploadStatus && (
            <div
              className={`text-sm font-semibold ${
                uploadStatus.includes("✓")
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {uploadStatus}
            </div>
          )}
        </div>
      </Section>


      
              <Section title="Month-wise Segments (Excel View)" icon={<Wallet className="w-5 h-5" />}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm text-left border-separate border-spacing-y-1">
            <thead className="bg-purple-900/60">
              <tr>
                <th className="px-3 py-2 rounded-l-lg">Month</th>
                {SEGMENTS.map((seg) => (
                  <th key={seg} className="px-3 py-2">{seg}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month) => {
                const data = segmentMonthly[month] || {};
                const total = getMonthTotal(data);

            return (

    
                <tr key={month} className="bg-purple-900/20">
                  <td className="px-3 py-2 font-semibold text-purple-200 rounded-l-lg">
                    {month}
                  </td>
                  {SEGMENTS.map((seg) => (
                    <td key={seg} className="px-3 py-2">
                      ₹{data[seg] ?? 0}
                    </td>
                  ))}
                    <td className="px-3 py-2 font-semibold text-purple-100 rounded-r-lg">
                ₹{total}
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
    <div className="bg-gradient-to-r from-purple-900 to-black rounded-2xl p-4 md:p-6 mb-6 shadow-lg shadow-purple-900/40">
      <div className="flex items-center gap-2 text-purple-300 mb-4">
        {icon}
        <h2 className="font-semibold text-base md:text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SegmentMonthForm({ month, data, onChange }) {
  const safeData = data || { Rent: 0, Kirana: 0, Petrol: 0, "Online Bills": 0 };


  return (
    <div className="bg-black/40 border border-purple-800 rounded-xl p-4 mb-4">
      <h3 className="text-purple-300 font-semibold mb-3">{month}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {SEGMENTS.map((seg) => (
          <div key={seg}>
            <label className="block text-xs text-purple-300 mb-1">
              {seg}
            </label>
            <input
              type="number"
              value={safeData[seg] ?? 0}
              onChange={(e) => onChange(month, seg, e.target.value)}
              className="w-full rounded-lg bg-black/60 border border-purple-700 px-2 py-1 text-xs outline-none focus:border-purple-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

