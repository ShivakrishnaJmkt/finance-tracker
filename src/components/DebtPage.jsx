// components/DebtPage.jsx
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const DEBT_DATA = [
  { name: "Axis", amount: 232000 },
  { name: "Stan Chart", amount: 401734 },
  { name: "Gold Loan", amount: 159000 },
  { name: "RAJAIAH", amount: 62000 },
  { name: "Sammakka", amount: 59000 },
  { name: "NSK", amount: 34000 },
  { name: "Harish", amount: 26000 },
  { name: "TGB", amount: 6444 },
];

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#8dd1e1",
  "#a4de6c",
  "#d0ed57",
];

const totalAmount = DEBT_DATA.reduce((sum, d) => sum + d.amount, 0);

export default function DebtPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold mb-2">Debt Overview</h1>

      {/* Excel-style table */}
      <div className="overflow-x-auto max-w-md border border-zinc-700 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900">
            <tr>
              <th className="px-3 py-2 border-b border-zinc-700 text-left">
                Loan
              </th>
              <th className="px-3 py-2 border-b border-zinc-700 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {DEBT_DATA.map((row) => (
              <tr key={row.name} className="odd:bg-zinc-950 even:bg-zinc-900">
                <td className="px-3 py-1 border-b border-zinc-800">
                  {row.name}
                </td>
                <td className="px-3 py-1 border-b border-zinc-800 text-right">
                  {row.amount.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
            <tr className="bg-yellow-900/40 font-semibold">
              <td className="px-3 py-1 border-t border-zinc-700">Total</td>
              <td className="px-3 py-1 border-t border-zinc-700 text-right">
                {totalAmount.toLocaleString("en-IN")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pie chart */}
      <div className="h-80 w-full max-w-xl">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={DEBT_DATA}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(1)}%`
              }
            >
              {DEBT_DATA.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                value.toLocaleString("en-IN") + " ₹"
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
