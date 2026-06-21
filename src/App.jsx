import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, query, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Login from "./auth/Login";
import SignUp from "./auth/SignUp";
import CardsPage from "./pages/CardsPage.jsx";
import TracksPage from "./pages/TracksPage.jsx";
import DebtPage from "./pages/DebtPage.jsx";
import LicPoliciesPage from "./pages/LicPoliciesPage.jsx";
import MonthlyStatementPage from "./pages/MonthlyStatementPage.jsx";
import NetWorthPage from "./pages/NetWorthPage.jsx";
import ProjectionPage from "./pages/ProjectionPage.jsx";
import ProfileImageUploader from "./components/ProfilePhotoUploader.jsx";
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
  Menu,
  X,
  LogOut,
  CalendarDays,
} from "lucide-react";

const YEARS = [2024, 2025, 2026, 2027];

const navItems = [
  { to: "/cards", label: "Credit Cards", icon: CreditCard },
  { to: "/tracks", label: "Tracks", icon: Activity },
  { to: "/debts", label: "Debt", icon: Landmark },
  { to: "/lic-policies", label: "LIC Policies", icon: Shield },
  { to: "/statement", label: "Statement", icon: FileText },
  { to: "/networth", label: "Net Worth", icon: TrendingUp },
  { to: "/projection", label: "Projection", icon: BarChart3 },
];

export default function App() {
  const { user, logout } = useAuth();

  const [profileImg, setProfileImg] = useState("/my-profile.jpg");
  const [excelBills, setExcelBills] = useState([]);
  const [excelMonthly, setExcelMonthly] = useState([]);
  const [upiSpends, setUpiSpends] = useState([]);
  const [upiBudgets, setUpiBudgets] = useState({});
  const [segmentMonthly, setSegmentMonthly] = useState({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const billsRef = query(collection(db, `users/${user.uid}/bills`));
    const unsubBills = onSnapshot(billsRef, (snap) => {
      setExcelBills(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const monthlyRef = query(collection(db, `users/${user.uid}/monthly`));
    const unsubMonthly = onSnapshot(monthlyRef, (snap) => {
      setExcelMonthly(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const upiRef = query(collection(db, `users/${user.uid}/upiSpends`));
    const unsubUpi = onSnapshot(upiRef, (snap) => {
      setUpiSpends(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const budgetRef = doc(db, `users/${user.uid}/budgets/budget`);
    const unsubBudget = onSnapshot(budgetRef, (snap) => {
      if (snap.exists()) setUpiBudgets(snap.data());
    });

    const segRef = query(collection(db, `users/${user.uid}/segments`));
    const unsubSeg = onSnapshot(segRef, (snap) => {
      const obj = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.month) {
          obj[data.month] = {
            Rent: data.Rent || 0,
            Kirana: data.Kirana || 0,
            Petrol: data.Petrol || 0,
            "Online Bills": data["Online Bills"] || 0,
          };
        }
      });
      setSegmentMonthly(obj);
    });

    const profileRef = doc(db, `users/${user.uid}/profile/img`);
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfileImg(snap.data().url || "/my-profile.jpg");
      }
    });

    return () => {
      unsubBills();
      unsubMonthly();
      unsubUpi();
      unsubBudget();
      unsubSeg();
      unsubProfile();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!segmentMonthly || Object.keys(segmentMonthly).length === 0) return;

    const save = async () => {
      const userRef = doc(db, `users/${user.uid}`);
      const promises = Object.entries(segmentMonthly).map(async ([month, data]) => {
        const hasValue = ["Rent", "Kirana", "Petrol", "Online Bills"].some(
          (k) => Number(data[k] || 0) !== 0
        );
        if (!hasValue) return;

        await setDoc(doc(userRef, "segments", month), {
          month,
          Rent: data.Rent || 0,
          Kirana: data.Kirana || 0,
          Petrol: data.Petrol || 0,
          "Online Bills": data["Online Bills"] || 0,
          updatedAt: new Date(),
        });
      });

      await Promise.all(promises);
    };

    save().catch(console.error);
  }, [segmentMonthly, user?.uid]);

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
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
            src={profileImg}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400/40 shadow-lg shadow-cyan-900/30"
          />
          <h2 className="mt-3 text-sm font-semibold break-all">
            {user.email || "User"}
          </h2>
          <p className="text-xs text-white/45 mt-1">Finance dashboard owner</p>

          <div className="mt-3">
            <ProfileImageUploader onUploaded={(url) => setProfileImg(url)} />
          </div>
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
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/30 border border-white/10"
                      : "text-white/75 hover:text-white hover:bg-white/[0.05] border border-transparent"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-white" : "text-cyan-300"
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="pt-5 mt-5 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm bg-white/[0.04] hover:bg-red-500/15 border border-white/10 hover:border-red-400/30 transition"
        >
          <LogOut className="w-4 h-4 text-red-300" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#030712] text-white flex">
        <aside className="hidden md:flex w-[290px] shrink-0 bg-[#050816] border-r border-white/10 px-4 py-5">
          <SidebarContent />
        </aside>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative w-[88%] max-w-[320px] h-full bg-[#050816] border-r border-white/10 px-4 py-5">
              <SidebarContent />
            </aside>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-br from-[#070b1a] via-[#0b1020] to-[#111827]">
          <header className="md:hidden sticky top-0 z-30 border-b border-white/10 bg-[#050816]/95 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={profileImg}
                alt="Profile"
                className="w-10 h-10 rounded-2xl object-cover border border-white/10"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">Credix</div>
                <div className="text-[11px] text-white/45 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen((s) => !s)}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </header>

          <main className="flex-1 overflow-y-auto px-3 md:px-6 lg:px-8 py-4 md:py-6">
            <Routes>
              <Route
                path="/cards"
                element={
                  <CardsPage
                    excelBills={excelBills}
                    setExcelBills={setExcelBills}
                    upiSpends={upiSpends}
                    upiBudgets={upiBudgets}
                    setUpiSpends={setUpiSpends}
                    setUpiBudgets={setUpiBudgets}
                  />
                }
              />
              <Route
                path="/tracks"
                element={
                  <TracksPage
                    segmentMonthly={segmentMonthly}
                    setSegmentMonthly={setSegmentMonthly}
                  />
                }
              />
              <Route
                path="/debts"
                element={
                  <DebtPage
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                  />
                }
              />
              <Route path="/lic-policies" element={<LicPoliciesPage />} />
              <Route
                path="/statement"
                element={
                  <MonthlyStatementPage
                    excelBills={excelBills}
                    excelMonthly={excelMonthly}
                    upiSpends={upiSpends}
                    upiBudgets={upiBudgets}
                    segmentMonthly={segmentMonthly}
                    selectedYear={selectedYear}
                  />
                }
              />
              <Route
                path="/networth"
                element={<NetWorthPage selectedYear={selectedYear} />}
              />
              <Route
                path="/projection"
                element={<ProjectionPage selectedYear={selectedYear} />}
              />
              <Route path="*" element={<Navigate to="/cards" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}