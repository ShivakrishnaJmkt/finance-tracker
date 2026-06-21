import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, doc, writeBatch } from "firebase/firestore";
import {
  FolderKanban,
  Save,
  CalendarDays,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { formatMoney } from "../utils/financeNormalize";

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

const MONTH_MAP = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

const CATEGORY_KEYS = ["Rent", "Kirana", "Petrol", "Online Bills"];

const buildEmptyRows = () =>
  MONTHS.map((month) => ({
    month,
    Rent: 0,
    Kirana: 0,
    Petrol: 0,
    "Online Bills": 0,
  }));

const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear + 2; year >= currentYear - 5; year--) {
    years.push(year);
  }
  return years;
};

export default function TracksPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [rows, setRows] = useState(buildEmptyRows());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const yearOptions = useMemo(() => getYearOptions(), []);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    const ref = collection(db, `users/${user.uid}/segments`);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const yearDocs = docs.filter(
          (item) => Number(item.year) === Number(selectedYear)
        );

        const merged = buildEmptyRows().map((row) => {
          const docMatch = yearDocs.find((item) => item.month === row.month);
          if (!docMatch) return row;

          const categories = docMatch.categories || {};
          return {
            month: row.month,
            Rent: Number(categories.Rent || 0),
            Kirana: Number(categories.Kirana || 0),
            Petrol: Number(categories.Petrol || 0),
            "Online Bills": Number(categories["Online Bills"] || 0),
          };
        });

        setRows(merged);
        setLoading(false);
      },
      (err) => {
        console.error("Segments load error", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, selectedYear]);

  const updateCell = (month, key, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.month === month
          ? { ...row, [key]: Number(value || 0) }
          : row
      )
    );
  };

  const rowsWithTotals = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      total: CATEGORY_KEYS.reduce(
        (sum, key) => sum + Number(row[key] || 0),
        0
      ),
    }));
  }, [rows]);

  const categoryYearTotals = useMemo(() => {
    return CATEGORY_KEYS.reduce((acc, key) => {
      acc[key] = rowsWithTotals.reduce(
        (sum, row) => sum + Number(row[key] || 0),
        0
      );
      return acc;
    }, {});
  }, [rowsWithTotals]);

  const grandTotal = useMemo(() => {
    return rowsWithTotals.reduce((sum, row) => sum + Number(row.total || 0), 0);
  }, [rowsWithTotals]);

  const highestSpendMonth = useMemo(() => {
    if (!rowsWithTotals.length) {
      return { month: "-", total: 0 };
    }

    return rowsWithTotals.reduce((max, row) => {
      return Number(row.total || 0) > Number(max.total || 0) ? row : max;
    }, rowsWithTotals[0]);
  }, [rowsWithTotals]);

  const averageMeta = useMemo(() => {
    const now = new Date();
    const currentMonthNumber = now.getMonth() + 1;

    const monthsToDivide =
      Number(selectedYear) === now.getFullYear() ? currentMonthNumber : 12;

    const average = monthsToDivide > 0 ? grandTotal / monthsToDivide : 0;

    return {
      monthsToDivide,
      average,
    };
  }, [selectedYear, grandTotal]);

  const handleSave = async () => {
    if (!user?.uid) return;

    try {
      setSaving(true);
      const batch = writeBatch(db);

      rowsWithTotals.forEach((row) => {
        const monthNumber = MONTH_MAP[row.month] || "01";

        batch.set(
          doc(db, `users/${user.uid}/segments/${selectedYear}-${row.month}`),
          {
            year: Number(selectedYear),
            month: row.month,
            monthNumber,
            categories: CATEGORY_KEYS.reduce((acc, key) => {
              acc[key] = Number(row[key] || 0);
              return acc;
            }, {}),
            total: Number(row.total || 0),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        batch.set(
          doc(db, `users/${user.uid}/monthly/${selectedYear}-${row.month}`),
          {
            year: Number(selectedYear),
            month: row.month,
            monthNumber,
            amount: Number(row.total || 0),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      alert(`Tracks saved successfully for ${selectedYear}`);
    } catch (err) {
      console.error(err);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        Loading tracks...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Tracks</h1>
            <p className="text-sm text-white/60 mt-2">
              Manage monthly categorized spending and yearly totals in one place.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-cyan-300" />
            <span className="text-sm text-white/70">Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-[#08112b] border border-blue-900/70 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-fuchsia-200" />
            <h2 className="text-2xl md:text-3xl font-bold text-fuchsia-100">
              Yearly Totals
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7 gap-4">
            {CATEGORY_KEYS.map((key) => (
              <div
                key={key}
                className="rounded-3xl border border-fuchsia-400/40 bg-black/20 p-5"
              >
                <div className="text-sm text-white/70 mb-2">{key}</div>
                <div className="text-3xl font-bold text-yellow-300">
                  {formatMoney(categoryYearTotals[key] || 0)}
                </div>
              </div>
            ))}

            <div className="rounded-3xl border border-cyan-400/60 bg-cyan-950/20 p-5">
              <div className="text-sm text-cyan-100 mb-2">Grand Total</div>
              <div className="text-3xl font-bold text-emerald-300">
                {formatMoney(grandTotal)}
              </div>
            </div>

            <div className="rounded-3xl border border-orange-400/50 bg-orange-950/20 p-5">
              <div className="text-sm text-orange-100 mb-2">Highest Spend Month</div>
              <div className="text-xl font-bold text-yellow-300">
                {highestSpendMonth.month}
              </div>
              <div className="text-lg font-semibold text-white mt-2">
                {formatMoney(highestSpendMonth.total || 0)}
              </div>
            </div>

            <div className="rounded-3xl border border-sky-400/50 bg-sky-950/20 p-5">
              <div className="text-sm text-sky-100 mb-2">YTD Average / Month</div>
              <div className="text-3xl font-bold text-cyan-300">
                {formatMoney(averageMeta.average)}
              </div>
              <div className="text-xs text-white/60 mt-2">
                Total ÷ {averageMeta.monthsToDivide} month(s)
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <FolderKanban className="w-6 h-6 text-fuchsia-200" />
              <h2 className="text-2xl md:text-3xl font-bold text-fuchsia-100">
                Data Editor
              </h2>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : `Save ${selectedYear} to Cloud`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/10 text-white/80">
                <tr>
                  <th className="px-5 py-4 text-left">Month</th>
                  {CATEGORY_KEYS.map((key) => (
                    <th key={key} className="px-5 py-4 text-left">
                      {key}
                    </th>
                  ))}
                  <th className="px-5 py-4 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {rowsWithTotals.map((row) => (
                  <tr key={row.month} className="border-t border-white/10">
                    <td className="px-5 py-4 font-medium">{row.month}</td>

                    {CATEGORY_KEYS.map((key) => (
                      <td key={key} className="px-5 py-3">
                        <input
                          type="number"
                          min="0"
                          value={row[key]}
                          onChange={(e) =>
                            updateCell(row.month, key, e.target.value)
                          }
                          className="w-32 rounded-2xl border border-fuchsia-500/50 bg-black/40 px-4 py-2 outline-none"
                        />
                      </td>
                    ))}

                    <td className="px-5 py-4 text-right font-bold text-yellow-300">
                      {formatMoney(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-white/10 bg-black/30">
                  <td className="px-5 py-4 font-bold">TOTAL ({selectedYear})</td>
                  {CATEGORY_KEYS.map((key) => (
                    <td key={key} className="px-5 py-4 font-semibold text-white/70">
                      {formatMoney(categoryYearTotals[key] || 0)}
                    </td>
                  ))}
                  <td className="px-5 py-4 text-right font-bold text-emerald-300">
                    {formatMoney(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}