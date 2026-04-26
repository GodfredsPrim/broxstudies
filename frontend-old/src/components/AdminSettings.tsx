import React from 'react'
import { Settings } from 'lucide-react'
import '../admin.css'

export const AdminSettings: React.FC = () => {
  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><Settings size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">System Settings</h1>
              <p className="admin-subtitle">Configure platform preferences and integrations.</p>
            </div>
          </div>
        </header>

        <section className="admin-section glass-card">
          <div className="py-20 text-center text-muted-foreground">
            <Settings size={64} strokeWidth={1} className="mx-auto mb-6 text-gray-300" />
            <h3 className="text-xl font-bold mb-2">Settings Panel</h3>
            <p className="max-w-md mx-auto">
              Manage site configuration, API keys, subscription plans, and notification settings.
            </p>
            <p className="text-sm text-gray-400 mt-4">This module is under development.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminSettings
