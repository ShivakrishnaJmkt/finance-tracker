import Sidebar from "./Sidebar";

export default function AppShell({
  user,
  selectedYear,
  setSelectedYear,
  YEARS,
  activeKey,
  onNavigate,
  onSignOut,
  children,
}) {
  return (
    <div className="min-h-screen bg-[#030712] text-white flex">
      <Sidebar
        user={user}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        YEARS={YEARS}
        activeKey={activeKey}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
      />

      <main className="flex-1 min-w-0 bg-gradient-to-br from-[#070b1a] via-[#0b1020] to-[#111827]">
        {children}
      </main>
    </div>
  );
}