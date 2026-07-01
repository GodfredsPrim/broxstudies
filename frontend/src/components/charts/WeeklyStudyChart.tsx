import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const DATA = [
  { day: 'Mon', minutes: 25 },
  { day: 'Tue', minutes: 45 },
  { day: 'Wed', minutes: 30 },
  { day: 'Thu', minutes: 60 },
  { day: 'Fri', minutes: 20 },
  { day: 'Sat', minutes: 75 },
  { day: 'Sun', minutes: 40 },
]

export function WeeklyStudyChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={DATA} barSize={28}>
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
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}
