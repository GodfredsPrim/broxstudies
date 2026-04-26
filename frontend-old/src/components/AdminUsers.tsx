import React, { useEffect, useState } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import '../admin.css'

export const AdminUsers: React.FC = () => {
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      // Placeholder – backend endpoint needed
      // const data = await adminAPI.getAllUsers()
      // setUsers(data)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load users:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  if (loading) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="pulse-loader"></div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><Users size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">User Management</h1>
              <p className="admin-subtitle">View and manage user accounts.</p>
            </div>
          </div>
          <button onClick={() => void loadUsers()} className="admin-btn admin-btn--secondary">
            <RefreshCw size={18} /> Refresh
          </button>
        </header>

        <section className="admin-section glass-card">
          <div className="py-20 text-center text-muted-foreground">
            <p>User management panel coming soon.</p>
            <p className="text-sm mt-2">This section will display user lists, subscription status, and admin tools.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminUsers
