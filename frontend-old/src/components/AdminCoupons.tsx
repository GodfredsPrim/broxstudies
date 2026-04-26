import React, { useEffect, useState } from 'react'
import { Hash, Copy, LayoutDashboard, RefreshCw } from 'lucide-react'
import { adminAPI } from '../services/api'
import '../admin.css'

type CouponInventoryItem = {
  code: string
  duration_months: number
  created_at: string
}

export const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponForm, setCouponForm] = useState({ quantity: 5, durationMonths: 3 })
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  const loadData = async () => {
    try {
      const inventory = await adminAPI.getCouponInventory()
      setCoupons(inventory)
    } catch (err) {
      console.error('Failed to load coupons:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => void loadData(), 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="pulse-loader"></div>
      </div>
    )
  }

  const handleGenerateCoupons = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCouponBusy(true)
      const result = await adminAPI.generateCoupons({
        quantity: couponForm.quantity,
        duration_months: couponForm.durationMonths,
      })
      setGeneratedCodes(result.codes)
      await loadData()
    } catch (err: any) {
      alert('Coupon generation failed: ' + (err?.response?.data?.detail || 'Error'))
    } finally {
      setCouponBusy(false)
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><Hash size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">Access Code Generator</h1>
              <p className="admin-subtitle">Generate and manage subscription codes.</p>
            </div>
          </div>
          <button onClick={() => void loadData()} className="admin-btn admin-btn--secondary">
            <RefreshCw size={18} /> Refresh
          </button>
        </header>

        <div className="admin-main-grid">
          <div className="admin-section glass-card p-6">
            <h3 className="section-title mb-6">Generate New Codes</h3>
            <form onSubmit={handleGenerateCoupons} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={couponForm.quantity}
                  onChange={(e) => setCouponForm(prev => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-ghana-green outline-none transition-all font-bold"
                />
              </div>
              <div className="form-group">
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Duration (months)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={couponForm.durationMonths}
                  onChange={(e) => setCouponForm(prev => ({ ...prev, durationMonths: Number(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-ghana-green outline-none transition-all font-bold"
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={couponBusy} className="admin-btn admin-btn--primary py-3.5">
                  {couponBusy ? 'Generating...' : <><Hash size={16} /> Generate Batch</>}
                </button>
              </div>
            </form>

            {generatedCodes.length > 0 && (
              <div className="admin-code-list mt-8">
                <div className="text-[10px] font-black text-ghana-green uppercase tracking-widest mb-3">Recently Generated</div>
                <div className="space-y-2">
                  {generatedCodes.map((code) => (
                    <div key={code} className="admin-code-item">
                      <code className="font-mono font-bold">{code}</code>
                      <button onClick={() => navigator.clipboard.writeText(code)} className="admin-copy-btn">
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="admin-section glass-card p-6">
            <h3 className="section-title mb-6 flex items-center gap-2">
              <LayoutDashboard size={18} /> Inventory Vault
            </h3>
            {coupons.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No unused codes in inventory.</p>
            ) : (
              <div className="admin-vault-list">
                {coupons.map((coupon) => (
                  <div key={coupon.code} className="admin-vault-item">
                    <div>
                      <code className="font-mono font-bold text-gray-900">{coupon.code}</code>
                      <div className="text-[10px] font-bold text-gray-400">{coupon.duration_months} Month Premium</div>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(coupon.code)} className="admin-copy-btn">
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

export default AdminCoupons
