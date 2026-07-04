import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const FALLBACK = [
  { day: 'Mon', minutes: 0 },
  { day: 'Tue', minutes: 0 },
  { day: 'Wed', minutes: 0 },
  { day: 'Thu', minutes: 0 },
  { day: 'Fri', minutes: 0 },
  { day: 'Sat', minutes: 0 },
  { day: 'Sun', minutes: 0 },
]

interface WeeklyStudyChartProps {
  data?: { day: string; minutes: number }[]
}

export function WeeklyStudyChart({ data }: WeeklyStudyChartProps) {
  const chartData = data && data.some(d => d.minutes > 0) ? data : FALLBACK

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-3)', fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-3)', fontSize: 12 }} width={30} />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            fontSize: '13px',
          }}
          formatter={(v) => [`${v ?? 0} min`, 'Study time']}
        />
        <Bar dataKey="minutes" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}
