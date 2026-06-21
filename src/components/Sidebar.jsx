import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  Activity,
  Landmark,
  Shield,
  FileText,
  TrendingUp,
  BarChart3,
  LogOut,
  CalendarDays,
} from "lucide-react";
import AppShell from "./components/AppShell";
const navItems = [
  { key: "credit-cards", label: "Credit Cards", icon: CreditCard },
  { key: "monthly-expenditure", label: "Monthly Expenditure", icon: Receipt },
  { key: "tracks", label: "Tracks", icon: Activity },
  { key: "debt", label: "Debt", icon: Landmark },
  { key: "lic-policies", label: "LIC Policies", icon: Shield },
  { key: "statement", label: "Statement", icon: FileText },
  { key: "net-worth", label: "Net Worth", icon: TrendingUp },
  { key: "projection", label: "Projection", icon: BarChart3 },
];

export default function Sidebar({
  user,
  selectedYear,
  setSelectedYear,
  YEARS,
  activeKey,
  onNavigate,
  onSignOut,
}) {
  return (
    <aside className="w-[290px] min-h-screen bg-[#050816] border-r border-white/10 text-white px-4 py-5 flex flex-col">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Credix</h1>
            <p className="text-xs text-white/50">Personal Finance OS</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
        <div className="flex flex-col items-center text-center">
          <img
            src={user?.photoURL || "https://i.pravatar.cc/100?img=12"}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400/40 shadow-lg shadow-cyan-900/30"
          />
          <h2 className="mt-3 text-sm font-semibold break-all">
            {user?.email || "user@email.com"}
          </h2>
          <p className="text-xs text-white/45 mt-1">Finance dashboard owner</p>
        </div>

        <div className="mt-4">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">
            Year
          </label>
          <div className="relative">
            <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/80" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-black/30 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm outline-none focus:border-cyan-400"
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 flex-1">
        <div className="px-2 mb-3 text-[11px] uppercase tracking-[0.22em] text-white/35">
          Workspace
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;

            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/30 border border-white/10"
                    : "text-white/75 hover:text-white hover:bg-white/[0.05] border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-cyan-300"}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-5 mt-5 border-t border-white/10">
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm bg-white/[0.04] hover:bg-red-500/15 border border-white/10 hover:border-red-400/30 transition"
        >
          <LogOut className="w-4 h-4 text-red-300" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}