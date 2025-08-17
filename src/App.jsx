import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

// --- Utility helpers ---
const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Compound monthly
const monthsBetween = (start: Date, addM: number) => {
  const d = new Date(start);
  d.setMonth(d.getMonth() + addM);
  return d;
};

const addMonths = (d: Date, m: number) => monthsBetween(d, m);

function simulate({
  start = new Date(2025, 8, 1), // Sep 1, 2025
  months = 600,
  annualReturn = 0.07,
  monthlyExpenses = 61320 / 12,
  startBalances,
  incomeFn,
  lumpSums,
  investBuffer = 10000,
  target = 500000,
}: {
  start?: Date;
  months?: number;
  annualReturn?: number;
  monthlyExpenses?: number;
  startBalances: { earning: number; cash: number; debt: number };
  incomeFn: (m: number) => number;
  lumpSums?: Record<number, number>;
  investBuffer?: number;
  target?: number;
}) {
  const r = annualReturn / 12;
  let earning = startBalances.earning;
  let cash = startBalances.cash;
  let debt = startBalances.debt;
  const rows: { month: number; date: Date; net: number; earning: number; cash: number }[] = [];
  let hit: { monthIndex: number; date: Date; net: number } | null = null;

  for (let m = 0; m < months; m++) {
    cash += incomeFn(m) - monthlyExpenses;

    // investment growth
    earning *= 1 + r;

    // move surplus cash above buffer into investments
    if (cash > investBuffer) {
      earning += cash - investBuffer;
      cash = investBuffer;
    }

    if (lumpSums && lumpSums[m]) cash += lumpSums[m];

    const net = earning + cash - debt;
    rows.push({ month: m + 1, date: addMonths(start, m + 1), net, earning, cash });

    if (!hit && net >= target) {
      hit = { monthIndex: m + 1, date: addMonths(start, m + 1), net };
    }
  }

  return { rows, hit };
}

function requiredMonthlyToHit({
  target = 500000,
  horizonMonths = 36,
  annualReturn = 0.07,
  startEarning = 206616, // all assets except 10k buffer
  buffer = 10000,
  debt = 40700,
}: {
  target?: number;
  horizonMonths?: number;
  annualReturn?: number;
  startEarning?: number;
  buffer?: number;
  debt?: number;
}) {
  const r = annualReturn / 12;
  const fvPV = startEarning * Math.pow(1 + r, horizonMonths);
  const annuityFactor = (Math.pow(1 + r, horizonMonths) - 1) / r;
  const c = (target + debt - buffer - fvPV) / annuityFactor; // monthly contribution invested
  return c;
}

// --- Default data (prefilled from your message) ---
const DEFAULTS = {
  expensesYearly: 61320,
  // Assets
  brokerage: 116000 + 550,
  ira: 20000,
  roth: 3500,
  // Cash-like buckets
  cashLike: 42000 + 19000 + 3500 + 5400 + 1500 + 1700 + 1966 + 1500,
  debtCar: 39200,
  debtCC: 1500,
  // Income streams
  grantMonthly: 7000, // through Mar 2026 inclusive
  grantMonths: 7,
  workBaseMonthly: 10000, // you said low end 10k/mo
  workStartBaseMonthIndex: 4, // Jan 2026 in this model
  semesterTotal: 10000, // two lump sums (Dec & May)
};

const COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f97316",
  "#a78bfa",
  "#ef4444",
  "#22d3ee",
];

function ControlNumber({ label, value, onChange, step = 100, min = 0 }: any) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-gray-300">{label}</span>
      <input
        type="number"
        className="w-40 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-right"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function SectionCard({ title, children }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 shadow-xl"
    >
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </motion.div>
  );
}

function GoalSummary({ hit, target }: { hit: any; target: number }) {
  return (
    <div className="rounded-xl bg-gray-800 p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm text-gray-400">Target</div>
        <div className="text-2xl font-bold">{fmt.format(target)}</div>
      </div>
      <div>
        <div className="text-sm text-gray-400">Projected Hit Date</div>
        <div className="text-2xl font-bold">
          {hit ? hit.date.toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "—"}
        </div>
        <div className="text-xs text-gray-400">in {hit ? hit.monthIndex : "—"} months</div>
      </div>
      <div>
        <div className="text-sm text-gray-400">Projected Net Worth at Hit</div>
        <div className="text-2xl font-bold">{hit ? fmt.format(hit.net) : "—"}</div>
      </div>
    </div>
  );
}

export default function WealthRoadmapApp() {
  // --- state ---
  const [annualReturn, setAnnualReturn] = useState(0.07);
  const [expensesYearly, setExpensesYearly] = useState(DEFAULTS.expensesYearly);

  const [brokerage, setBrokerage] = useState(DEFAULTS.brokerage);
  const [ira, setIra] = useState(DEFAULTS.ira);
  const [roth, setRoth] = useState(DEFAULTS.roth);
  const [cashLike, setCashLike] = useState(DEFAULTS.cashLike);
  const [buffer, setBuffer] = useState(10000);
  const [debtCar, setDebtCar] = useState(DEFAULTS.debtCar);
  const [debtCC, setDebtCC] = useState(DEFAULTS.debtCC);

  const [grantMonthly, setGrantMonthly] = useState(DEFAULTS.grantMonthly);
  const [grantMonths, setGrantMonths] = useState(DEFAULTS.grantMonths);
  const [workMonthly, setWorkMonthly] = useState(DEFAULTS.workBaseMonthly);
  const [workStartIndex, setWorkStartIndex] = useState(DEFAULTS.workStartBaseMonthIndex);
  const [semesterTotal, setSemesterTotal] = useState(DEFAULTS.semesterTotal);

  const debt = debtCar + debtCC;
  const monthlyExpenses = expensesYearly / 12;

  const startEarning = useMemo(() => brokerage + ira + roth + Math.max(0, cashLike - buffer), [brokerage, ira, roth, cashLike, buffer]);
  const startCash = useMemo(() => Math.min(buffer, cashLike), [cashLike, buffer]);

  const incomeBase = (m: number) => (m < grantMonths ? grantMonthly : 0) + (m >= workStartIndex ? workMonthly : 0);
  const lumps = { 3: semesterTotal / 2, 8: semesterTotal / 2 } as Record<number, number>;

  // Scenarios
  const scenarios = useMemo(() => {
    return [
      {
        key: "aggressive",
        label: "Aggressive",
        color: "#34d399",
        ar: Math.max(annualReturn, 0.09),
        income: (m: number) => (m < grantMonths ? grantMonthly : 0) + (m >= 0 ? Math.max(workMonthly, 15000) : 0), // work now @ >=15k
      },
      {
        key: "base",
        label: "Base",
        color: "#60a5fa",
        ar: annualReturn,
        income: incomeBase, // work starts at user-set index @ user-set workMonthly
      },
      {
        key: "conservative",
        label: "Conservative",
        color: "#f59e0b",
        ar: Math.min(annualReturn, 0.05),
        income: (m: number) => (m < grantMonths ? grantMonthly : 0) + (m >= grantMonths ? Math.max(workMonthly, 10000) : 0), // work starts when grant ends
      },
    ];
  }, [annualReturn, grantMonths, grantMonthly, workMonthly, incomeBase]);

  const baseBalances = { earning: startEarning, cash: startCash, debt };

  // Goals
  const target50 = 500000;
  const target4m = 4000000;

  const runs = useMemo(() => {
    return scenarios.map((s) => ({
      ...s,
      goal500: simulate({ startBalances: baseBalances, monthlyExpenses, annualReturn: s.ar, incomeFn: s.income, lumpSums: lumps, target: target50 }),
      goal4m: simulate({ startBalances: baseBalances, monthlyExpenses, annualReturn: s.ar, incomeFn: s.income, lumpSums: lumps, target: target4m, months: 2000 }),
    }));
  }, [scenarios, baseBalances, monthlyExpenses]);

  const req36 = useMemo(() => requiredMonthlyToHit({ target: target50, horizonMonths: 36, annualReturn: annualReturn, startEarning: startEarning, buffer, debt }), [annualReturn, startEarning, buffer, debt]);

  // Charts
  const barData = [
    { name: "Brokerage", value: brokerage },
    { name: "IRAs", value: ira + roth },
    { name: "Cash-like", value: cashLike },
    { name: "Debt", value: -(debt) },
  ];

  function Lines({ rows, color = "#60a5fa" }: any) {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tickFormatter={(d: Date) => new Date(d).toLocaleDateString(undefined, { month: "short", year: "2-digit" })} minTickGap={24} />
          <YAxis tickFormatter={(n) => fmt.format(n as number)} width={90} />
          <Tooltip formatter={(v: any) => fmt.format(v)} labelFormatter={(l: any) => new Date(l).toLocaleDateString()} />
          <Legend />
          <Line type="monotone" dataKey="net" stroke={color} dot={false} name="Net Worth" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-5 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Wealth Roadmap Dashboard</h1>
            <p className="text-gray-400">Interactive plan to reach <span className="font-semibold">$500k</span> and <span className="font-semibold">$4M</span>.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ControlNumber label="Annual Return %" value={Math.round(annualReturn * 1000) / 10} onChange={(v: number) => setAnnualReturn(v / 100)} step={0.1} />
            <ControlNumber label="Yearly Expenses" value={Math.round(expensesYearly)} onChange={setExpensesYearly} step={100} />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard title="Balances (Editable)">
            <div className="grid grid-cols-2 gap-3">
              <ControlNumber label="Brokerage (2)" value={brokerage} onChange={setBrokerage} />
              <ControlNumber label="IRA" value={ira} onChange={setIra} />
              <ControlNumber label="Roth IRA" value={roth} onChange={setRoth} />
              <ControlNumber label="Cash-like Total" value={cashLike} onChange={setCashLike} />
              <ControlNumber label="Keep Cash Buffer" value={buffer} onChange={setBuffer} />
              <ControlNumber label="Car Loan" value={debtCar} onChange={setDebtCar} />
              <ControlNumber label="CC Balance" value={debtCC} onChange={setDebtCC} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-gray-800">Invested at start: <span className="font-semibold">{fmt.format(startEarning)}</span></div>
              <div className="p-3 rounded-xl bg-gray-800">Cash buffer: <span className="font-semibold">{fmt.format(startCash)}</span></div>
              <div className="p-3 rounded-xl bg-gray-800">Debt total: <span className="font-semibold">{fmt.format(debt)}</span></div>
              <div className="p-3 rounded-xl bg-gray-800">Current Net Worth: <span className="font-semibold">{fmt.format(startEarning + startCash - debt)}</span></div>
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(n) => fmt.format(n as number)} />
                  <Tooltip formatter={(v: any) => fmt.format(v)} />
                  <Bar dataKey="value">
                    {barData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Income Streams (Editable)">
            <div className="grid grid-cols-2 gap-3">
              <ControlNumber label="Grant Monthly (tax-free)" value={grantMonthly} onChange={setGrantMonthly} />
              <ControlNumber label="# Months Grant Left" value={grantMonths} onChange={setGrantMonths} />
              <ControlNumber label="Work Monthly" value={workMonthly} onChange={setWorkMonthly} />
              <ControlNumber label="Work Start Month Index" value={workStartIndex} onChange={setWorkStartIndex} />
              <ControlNumber label="Semesters Total (2)" value={semesterTotal} onChange={setSemesterTotal} />
            </div>
            <div className="text-xs text-gray-400 mt-2">Month index 0 = Sep 2025. Example: 4 = Jan 2026.</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-gray-800 p-3"><div className="text-gray-400 text-xs">Monthly Expenses</div><div className="text-lg font-semibold">{fmt.format(monthlyExpenses)}</div></div>
              <div className="rounded-xl bg-gray-800 p-3"><div className="text-gray-400 text-xs">Req. Monthly (36m → $500k @ {Math.round(annualReturn*100)}%)</div><div className="text-lg font-semibold">{fmt.format(Math.max(0, req36))}</div></div>
              <div className="rounded-xl bg-gray-800 p-3"><div className="text-gray-400 text-xs">Req. Yearly</div><div className="text-lg font-semibold">{fmt.format(Math.max(0, req36*12))}</div></div>
            </div>
          </SectionCard>

          <SectionCard title="Allocation & Growth Assumption">
            <div className="space-y-3 text-sm text-gray-300">
              <p>We invest anything above the cash buffer into the portfolio each month. Portfolio compounds monthly at the Annual Return you set. Two semester disbursements are added at months 4 (Dec 2025) and 9 (May 2026).</p>
              <div className="rounded-xl bg-gray-800 p-3">
                <div className="text-gray-400 text-xs">Return Assumption</div>
                <div className="text-lg font-semibold">{Math.round(annualReturn*1000)/10}% / yr</div>
              </div>
              <div className="rounded-xl bg-gray-800 p-3">
                <div className="text-gray-400 text-xs">Investment Horizon</div>
                <div className="text-lg font-semibold">Up to 2000 months simulated</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Goals */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {runs.map((r) => (
            <SectionCard key={r.key} title={`${r.label} – $500k Goal`}>
              <GoalSummary hit={r.goal500.hit} target={target50} />
              <div className="mt-4">
                <Lines rows={r.goal500.rows} color={r.color} />
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {runs.map((r) => (
            <SectionCard key={r.key+"-4m"} title={`${r.label} – $4M Goal`}>
              <GoalSummary hit={r.goal4m.hit} target={target4m} />
              <div className="mt-4">
                <Lines rows={r.goal4m.rows} color={r.color} />
              </div>
            </SectionCard>
          ))}
        </div>

        {/* How-to / Notes */}
        <div className="mt-8 grid grid-cols-1 gap-4">
          <SectionCard title="Notes & Tips">
            <ul className="list-disc pl-6 space-y-2 text-sm text-gray-300">
              <li>Edit any input above to instantly re-run projections.</li>
              <li>“Req. Monthly” shows the average monthly amount that must be invested (after expenses) to reach $500k in exactly 36 months at your return rate.</li>
              <li>Adjust the cash buffer if you want more/less liquidity before auto-investing surplus.</li>
              <li>Use the Aggressive/Base/Conservative blocks to compare different return assumptions and work start dates.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
