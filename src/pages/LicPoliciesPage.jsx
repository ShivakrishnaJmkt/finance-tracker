import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Plus,
  Shield,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  IndianRupee,
  CalendarDays,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const emptyForm = {
  policyName: "",
  insurer: "LIC",
  policyNumber: "",
  planName: "",
  planType: "Endowment",
  premiumAmount: "",
  premiumFrequency: "Monthly",
  paidPremiums: "",
  totalPaid: "",
  sumAssured: "",
  maturityValue: "",
  bonusEstimate: "",
  loanPrincipal: "",
  loanTrackedInDebt: false,
  startDate: "",
  maturityDate: "",
  premiumDueDay: "",
  nominee: "",
  policyStatus: "Active",
  notes: "",
};

const premiumFrequencyOptions = [
  "Monthly",
  "Quarterly",
  "Half-Yearly",
  "Yearly",
  "Single Premium",
];

const planTypeOptions = [
  "Endowment",
  "Term",
  "Money Back",
  "ULIP",
  "Whole Life",
  "Pension",
  "Child Plan",
  "Health Rider",
  "Other",
];

const statusOptions = ["Active", "Paid-up", "Matured", "Lapsed", "Closed"];

function formatCurrency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) {
    return null;
  }

  const date = new Date(year, monthIndex, day);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function startOfDayLocal(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr) {
  const date = parseLocalDate(dateStr);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysLeft(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return null;

  const today = startOfDayLocal(new Date());
  const maturity = startOfDayLocal(target);
  const diff = maturity.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getPolicyBadge(status, maturityDate) {
  const daysLeft = getDaysLeft(maturityDate);

  if (status === "Matured") {
    return {
      label: "Matured",
      className:
        "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    };
  }

  if (status === "Lapsed") {
    return {
      label: "Lapsed",
      className: "bg-red-500/20 text-red-300 border border-red-400/30",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    };
  }

  if (status === "Closed") {
    return {
      label: "Closed",
      className:
        "bg-slate-500/20 text-slate-300 border border-slate-400/30",
      icon: <FileText className="w-3.5 h-3.5" />,
    };
  }

  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 90) {
    return {
      label: `Matures in ${daysLeft}d`,
      className:
        "bg-amber-500/20 text-amber-300 border border-amber-400/30",
      icon: <CalendarDays className="w-3.5 h-3.5" />,
    };
  }

  return {
    label: status || "Active",
    className: "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30",
    icon: <Shield className="w-3.5 h-3.5" />,
  };
}

function getFrequencyMonths(frequency) {
  switch (frequency) {
    case "Monthly":
      return 1;
    case "Quarterly":
      return 3;
    case "Half-Yearly":
      return 6;
    case "Yearly":
      return 12;
    case "Single Premium":
      return 0;
    default:
      return 1;
  }
}

function getSafeDay(year, monthIndex, preferredDay) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(preferredDay, lastDay);
}

function addMonthsSafe(baseDate, monthsToAdd, preferredDay) {
  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth();
  const totalMonths = monthIndex + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const normalizedMonthIndex = ((totalMonths % 12) + 12) % 12;
  const safeDay = getSafeDay(targetYear, normalizedMonthIndex, preferredDay);

  return new Date(targetYear, normalizedMonthIndex, safeDay);
}

function getAutoPaidPremiums(startDate, frequency, premiumDueDay) {
  const start = parseLocalDate(startDate);
  if (!start) return 0;

  const freqMonths = getFrequencyMonths(frequency);
  if (freqMonths === 0) return 1;

  const today = startOfDayLocal(new Date());
  const startLocal = startOfDayLocal(start);

  if (today < startLocal) return 0;

  const preferredDay = Number(premiumDueDay || startLocal.getDate() || 1);

  let count = 0;
  let installmentDate = new Date(
    startLocal.getFullYear(),
    startLocal.getMonth(),
    getSafeDay(startLocal.getFullYear(), startLocal.getMonth(), preferredDay)
  );

  while (installmentDate <= today) {
    count += 1;
    installmentDate = addMonthsSafe(installmentDate, freqMonths, preferredDay);
  }

  return count;
}

export default function LicPoliciesPage() {
  const { user } = useAuth();

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setPolicies([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const policiesRef = collection(db, "users", user.uid, "licPolicies");
    const q = query(policiesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setPolicies(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const normalizedPolicies = useMemo(() => {
    return policies.map((policy) => {
      const premiumAmount = Number(policy.premiumAmount || 0);
      const autoPaidPremiums = getAutoPaidPremiums(
        policy.startDate,
        policy.premiumFrequency,
        policy.premiumDueDay
      );
      const paidPremiums = autoPaidPremiums;
      const totalPaid = premiumAmount * paidPremiums;

      return {
        ...policy,
        premiumAmount,
        paidPremiums,
        totalPaid,
        sumAssured: Number(policy.sumAssured || 0),
        maturityValue: Number(policy.maturityValue || 0),
        bonusEstimate: Number(policy.bonusEstimate || 0),
        loanPrincipal: Number(policy.loanPrincipal || 0),
        loanTrackedInDebt: Boolean(policy.loanTrackedInDebt ?? false),
      };
    });
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return normalizedPolicies.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.policyName?.toLowerCase().includes(keyword) ||
        item.insurer?.toLowerCase().includes(keyword) ||
        item.policyNumber?.toLowerCase().includes(keyword) ||
        item.planName?.toLowerCase().includes(keyword) ||
        item.nominee?.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "All" || item.policyStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [normalizedPolicies, search, statusFilter]);

  const summary = useMemo(() => {
    const activePolicies = normalizedPolicies.filter(
      (p) => p.policyStatus === "Active"
    );

    const totalPremium = normalizedPolicies.reduce(
      (sum, p) => sum + Number(p.premiumAmount || 0),
      0
    );

    const totalPaid = normalizedPolicies.reduce(
      (sum, p) => sum + Number(p.totalPaid || 0),
      0
    );

    const totalPaidPremiums = normalizedPolicies.reduce(
      (sum, p) => sum + Number(p.paidPremiums || 0),
      0
    );

    const totalSumAssured = normalizedPolicies.reduce(
      (sum, p) => sum + Number(p.sumAssured || 0),
      0
    );

    const maturingSoon = normalizedPolicies.filter((p) => {
      const days = getDaysLeft(p.maturityDate);
      return days !== null && days >= 0 && days <= 90 && p.policyStatus === "Active";
    }).length;

    return {
      totalPolicies: normalizedPolicies.length,
      activePolicies: activePolicies.length,
      totalPremium,
      totalPaid,
      totalPaidPremiums,
      totalSumAssured,
      maturingSoon,
    };
  }, [normalizedPolicies]);

  function openAddModal() {
    setEditingPolicy(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEditModal(policy) {
    setEditingPolicy(policy);
    setForm({
      policyName: policy.policyName || "",
      insurer: policy.insurer || "LIC",
      policyNumber: policy.policyNumber || "",
      planName: policy.planName || "",
      planType: policy.planType || "Endowment",
      premiumAmount: policy.premiumAmount || "",
      premiumFrequency: policy.premiumFrequency || "Monthly",
      paidPremiums: policy.paidPremiums || "",
      totalPaid: policy.totalPaid || "",
      sumAssured: policy.sumAssured || "",
      maturityValue: policy.maturityValue || "",
      bonusEstimate: policy.bonusEstimate || "",
      loanPrincipal: policy.loanPrincipal || "",
      loanTrackedInDebt: Boolean(policy.loanTrackedInDebt ?? false),
      startDate: policy.startDate || "",
      maturityDate: policy.maturityDate || "",
      premiumDueDay: policy.premiumDueDay || "",
      nominee: policy.nominee || "",
      policyStatus: policy.policyStatus || "Active",
      notes: policy.notes || "",
    });
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingPolicy(null);
    setForm(emptyForm);
    setError("");
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!user?.uid) {
      setError("User not found. Please login again.");
      return;
    }

    if (!form.policyName.trim()) {
      setError("Policy name is required.");
      return;
    }

    if (!form.policyNumber.trim()) {
      setError("Policy number is required.");
      return;
    }

    if (!form.startDate) {
      setError("Start date is required.");
      return;
    }

    setSaving(true);

    try {
      const premiumAmount = Number(form.premiumAmount || 0);
      const autoPaidPremiums = getAutoPaidPremiums(
        form.startDate,
        form.premiumFrequency,
        form.premiumDueDay
      );
      const totalPaid = premiumAmount * autoPaidPremiums;

      const payload = {
        policyName: form.policyName.trim(),
        insurer: form.insurer.trim() || "LIC",
        policyNumber: form.policyNumber.trim(),
        planName: form.planName.trim(),
        planType: form.planType,
        premiumAmount,
        premiumFrequency: form.premiumFrequency,
        paidPremiums: autoPaidPremiums,
        totalPaid,
        sumAssured: Number(form.sumAssured || 0),
        maturityValue: Number(form.maturityValue || 0),
        bonusEstimate: Number(form.bonusEstimate || 0),
        loanPrincipal: Number(form.loanPrincipal || 0),
        loanTrackedInDebt: Boolean(form.loanTrackedInDebt),
        startDate: form.startDate || "",
        maturityDate: form.maturityDate || "",
        premiumDueDay: Number(form.premiumDueDay || 0),
        nominee: form.nominee.trim(),
        policyStatus: form.policyStatus,
        notes: form.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      const policiesRef = collection(db, "users", user.uid, "licPolicies");

      if (editingPolicy?.id) {
        await updateDoc(
          doc(db, "users", user.uid, "licPolicies", editingPolicy.id),
          payload
        );
      } else {
        await addDoc(policiesRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      closeModal();
    } catch (err) {
      setError(err?.message || "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(policyId) {
    if (!user?.uid || !policyId) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this policy?"
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "licPolicies", policyId));
    } catch (err) {
      alert(err?.message || "Failed to delete policy.");
    }
  }

  async function fixLicFrequencies() {
    if (!user?.uid) {
      alert("User not found");
      return;
    }

    const targets = [
      { policyName: "NSK", policyNumber: "662844006" },
      { policyName: "Naredla Rajaiah", policyNumber: "662845663" },
      { policyName: "Naredla ShivaKrishna", policyNumber: "662844034" },
      { policyName: "Naredla Manasa", policyNumber: "679672458" },
    ];

    try {
      const ref = collection(db, "users", user.uid, "licPolicies");
      const snap = await getDocs(ref);

      let updatedCount = 0;

      for (const item of snap.docs) {
        const data = item.data();

        const matched = targets.find(
          (t) =>
            String(data.policyName || "").trim() === t.policyName &&
            String(data.policyNumber || "").trim() === t.policyNumber
        );

        if (matched) {
          await updateDoc(doc(db, "users", user.uid, "licPolicies", item.id), {
            premiumFrequency: "Yearly",
            updatedAt: serverTimestamp(),
          });
          updatedCount += 1;
        }
      }

      alert(`${updatedCount} LIC policies updated to Yearly`);
    } catch (error) {
      console.error("Frequency fix failed", error);
      alert(error.message || "Failed to update LIC policies");
    }
  }

  const previewPaidPremiums = getAutoPaidPremiums(
    form.startDate,
    form.premiumFrequency,
    form.premiumDueDay
  );
  const previewTotalPaid = Number(form.premiumAmount || 0) * previewPaidPremiums;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
              <span className="rounded-2xl bg-cyan-500/15 p-2 text-cyan-300">
                <Shield className="h-7 w-7" />
              </span>
              LIC Policies
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
              Manage your insurance policies, track paid premiums, and monitor total amount paid based on policy dates.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={fixLicFrequencies}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-900/30 transition hover:scale-[1.01] hover:bg-amber-400"
            >
              Fix LIC Frequency
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold shadow-lg shadow-cyan-900/30 transition hover:scale-[1.01] hover:from-cyan-400 hover:to-blue-400"
            >
              <Plus className="h-4 w-4" />
              Add Policy
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Policies" value={summary.totalPolicies} icon={<FileText className="h-5 w-5" />} color="cyan" />
          <StatCard title="Active Policies" value={summary.activePolicies} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
          <StatCard title="Premium Amount" value={formatCurrency(summary.totalPremium)} icon={<IndianRupee className="h-5 w-5" />} color="amber" />
          <StatCard title="Paid Premiums" value={summary.totalPaidPremiums} icon={<Receipt className="h-5 w-5" />} color="violet" />
          <StatCard title="Total Paid" value={formatCurrency(summary.totalPaid)} icon={<TrendingUp className="h-5 w-5" />} color="blue" />
          <StatCard title="Maturing Soon" value={summary.maturingSoon} icon={<CalendarDays className="h-5 w-5" />} color="pink" />
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by policy, number, plan, nominee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <div className="flex w-full gap-3 lg:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50 lg:w-52"
            >
              <option value="All">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-4">Policy</th>
                  <th className="px-4 py-4">Policy No</th>
                  <th className="px-4 py-4">Start Date</th>
                  <th className="px-4 py-4">Premium</th>
                  <th className="px-4 py-4">Paid Premiums</th>
                  <th className="px-4 py-4">Total Paid</th>
                  <th className="px-4 py-4">Sum Assured</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      Loading LIC policies...
                    </td>
                  </tr>
                ) : filteredPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Shield className="h-10 w-10 text-slate-600" />
                        <p className="text-sm">No LIC policies found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPolicies.map((policy) => {
                    const badge = getPolicyBadge(
                      policy.policyStatus,
                      policy.maturityDate
                    );

                    return (
                      <tr
                        key={policy.id}
                        className="border-t border-white/10 text-sm text-slate-200 transition hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-white">
                              {policy.policyName || "Untitled Policy"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {policy.insurer || "LIC"} · {policy.planType || "Plan"}
                              {policy.planName ? ` · ${policy.planName}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-slate-100">
                            {policy.policyNumber}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p>{formatDate(policy.startDate)}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              Maturity {formatDate(policy.maturityDate)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-amber-300">
                              {formatCurrency(policy.premiumAmount)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {policy.premiumFrequency}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-violet-300">
                            {policy.paidPremiums || 0}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-emerald-300">
                            {formatCurrency(policy.totalPaid)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-cyan-300">
                            {formatCurrency(policy.sumAssured)}
                          </p>
                          {Number(policy.maturityValue || 0) > 0 && (
                            <p className="mt-1 text-xs text-slate-400">
                              Maturity {formatCurrency(policy.maturityValue)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(policy)}
                              className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(policy.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {editingPolicy ? "Edit LIC Policy" : "Add LIC Policy"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Fill policy details carefully for automatic premium counting.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 sm:p-6">
                {error && (
                  <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InputField label="Policy Name" name="policyName" value={form.policyName} onChange={handleChange} placeholder="Jeevan Anand" required />
                  <InputField label="Insurer" name="insurer" value={form.insurer} onChange={handleChange} placeholder="LIC" />
                  <InputField label="Policy Number" name="policyNumber" value={form.policyNumber} onChange={handleChange} placeholder="Enter policy number" required />
                  <InputField label="Plan Name" name="planName" value={form.planName} onChange={handleChange} placeholder="Optional plan name" />
                  <SelectField label="Plan Type" name="planType" value={form.planType} onChange={handleChange} options={planTypeOptions} />
                  <SelectField label="Policy Status" name="policyStatus" value={form.policyStatus} onChange={handleChange} options={statusOptions} />
                  <InputField label="Premium Amount" name="premiumAmount" type="number" value={form.premiumAmount} onChange={handleChange} placeholder="0" />
                  <SelectField label="Premium Frequency" name="premiumFrequency" value={form.premiumFrequency} onChange={handleChange} options={premiumFrequencyOptions} />
                  <InputField label="Premium Due Day" name="premiumDueDay" type="number" value={form.premiumDueDay} onChange={handleChange} placeholder="e.g. 5" />
                  <InputField label="Sum Assured" name="sumAssured" type="number" value={form.sumAssured} onChange={handleChange} placeholder="0" />
                  <InputField label="Maturity Value" name="maturityValue" type="number" value={form.maturityValue} onChange={handleChange} placeholder="0" />
                  <InputField label="Bonus Estimate" name="bonusEstimate" type="number" value={form.bonusEstimate} onChange={handleChange} placeholder="0" />
                  <InputField label="Loan Principal" name="loanPrincipal" type="number" value={form.loanPrincipal} onChange={handleChange} placeholder="0" />

                  <div className="md:col-span-2 xl:col-span-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="loanTrackedInDebt"
                        checked={Boolean(form.loanTrackedInDebt)}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-white/20 bg-slate-900"
                      />
                      <span>This LIC loan is already added in Debt page</span>
                    </label>
                  </div>

                  <InputField label="Start Date" name="startDate" type="date" value={form.startDate} onChange={handleChange} required />
                  <InputField label="Maturity Date" name="maturityDate" type="date" value={form.maturityDate} onChange={handleChange} />
                  <InputField label="Nominee" name="nominee" value={form.nominee} onChange={handleChange} placeholder="Nominee name" />
                </div>

                {form.startDate && form.premiumAmount ? (
                  <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                    <div className="text-sm text-cyan-200">
                      Auto Paid Premiums:{" "}
                      <span className="font-semibold">{previewPaidPremiums}</span>
                    </div>
                    <div className="mt-1 text-sm text-cyan-100">
                      Auto Total Paid:{" "}
                      <span className="font-semibold">
                        {formatCurrency(previewTotalPaid)}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Any remarks about bonus, premium term, loan against policy, etc."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : editingPolicy ? "Update Policy" : "Save Policy"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color = "cyan" }) {
  const colorMap = {
    cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-400/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-400/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-400/20",
    blue: "from-blue-500/20 to-blue-500/5 text-blue-300 border-blue-400/20",
    pink: "from-pink-500/20 to-pink-500/5 text-pink-300 border-pink-400/20",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-300 border-violet-400/20",
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-4 backdrop-blur-sm ${colorMap[color]}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-400">{title}</span>
        <span>{icon}</span>
      </div>
      <p className="text-xl font-bold text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20"
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}