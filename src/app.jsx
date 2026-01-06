// App.jsx
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
import { useAuth } from "./AuthContext";
import Login from "./Login";
import SignUp from "./SignUp";
import CardsPage from "./components/CardsPage.jsx";
import MonthlyPage from "./components/MonthlyPage.jsx";
import TracksPage from "./components/TracksPage.jsx";
import DebtPage from "./components/DebtPage.jsx";
import ProfileImageUploader from "./components/ProfilePhotoUploader.jsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function App() {
  const { user, logout } = useAuth();

  const [profileImg, setProfileImg] = useState("/my-profile.jpg");

  const [excelBills, setExcelBills] = useState([]);
  const [excelMonthly, setExcelMonthly] = useState([]);
  const [upiSpends, setUpiSpends] = useState([]);
  const [upiBudgets, setUpiBudgets] = useState({});
  const [segmentMonthly, setSegmentMonthly] = useState({});

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

  useEffect(() => {
    if (!user?.uid) return;

    const billsRef = query(collection(db, `users/${user.uid}/bills`));
    const unsubBills = onSnapshot(billsRef, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExcelBills(data);
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
      const promises = Object.entries(segmentMonthly).map(
        async ([month, data]) => {
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
        }
      );
      await Promise.all(promises);
    };

    save().catch(console.error);
  }, [segmentMonthly, user?.uid]);

  return (
    <BrowserRouter>
      {/* whole app */}
      <div className="min-h-screen flex flex-col md:flex-row bg-black text-white">
        {/* TOP BAR for mobile (md:hidden) */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <img
              src={profileImg}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover"
            />
            <div>
              <div className="text-xs font-semibold">
                {user.email || "User"}
              </div>
              <div className="text-[10px] text-zinc-400">{user.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-3 py-1 text-[11px] rounded border border-zinc-600 hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>

        {/* SIDEBAR – full only from md up */}
        <aside className="hidden md:flex w-56 lg:w-64 bg-zinc-950 border-r border-zinc-800 p-4 lg:p-6 flex-col">
          <div className="flex flex-col items-center mb-6 lg:mb-8 text-xs lg:text-sm">
            <img
              src={profileImg}
              alt="Profile"
              className="w-14 h-14 lg:w-16 lg:h-16 rounded-full object-cover mb-2 lg:mb-3"
            />
            <div className="font-semibold">
              {user.email || "User"}
            </div>
            <div className="text-[11px] text-zinc-400 mb-1">{user.email}</div>
            <ProfileImageUploader onUploaded={(url) => setProfileImg(url)} />
            <button
              onClick={logout}
              className="mt-3 px-3 py-1 text-[11px] rounded border border-zinc-600 hover:bg-zinc-800"
            >
              Sign Out
            </button>
          </div>
          <nav className="space-y-1 text-xs lg:text-sm">
            <NavItem to="/cards" label="Credit Cards" />
            <NavItem to="/monthly" label="Monthly Expenditure" />
            <NavItem to="/tracks" label="Tracks" />
            <NavItem to="/debts" label="Debt" />
          </nav>
        </aside>

        {/* MOBILE NAV ROW (below top bar) */}
        <nav className="md:hidden flex justify-around border-b border-zinc-800 bg-zinc-950 text-[11px]">
          <NavItem to="/cards" label="Cards" />
          <NavItem to="/monthly" label="Monthly" />
          <NavItem to="/tracks" label="Tracks" />
          <NavItem to="/debts" label="Debt" />
        </nav>

        {/* MAIN CONTENT */}
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
              path="/monthly"
              element={
                <MonthlyPage
                  excelMonthly={excelMonthly}
                  setExcelMonthly={setExcelMonthly}
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
            <Route path="/debts" element={<DebtPage />} />
            <Route path="*" element={<Navigate to="/cards" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center justify-center gap-2 px-3 py-2 rounded ${
          isActive
            ? "bg-purple-700 text-white"
            : "text-zinc-300 hover:bg-zinc-900"
        }`
      }
    >
      {label}
    </NavLink>
  );
}
