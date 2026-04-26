import React, { useEffect, useState } from 'react'
import { CreditCard, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { adminAPI, type PaymentRequest } from '../services/api'
import '../admin.css'

export const AdminPayments: React.FC = () => {
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const payments = await adminAPI.getPendingPayments()
      setPendingPayments(payments)
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => void loadData(), 60000)
    return () => clearInterval(interval)
  }, [])

  const handleConfirm = async (requestId: number) => {
    if (!window.confirm('Confirm this purchase and activate user subscription?')) return
    try {
      await adminAPI.confirmPayment(requestId)
      await loadData()
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Error'))
    }
  }

  const handleReject = async (requestId: number) => {
    if (!window.confirm('Reject this purchase request?')) return
    try {
      await adminAPI.rejectPayment(requestId)
      await loadData()
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Error'))
    }
  }

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
            <div className="admin-header__icon"><CreditCard size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">Payment Verification</h1>
              <p className="admin-subtitle">Review and process payment requests.</p>
            </div>
          </div>
          <button onClick={() => void loadData()} className="admin-btn admin-btn--secondary">
            <RefreshCw size={18} /> Refresh
          </button>
        </header>

        <section className="admin-section glass-card">
          {pendingPayments.length === 0 ? (
            <div className="admin-empty-state">
              <CheckCircle2 size={48} strokeWidth={1.5} />
              <p>All payments verified. No pending requests.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>MoMo Details</th>
                    <th>Reference</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-avatar">{payment.full_name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="admin-name">{payment.full_name}</div>
                            <div className="admin-meta">{payment.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-momo-cell">
                          <span className="admin-momo-name">{payment.momo_name}</span>
                          <span className="admin-momo-number">{payment.momo_number}</span>
                        </div>
                      </td>
                      <td>
                        <code className="admin-ref-code">{payment.reference || '—'}</code>
                      </td>
                      <td>
                        <div className="admin-action-buttons">
                          <button onClick={() => void handleConfirm(payment.id)} className="admin-btn admin-btn--success">
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button onClick={() => void handleReject(payment.id)} className="admin-btn admin-btn--danger">
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default AdminPayments
