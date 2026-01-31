"use client";

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
};

export function Sparkline({ 
  values, 
  width = 80, 
  height = 24, 
  color = "#0ea5e9",
  showDots = false 
}: SparklineProps) {
  if (!values || values.length === 0) {
    return <div style={{ width, height }} className="bg-slate-100 dark:bg-slate-700 rounded" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((v - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  const trend = values[values.length - 1] - values[0];
  const trendColor = trend >= 0 ? "#10b981" : "#ef4444";

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {showDots && values.map((v, i) => {
        const x = padding + (i / (values.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((v - min) / range) * chartHeight;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill={i === values.length - 1 ? trendColor : color}
          />
        );
      })}
    </svg>
  );
}

type SparkbarProps = {
  values: number[];
  width?: number;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
};

export function Sparkbar({
  values,
  width = 80,
  height = 24,
  positiveColor = "#10b981",
  negativeColor = "#ef4444",
}: SparkbarProps) {
  if (!values || values.length === 0) {
    return <div style={{ width, height }} className="bg-slate-100 dark:bg-slate-700 rounded" />;
  }

  const max = Math.max(...values.map(Math.abs));
  const barWidth = (width - values.length + 1) / values.length;

  return (
    <svg width={width} height={height} className="inline-block">
      {values.map((v, i) => {
        const barHeight = (Math.abs(v) / max) * (height - 4);
        const x = i * (barWidth + 1);
        const y = v >= 0 ? height - 2 - barHeight : height - 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={v >= 0 ? positiveColor : negativeColor}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
