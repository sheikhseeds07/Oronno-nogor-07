import { lazy, Suspense, memo } from "react";

const Chart = lazy(async () => {
  const r = await import("recharts");
  const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } = r;
  function Inner({ data, bars }: { data: any[]; bars: { key: string; name: string; color: string }[] }) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <XAxis dataKey="day" fontSize={11} />
          <YAxis fontSize={11} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} />
          ))}

        </BarChart>
      </ResponsiveContainer>
    );
  }
  return { default: Inner };
});

function FunnelChartImpl({ data, bars }: { data: any[]; bars: { key: string; name: string; color: string }[] }) {
  return (
    <Suspense fallback={<div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">চার্ট লোড হচ্ছে...</div>}>
      <Chart data={data} bars={bars} />
    </Suspense>
  );
}

export const LazyFunnelChart = memo(FunnelChartImpl);
