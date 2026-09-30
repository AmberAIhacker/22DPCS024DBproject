import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  month: number;
  standard: number;
  prepayment: number;
  principal: number;
  interest: number;
};

type RepaymentChartsProps = {
  data: ChartPoint[];
  formatCurrency: (amount: number) => string;
  formatCompact: (amount: number) => string;
};

function RepaymentCharts({ data, formatCurrency, formatCompact }: RepaymentChartsProps) {
  const [chartMode, setChartMode] = useState<"balance" | "breakdown">("balance");
  const axis = { fill: "var(--muted)", fontSize: 11 };
  const tooltip = {
    contentStyle: {
      background: "var(--tooltip-bg)",
      border: "1px solid var(--line)",
      borderRadius: 6,
      color: "var(--paper)",
    },
  };

  return (
    <>
      <div className="chart-toolbar">
        <div><h3>Repayment outlook</h3><p>Based on the amounts and dates entered above</p></div>
        <div className="chart-tabs" role="tablist" aria-label="Chart type">
          <button role="tab" aria-selected={chartMode === "balance"} className={chartMode === "balance" ? "chart-tab active" : "chart-tab"} onClick={() => setChartMode("balance")}>Loan balance</button>
          <button role="tab" aria-selected={chartMode === "breakdown"} className={chartMode === "breakdown" ? "chart-tab active" : "chart-tab"} onClick={() => setChartMode("breakdown")}>Payment split</button>
        </div>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === "balance" ? (
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 6, bottom: 4 }}>
              <defs>
                <linearGradient id="standardFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9daaa0" stopOpacity={0.2} /><stop offset="95%" stopColor="#9daaa0" stopOpacity={0.01} /></linearGradient>
                <linearGradient id="prepayFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b2ff77" stopOpacity={0.28} /><stop offset="95%" stopColor="#b2ff77" stopOpacity={0.01} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(value) => `${value}m`} tick={axis} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => `₹${formatCompact(Number(value))}`} tick={axis} axisLine={false} tickLine={false} width={68} />
              <Tooltip {...tooltip} formatter={(value) => formatCurrency(Number(value ?? 0))} labelFormatter={(value) => `Month ${value}`} />
              <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
              <Area type="monotone" dataKey="standard" name="Standard plan" stroke="#a4b1a6" fill="url(#standardFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="prepayment" name="With prepayment" stroke="#b2ff77" fill="url(#prepayFill)" strokeWidth={2.5} />
            </AreaChart>
          ) : (
            <BarChart data={data.slice(1)} margin={{ top: 12, right: 16, left: 6, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(value) => `${value}m`} tick={axis} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => `₹${formatCompact(Number(value))}`} tick={axis} axisLine={false} tickLine={false} width={68} />
              <Tooltip {...tooltip} formatter={(value) => formatCurrency(Number(value ?? 0))} labelFormatter={(value) => `Month ${Number(value)}`} />
              <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
              <Bar dataKey="principal" name="Principal paid" stackId="payment" fill="#b2ff77" />
              <Bar dataKey="interest" name="Interest paid" stackId="payment" fill="#e6a85d" radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </>
  );
}

export default RepaymentCharts;
