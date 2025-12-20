// App.jsx - పూర్తి corrected code
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, query, setDoc } from 'firebase/firestore';
import { db } from './firebase';
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

  // Profile image
  const [profileImg, setProfileImg] = useState("/my-profile.jpg");

  // Firestore data states
  const [excelBills, setExcelBills] = useState([]);
  const [excelMonthly, setExcelMonthly] = useState([]);
  const [upiSpends, setUpiSpends] = useState([]);
  const [upiBudgets, setUpiBudgets] = useState({});
  const [segmentMonthly, setSegmentMonthly] = useState({});

  // AUTH ROUTES (not logged in)
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

  // 🔥 FIRESTORE REAL-TIME SYNC (read)
  useEffect(() => {
    if (!user?.uid) return;

    // Excel Bills
    const billsRef = query(collection(db, `users/${user.uid}/bills`));
    const unsubBills = onSnapshot(billsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Bills from Firestore:", data);
      setExcelBills(data);
    });

    // Excel Monthly
    const monthlyRef = query(collection(db, `users/${user.uid}/monthly`));
    const unsubMonthly = onSnapshot(monthlyRef, (snap) => {
      setExcelMonthly(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // UPI Spends
    const upiRef = query(collection(db, `users/${user.uid}/upiSpends`));
    const unsubUpi = onSnapshot(upiRef, (snap) => {
      setUpiSpends(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // UPI Budgets
    const budgetRef = doc(db, `users/${user.uid}/budgets/budget`);
    const unsubBudget = onSnapshot(budgetRef, (snap) => {
      if (snap.exists()) setUpiBudgets(snap.data());
    });

    // SEGMENTS (TracksPage)
    const segRef = query(collection(db, `users/${user.uid}/segments`));
    const unsubSeg = onSnapshot(segRef, (snap) => {
      console.log("Segments from Firestore:", snap.docs.map(d => d.data()));
      const obj = {};
      snap.docs.forEach(d => {
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

    // PROFILE IMAGE
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

  // 🔥 SEGMENTS WRITE EFFECT (TracksPage → Firestore)
  useEffect(() => {
    if (!user?.uid) return;
    if (!segmentMonthly || Object.keys(segmentMonthly).length === 0) return;


     console.log("Saving segments to Firestore:", segmentMonthly);
    const save = async () => {
      const userRef = doc(db, `users/${user.uid}`);
      const promises = Object.entries(segmentMonthly).map(
        async ([month, data]) => {
          // skip completely empty months (optional)
          const hasValue = ["Rent","Kirana","Petrol","Online Bills"]
            .some(k => Number(data[k] || 0) !== 0);
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

      console.log("Segments saved!");
    };

    save().catch(console.error);
  }, [segmentMonthly, user?.uid]);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex bg-black text-white">
        {/* LEFT SIDEBAR */}
        <aside className="w-64 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col">
          <div className="flex flex-col items-center mb-8">
            <img
              src={profileImg}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover mb-3"
            />
            <div className="text-sm font-semibold">
              {user.email || "User"}
            </div>
            <div className="text-xs text-zinc-400 mb-1">{user.email}</div>
            <ProfileImageUploader onUploaded={(url) => setProfileImg(url)} />
            <button
              onClick={logout}
              className="mt-3 px-3 py-1 text-xs rounded border border-zinc-600 hover:bg-zinc-800"
            >
              Sign Out
            </button>
          </div>
          <nav className="space-y-1 text-sm">
            <NavItem to="/cards" label="Credit Cards" />
            <NavItem to="/monthly" label="Monthly Expenditure" />
            <NavItem to="/tracks" label="Tracks" />
            <NavItem to="/debts" label="Debt" />
          </nav>
        </aside>

        {/* RIGHT CONTENT */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
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
        `flex items-center gap-2 px-3 py-2 rounded ${
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
