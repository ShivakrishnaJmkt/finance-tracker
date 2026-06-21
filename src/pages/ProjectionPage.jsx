import { useMemo, useState } from "react";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CalendarRange,
  IndianRupee,
  Shield,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import { YEARS, formatMoney } from "../utils/financeNormalize";

export default function ProjectionPage({ selectedYear, setSelectedYear }) {
  const [myIncome, setMyIncome] = useState(20000);
  const [dadIncome, setDadIncome] = useState(25000);

  const [myExpenses, setMyExpenses] = useState(12000);
  const [dadExpenses, setDadExpenses] = useState(8000);

  const [fixedEmi, setFixedEmi] = useState(36426);
  const [licMonthlyProvision, setLicMonthlyProvision] = useState(5500);

  const [baseCash, setBaseCash] = useState(0);
  const [baseLicCurrentValue, setBaseLicCurrentValue] = useState(698182.8);
  const [baseDebt, setBaseDebt] = useState(1139762);

  const projection = useMemo(() => {
    const totalIncome = Number(myIncome || 0) + Number(dadIncome || 0);
    const totalFamilyExpenses =
      Number(myExpenses || 0) + Number(dadExpenses || 0);

    const totalRequiredOutflow =
      totalFamilyExpenses +
      Number(fixedEmi || 0) +
      Number(licMonthlyProvision || 0);

    const monthlyNetCashFlow = totalIncome - totalRequiredOutflow;
    const monthlyShortfall = monthlyNetCashFlow < 0 ? Math.abs(monthlyNetCashFlow) : 0;
    const monthlySurplus = monthlyNetCashFlow > 0 ? monthlyNetCashFlow : 0;

    const gap3Months = monthlyShortfall * 3;
    const gap6Months = monthlyShortfall * 6;
    const gap12Months = monthlyShortfall * 12;

    const baseNetWorth =
      Number(baseCash || 0) +
      Number(baseLicCurrentValue || 0) -
      Number(baseDebt || 0);

    const closingCash1Month = Number(baseCash || 0) + monthlyNetCashFlow;
    const closingCash3Months = Number(baseCash || 0) + monthlyNetCashFlow * 3;
    const closingCash6Months = Number(baseCash || 0) + monthlyNetCashFlow * 6;
    const closingCash12Months = Number(baseCash || 0) + monthlyNetCashFlow * 12;

    return {
      totalIncome,
      totalFamilyExpenses,
      totalRequiredOutflow,
      monthlyNetCashFlow,
      monthlyShortfall,
      monthlySurplus,
      gap3Months,
      gap6Months,
      gap12Months,
      baseNetWorth,
      closingCash1Month,
      closingCash3Months,
      closingCash6Months,
      closingCash12Months,
    };
  }, [
    myIncome,
    dadIncome,
    myExpenses,
    dadExpenses,
    fixedEmi,
    licMonthlyProvision,
    baseCash,
    baseLicCurrentValue,
    baseDebt,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 text-white px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-pink-200 to-cyan-200">
            Projection
          </h1>
          <p className="text-sm text-purple-100/80 mt-1">
            Monthly cash-flow projection based on income, expenses, EMI, and LIC obligations.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-purple-100">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-black/40 border border-purple-400/50 rounded-xl px-4 py-2 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Monthly Income"
          value={formatMoney(projection.totalIncome)}
          subtitle="You + Dad"
          icon={<Wallet className="w-5 h-5" />}
        />
        <SummaryCard
          title="Monthly Required"
          value={formatMoney(projection.totalRequiredOutflow)}
          subtitle="Expenses + EMI + LIC"
          icon={<IndianRupee className="w-5 h-5" />}
        />
        <SummaryCard
          title="Monthly Shortfall"
          value={formatMoney(projection.monthlyShortfall)}
          subtitle={
            projection.monthlyShortfall > 0
              ? "Amount still needed every month"
              : "No shortfall"
          }
          icon={<TrendingDown className="w-5 h-5" />}
          highlight={projection.monthlyShortfall > 0}
        />
        <SummaryCard
          title="Base Net Worth"
          value={formatMoney(projection.baseNetWorth)}
          subtitle="Current LIC value + cash - debt"
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      <Section title="Monthly Inputs" icon={<CalendarRange className="w-5 h-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <InputCard label="My Income" value={myIncome} setValue={setMyIncome} />
          <InputCard label="Dad Income" value={dadIncome} setValue={setDadIncome} />
          <InputCard label="My Expenses" value={myExpenses} setValue={setMyExpenses} />
          <InputCard label="Dad Expenses" value={dadExpenses} setValue={setDadExpenses} />
          <InputCard label="Fixed EMI" value={fixedEmi} setValue={setFixedEmi} />
          <InputCard
            label="LIC Monthly Provision"
            value={licMonthlyProvision}
            setValue={setLicMonthlyProvision}
          />
        </div>
      </Section>

      <Section title="Cash Flow Summary" icon={<AlertTriangle className="w-5 h-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <InfoBlock
            label="Total Income"
            value={formatMoney(projection.totalIncome)}
            tone="cyan"
          />
          <InfoBlock
            label="Family Expenses"
            value={formatMoney(projection.totalFamilyExpenses)}
            tone="amber"
          />
          <InfoBlock
            label="EMI + LIC"
            value={formatMoney(Number(fixedEmi || 0) + Number(licMonthlyProvision || 0))}
            tone="rose"
          />
          <InfoBlock
            label="Net Cash Flow"
            value={formatMoney(projection.monthlyNetCashFlow)}
            tone={projection.monthlyNetCashFlow >= 0 ? "emerald" : "red"}
          />
        </div>
      </Section>

      <Section title="Gap Forecast" icon={<TrendingDown className="w-5 h-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ForecastCard
            title="3 Months"
            amount={projection.gap3Months}
            note="Projected funding gap"
          />
          <ForecastCard
            title="6 Months"
            amount={projection.gap6Months}
            note="Projected funding gap"
          />
          <ForecastCard
            title="12 Months"
            amount={projection.gap12Months}
            note="Projected funding gap"
          />
        </div>
      </Section>

      <Section title="Cash Closing View" icon={<Wallet className="w-5 h-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <InfoBlock
            label="After 1 Month"
            value={formatMoney(projection.closingCash1Month)}
            tone={projection.closingCash1Month >= 0 ? "emerald" : "red"}
          />
          <InfoBlock
            label="After 3 Months"
            value={formatMoney(projection.closingCash3Months)}
            tone={projection.closingCash3Months >= 0 ? "emerald" : "red"}
          />
          <InfoBlock
            label="After 6 Months"
            value={formatMoney(projection.closingCash6Months)}
            tone={projection.closingCash6Months >= 0 ? "emerald" : "red"}
          />
          <InfoBlock
            label="After 12 Months"
            value={formatMoney(projection.closingCash12Months)}
            tone={projection.closingCash12Months >= 0 ? "emerald" : "red"}
          />
        </div>
      </Section>

      <Section title="Long-Term Base" icon={<Shield className="w-5 h-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <InputCard label="Base Cash" value={baseCash} setValue={setBaseCash} />
          <InputCard
            label="Base LIC Current Value"
            value={baseLicCurrentValue}
            setValue={setBaseLicCurrentValue}
          />
          <InputCard label="Base Debt" value={baseDebt} setValue={setBaseDebt} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoBlock
            label="Cash"
            value={formatMoney(baseCash)}
            tone="cyan"
          />
          <InfoBlock
            label="LIC Current Value"
            value={formatMoney(baseLicCurrentValue)}
            tone="emerald"
          />
          <InfoBlock
            label="Debt Outstanding"
            value={formatMoney(baseDebt)}
            tone="red"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="text-xs text-white/60 mb-1">Why this matters</div>
          <div className="text-sm text-white/80 leading-6">
            Long-term net worth can still look positive if LIC current value is high, but your
            immediate problem is monthly cash-flow deficit. This page separates paper net worth
            from real monthly survival planning.
          </div>
        </div>
      </Section>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg shadow-black/30 ${
        highlight
          ? "bg-gradient-to-r from-rose-500/20 to-amber-500/20 border-rose-300/30"
          : "bg-white/10 border-white/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-2 text-purple-100">
        {icon}
        <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle ? <div className="text-xs text-white/60 mt-1">{subtitle}</div> : null}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5 md:p-7 mb-6 shadow-lg shadow-black/30">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-lg md:text-xl font-semibold text-purple-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InputCard({ label, value, setValue }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-4">
      <label className="block text-xs text-purple-200 mb-2">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value || 0))}
        className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function InfoBlock({ label, value, tone = "cyan" }) {
  const toneMap = {
    emerald: "text-emerald-300",
    red: "text-red-300",
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };

  return (
    <div className="rounded-xl border border-white/20 bg-white/5 p-4">
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}

function ForecastCard({ title, amount, note }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5">
      <div className="text-sm text-rose-200">{title}</div>
      <div className="text-2xl font-bold text-rose-300 mt-1">
        {formatMoney(amount)}
      </div>
      <div className="text-xs text-white/60 mt-1">{note}</div>
    </div>
  );
}