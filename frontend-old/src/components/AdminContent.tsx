import React from 'react'
import { FileText } from 'lucide-react'
import '../admin.css'

export const AdminContent: React.FC = () => {
  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><FileText size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">Content Management</h1>
              <p className="admin-subtitle">Manage syllabi, past questions, and textbooks.</p>
            </div>
          </div>
        </header>

        <section className="admin-section glass-card">
          <div className="py-20 text-center text-muted-foreground">
            <FileText size={64} strokeWidth={1} className="mx-auto mb-6 text-gray-300" />
            <h3 className="text-xl font-bold mb-2">Content Management</h3>
            <p className="max-w-md mx-auto">
              Upload and organize curriculum resources: syllabi, past exam questions, and textbooks.
            </p>
            <p className="text-sm text-gray-400 mt-4">This module is under development.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminContent
