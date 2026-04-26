import React, { useEffect, useState } from 'react';
import {
  Shield, RefreshCw, Users, CreditCard, CheckCircle2, XCircle,
  Copy, Activity, Trophy, Hash, Edit3, LayoutDashboard, UserCheck
} from 'lucide-react';
import { adminAPI, type AdminAnalytics, type Competition, type PaymentRequest } from '../services/api';
import '../admin.css';

type CouponInventoryItem = { code: string; duration_months: number; created_at: string };

export const AdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [coupons, setCoupons] = useState<CouponInventoryItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponForm, setCouponForm] = useState({ quantity: 5, durationMonths: 3 });
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [showCompModal, setShowCompModal] = useState(false);

  const [newComp, setNewComp] = useState({
    title: '', description: '', prize: '', start_date: '', end_date: '', quiz_json: '[]',
  });

  const loadData = async () => {
    try {
      setLoading(true); setError('');
      const [stats, comps, codes, payments] = await Promise.all([
        adminAPI.getAnalytics(), adminAPI.listAllCompetitions(), adminAPI.getCouponInventory(), adminAPI.getPendingPayments(),
      ]);
      setAnalytics(stats); setCompetitions(comps); setCoupons(codes); setPendingPayments(payments);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Authentication Required');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const pollId = setInterval(() => void loadData(), 60000);
    return () => clearInterval(pollId);
  }, []);

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createCompetition(newComp);
      alert('Competition created successfully.');
      setNewComp({ title: '', description: '', prize: '', start_date: '', end_date: '', quiz_json: '[]' });
      setShowCompModal(false);
      await loadData();
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleConfirmPayment = async (requestId: number) => {
    if (!window.confirm('Confirm this purchase and activate user subscription?')) return;
    try {
      await adminAPI.confirmPayment(requestId);
      await loadData();
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Error'));
    }
  };

  const handleRejectPayment = async (requestId: number) => {
    if (!window.confirm('Reject this purchase request?')) return;
    try {
      await adminAPI.rejectPayment(requestId);
      await loadData();
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Error'));
    }
  };

  const handleGenerateCoupons = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCouponBusy(true);
      const result = await adminAPI.generateCoupons({ quantity: couponForm.quantity, duration_months: couponForm.durationMonths });
      setGeneratedCodes(result.codes);
      await loadData();
    } catch (err: any) {
      alert('Coupon generation failed: ' + (err?.response?.data?.detail || 'Error'));
    } finally {
      setCouponBusy(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="pulse-loader"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="admin-section" style={{ maxWidth: '450px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔐</div>
          <h2 className="section-title" style={{ marginBottom: '10px' }}>Access Denied</h2>
          <p style={{ color: '#64748b', marginBottom: '25px' }}>{error}</p>
          <button onClick={() => window.location.hash = ''} className="admin-btn admin-btn--primary" style={{ margin: '0 auto' }}>
            Return to Learning Hub
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Pending Purchases', value: pendingPayments.length, color: '#ef4444', icon: <CreditCard size={20} /> },
    { label: 'Unused Codes', value: coupons.length, color: '#f59e0b', icon: <Hash size={20} /> },
    { label: 'Total Codes Generated', value: analytics?.total_codes_generated ?? 0, color: '#3b82f6', icon: <Activity size={20} /> },
    { label: 'Total Revenue', value: `GHS ${analytics?.total_revenue_ghs?.toFixed(2) ?? '0.00'}`, color: '#10b981', icon: <Trophy size={20} /> },
    { label: 'Total Users', value: analytics?.total_users ?? 0, color: '#8b5cf6', icon: <Users size={20} /> },
    { label: 'Active Subscriptions', value: analytics?.active_subscriptions ?? 0, color: '#06b6d4', icon: <UserCheck size={20} /> },
  ];

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><Shield size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">Admin Command Center</h1>
              <p className="admin-subtitle">System operations, user management, and platform oversight.</p>
            </div>
          </div>
          <button onClick={() => void loadData()} className="admin-btn admin-btn--secondary">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </header>

        <div className="admin-stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card glass-card" style={{ '--stat-color': stat.color } as any}>
              <div className="stat-card__icon" style={{ color: stat.color, background: `${stat.color}15` }}>{stat.icon}</div>
              <div className="stat-card__content">
                <span className="stat-label">{stat.label}</span>
                <div className="stat-value">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-main-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Payment Verification */}
            <section className="admin-section">
              <div className="section-header">
                <h3 className="section-title">Payment Verification</h3>
                <span className="admin-badge admin-badge--danger">{pendingPayments.length} Pending</span>
              </div>
              {pendingPayments.length === 0 ? (
                <div className="admin-empty-state"><CheckCircle2 size={48} strokeWidth={1.5} /><p>All payments verified.</p></div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead><tr><th>Learner</th><th>MoMo Details</th><th>Reference</th><th>Actions</th></tr></thead>
                    <tbody>
                      {pendingPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <div className="admin-user-cell">
                              <div className="admin-avatar">{payment.full_name.charAt(0).toUpperCase()}</div>
                              <div><div className="admin-name">{payment.full_name}</div><div className="admin-meta">{payment.email}</div></div>
                            </div>
                          </td>
                          <td>
                            <div className="admin-momo-cell">
                              <span className="admin-momo-name">{payment.momo_name}</span>
                              <span className="admin-momo-number">{payment.momo_number}</span>
                            </div>
                          </td>
                          <td><code className="admin-ref-code">{payment.reference || '—'}</code></td>
                          <td>
                            <div className="admin-action-buttons">
                              <button onClick={() => void handleConfirmPayment(payment.id)} className="admin-btn admin-btn--success"><CheckCircle2 size={14} /> Approve</button>
                              <button onClick={() => void handleRejectPayment(payment.id)} className="admin-btn admin-btn--danger"><XCircle size={14} /> Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Competition Management */}
            <section className="admin-section">
              <div className="section-header">
                <h3 className="section-title">Competition Management</h3>
                <button onClick={() => setShowCompModal(true)} className="admin-btn admin-btn--primary"><Edit3 size={14} /> Create New</button>
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Title</th><th>Prize</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                  <tbody>
                    {competitions.map((comp) => (
                      <tr key={comp.id}>
                        <td><div className="admin-comp-title">{comp.title}</div><div className="admin-meta line-clamp-1">{comp.description}</div></td>
                        <td><span className="admin-prize">{comp.prize || '—'}</span></td>
                        <td>{comp.start_date}</td>
                        <td>{comp.end_date}</td>
                        <td><span className={`admin-badge ${comp.is_active ? 'admin-badge--success' : 'admin-badge--neutral'}`}>{comp.is_active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Coupon Generation */}
            <section className="admin-section">
              <div className="section-header"><h3 className="section-title">Access Code Generator</h3></div>
              <div className="admin-card glass-card p-6">
                <form onSubmit={handleGenerateCoupons} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Quantity</label>
                    <input type="number" min={1} max={100} value={couponForm.quantity} onChange={(e) => setCouponForm(prev => ({ ...prev, quantity: Number(e.target.value) || 1 }))} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-ghana-green outline-none transition-all font-bold" />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Duration (months)</label>
                    <input type="number" min={1} max={12} value={couponForm.durationMonths} onChange={(e) => setCouponForm(prev => ({ ...prev, durationMonths: Number(e.target.value) || 1 }))} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-ghana-green outline-none transition-all font-bold" />
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" disabled={couponBusy} className="w-full admin-btn admin-btn--primary py-3.5">
                      {couponBusy ? 'Generating...' : <><Hash size={16} /> Generate Access Codes</>}
                    </button>
                  </div>
                </form>

                {generatedCodes.length > 0 && (
                  <div className="admin-code-list mt-6">
                    <div className="text-[10px] font-black text-ghana-green uppercase tracking-widest mb-3">Recently Generated</div>
                    <div className="space-y-2">
                      {generatedCodes.map((code) => (
                        <div key={code} className="admin-code-item">
                          <code className="font-mono font-bold">{code}</code>
                          <button onClick={() => navigator.clipboard.writeText(code)} className="admin-copy-btn"><Copy size={14} /> Copy</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="admin-vault mt-8">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><LayoutDashboard size={14} /> Inventory Vault</h4>
                  {coupons.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No unused codes in inventory.</p>
                  ) : (
                    <div className="admin-vault-list">
                      {coupons.map((coupon) => (
                        <div key={coupon.code} className="admin-vault-item">
                          <div><code className="font-mono font-bold text-gray-900">{coupon.code}</code><div className="text-[10px] font-bold text-gray-400">{coupon.duration_months} Month Premium</div></div>
                          <button onClick={() => navigator.clipboard.writeText(coupon.code)} className="admin-copy-btn"><Copy size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* System Health */}
            <div className="admin-section glass-card p-6 bg-gh-ink text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-ghana-green/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <h4 className="text-lg font-black mb-1 flex items-center gap-2"><Activity size={18} className="text-ghana-green" /> System Health</h4>
              <p className="text-xs text-gray-400 mb-6">Overall performance status.</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Database</span>
                  <span className="flex items-center gap-1.5 text-ghana-green font-black"><span className="w-1.5 h-1.5 rounded-full bg-ghana-green animate-pulse" /> Online</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Total Users</span>
                  <span className="font-black">{analytics?.total_users ?? 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Active Subs</span>
                  <span className="font-black">{analytics?.active_subscriptions ?? 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Adoption Rate</span>
                  <span className="font-black text-ghana-green">
                    {analytics?.total_users ? Math.round(((analytics?.active_subscriptions || 0) / analytics.total_users) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Create Competition Modal */}
        {showCompModal && (
          <div className="admin-modal-overlay">
            <div className="admin-modal glass-card p-10 animate-scale-up">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-gray-900">Create New Competition</h2>
                <button onClick={() => setShowCompModal(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">✕</button>
              </div>
              <form onSubmit={handleCreateCompetition} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group"><label>Title</label><input type="text" placeholder="e.g. Science Mock 2026" value={newComp.title} onChange={(e) => setNewComp({ ...newComp, title: e.target.value })} required /></div>
                  <div className="form-group"><label>Prize</label><input type="text" placeholder="e.g. 50 GHS" value={newComp.prize} onChange={(e) => setNewComp({ ...newComp, prize: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group"><label>Start Date</label><input type="date" value={newComp.start_date} onChange={(e) => setNewComp({ ...newComp, start_date: e.target.value })} required /></div>
                  <div className="form-group"><label>End Date</label><input type="date" value={newComp.end_date} onChange={(e) => setNewComp({ ...newComp, end_date: e.target.value })} required /></div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea placeholder="Full competition details..." value={newComp.description} onChange={(e) => setNewComp({ ...newComp, description: e.target.value })} style={{ minHeight: '120px' }} required />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowCompModal(false)} className="flex-1 admin-btn admin-btn--secondary py-4">Cancel</button>
                  <button type="submit" className="flex-1 admin-btn admin-btn--primary py-4">Create Competition</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
