import React, { useEffect, useState } from 'react'
import { BarChart3, Activity, Trophy, Users, UserCheck, RefreshCw } from 'lucide-react'
import { adminAPI, type AdminAnalytics as AdminAnalyticsType } from '../services/api'
import '../admin.css'

export const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AdminAnalyticsType | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const data = await adminAPI.getAnalytics()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => void loadData(), 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !analytics) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="pulse-loader"></div>
      </div>
    )
  }

  const stats = [
    { label: 'Total Users', value: analytics.total_users, icon: <Users size={24} />, color: '#8b5cf6' },
    { label: 'Active Subscriptions', value: analytics.active_subscriptions, icon: <UserCheck size={24} />, color: '#06b6d4' },
    { label: 'Total Revenue', value: `GHS ${analytics.total_revenue_ghs.toFixed(2)}`, icon: <Trophy size={24} />, color: '#10b981' },
    { label: 'Codes Generated', value: analytics.total_codes_generated, icon: <Activity size={24} />, color: '#3b82f6' },
    { label: 'Codes Used', value: analytics.total_codes_used, icon: <BarChart3 size={24} />, color: '#f59e0b' },
    { label: 'Expiring Soon', value: analytics.expiring_subscriptions, icon: <Activity size={24} />, color: '#ef4444' },
  ]

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><BarChart3 size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">Analytics Dashboard</h1>
              <p className="admin-subtitle">Platform overview and key metrics.</p>
            </div>
          </div>
          <button onClick={() => void loadData()} className="admin-btn admin-btn--secondary">
            <RefreshCw size={18} /> Refresh
          </button>
        </header>

        <div className="admin-stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card glass-card" style={{ '--stat-color': stat.color } as any}>
              <div className="stat-card__icon" style={{ color: stat.color, background: `${stat.color}15` }}>
                {stat.icon}
              </div>
              <div className="stat-card__content">
                <span className="stat-label">{stat.label}</span>
                <div className="stat-value">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        <section className="admin-section glass-card">
          <h3 className="section-title mb-6">Recent Activity</h3>
          {analytics.recent_activity.length === 0 ? (
            <p className="text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {analytics.recent_activity.map((activity, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{activity.full_name}</span>
                  <span className="text-xs text-gray-500">{activity.type}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default AdminAnalytics
