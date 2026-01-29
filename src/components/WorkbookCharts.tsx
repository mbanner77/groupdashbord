"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const tooltipStyle = {
  borderRadius: 12,
  border: "none",
  background: "rgba(15, 23, 42, 0.95)",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.25)",
  padding: "12px 16px"
};

const tooltipLabelStyle = { color: "#f1f5f9", fontWeight: 600, marginBottom: 4 };
const tooltipItemStyle = { color: "#cbd5e1", fontSize: 13 };

export function WorkbookBarChart(props: {
  title: string;
  data: Array<{ month: number; label: string; plan: number; actualForecast: number }>;
  planLabel: string;
  actualForecastLabel: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200/60">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-sky-500 to-emerald-500" />
        <h3 className="text-base font-semibold text-slate-900">{props.title}</h3>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={props.data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }} barCategoryGap="20%">
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
            />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="plan" name={props.planLabel} fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            <Bar dataKey="actualForecast" name={props.actualForecastLabel} fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function WorkbookLineChart(props: {
  title: string;
  data: Array<Record<string, number | string>>;
  xKey: string;
  lines: Array<{ key: string; name: string; color: string }>;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200/60">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-sky-500 to-slate-400" />
        <h3 className="text-base font-semibold text-slate-900">{props.title}</h3>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey={props.xKey}
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
            />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              iconType="plainline"
              iconSize={20}
            />
            {props.lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: l.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: l.color, stroke: "#fff", strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
