import React, { useEffect, useState } from 'react';
import { 
  Shield, 
  RefreshCw, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Plus, 
  Activity, 
  Trash2, 
  MessageSquare, 
  Trophy,
  Search,
  LayoutDashboard,
  Settings,
  Mail,
  Smartphone,
  Hash
} from 'lucide-react';
import {
  adminAPI,
  type AdminAnalytics,
  type Competition,
  type PaymentRequest,
} from '../services/api';
import '../admin.css';

type CouponInventoryItem = {
  code: string;
  duration_months: number;
  created_at: string;
};

// ── Icons Removed (Using Lucide) ───────────────────────────────────────────

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
    title: '',
    description: '',
    prize: '',
    start_date: '',
    end_date: '',
    quiz_json: '[]',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [stats, comps, codes, payments] = await Promise.all([
        adminAPI.getAnalytics(),
        adminAPI.listAllCompetitions(),
        adminAPI.getCouponInventory(),
        adminAPI.getPendingPayments(),
      ]);
      setAnalytics(stats);
      setCompetitions(comps);
      setCoupons(codes);
      setPendingPayments(payments);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Authentication Required');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    // Live update polling - every 60 seconds
    const pollId = setInterval(() => {
      void loadData();
    }, 60000);

    return () => clearInterval(pollId);
  }, []);

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createCompetition(newComp);
      alert('Post published successfully.');
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
      const result = await adminAPI.generateCoupons({
        quantity: couponForm.quantity,
        duration_months: couponForm.durationMonths,
      });
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
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-loader" style={{ margin: '0 auto 20px auto' }}></div>
          <p style={{ color: '#64748b', fontWeight: 600 }}>Syncing BroxStudies System...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    { label: 'Total Codes', value: analytics?.total_codes_generated ?? 0, color: '#3b82f6', icon: <Activity size={20} /> },
    { label: 'Total Revenue', value: `GHS ${analytics?.total_revenue_ghs?.toFixed(2) ?? '0.00'}`, color: '#10b981', icon: <Trophy size={20} /> },
  ];

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="admin-title">System Administration</h1>
              <p className="admin-subtitle">Command center for BroxStudies platform operations.</p>
            </div>
          </div>
          <button onClick={() => void loadData()} className="generator-btn generator-btn--secondary">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
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

        <div className="admin-main-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Purchase Verification Section */}
            <section className="admin-section">
              <div className="section-header">
                <h3 className="section-title">Purchase Verification</h3>
                <span className="admin-btn admin-btn--outline" style={{ cursor: 'default', opacity: 1 }}>
                  {pendingPayments.length} Pending
                </span>
              </div>

              {pendingPayments.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground italic">
                  <div className="w-16 h-16 bg-ghana-green/10 rounded-full flex items-center justify-center mx-auto mb-4 text-ghana-green">
                    <CheckCircle2 size={32} />
                  </div>
                  No pending purchases to verify.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingPayments.map((payment) => (
                    <div key={payment.id} className="admin-card-item glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 w-full">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                            <Users size={12} /> Learner
                          </span>
                          <span className="font-bold text-gray-900">{payment.full_name}</span>
                          <span className="text-xs text-muted-foreground">{payment.email}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                            <Smartphone size={12} /> MoMo Details
                          </span>
                          <span className="font-bold text-gray-900">{payment.momo_name}</span>
                          <span className="text-xs text-muted-foreground">{payment.momo_number}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                            <Hash size={12} /> Reference
                          </span>
                          <span className="font-bold text-gray-900">{payment.reference || '—'}</span>
                        </div>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                        <button onClick={() => void handleConfirmPayment(payment.id)} className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-ghana-green text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition-colors">
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button onClick={() => void handleRejectPayment(payment.id)} className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100">
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Announcements Section */}
            <section className="admin-section">
              <div className="section-header">
                <h3 className="section-title">Broadcasts & Competitions</h3>
                <button onClick={() => setShowCompModal(true)} className="admin-btn admin-btn--primary">
                  + Create Post
                </button>
              </div>

              {competitions.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground italic">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
                    <MessageSquare size={32} />
                  </div>
                  No announcements published yet.
                </div>
              ) : (
                <div className="grid gap-4">
                  {competitions.map((item) => (
                    <div key={item.id} className="admin-card-item glass-card p-6 hover:shadow-xl transition-shadow group">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div>
                          <div className="text-xl font-black text-gray-900 group-hover:text-ghana-green transition-colors">{item.title}</div>
                          <p className="text-gray-600 mt-2 line-clamp-2">{item.description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          item.is_active ? 'bg-ghana-green/10 text-ghana-green' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {item.is_active ? 'LIVE' : 'ARCHIVED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Start</span>
                          <span className="text-xs font-bold text-gray-700">{item.start_date}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deadline</span>
                          <span className="text-xs font-bold text-gray-700">{item.end_date}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reward</span>
                          <span className="text-xs font-bold text-ghana-green">{item.prize || '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="admin-section glass-card p-6">
              <h4 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                <Hash size={18} className="text-ghana-green" /> Code Generation
              </h4>
              <p className="text-xs text-gray-500 mb-6">Batch produce secure access codes for offline distribution.</p>

              <form onSubmit={handleGenerateCoupons} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={couponForm.quantity}
                      onChange={(e) => setCouponForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-ghana-green outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Months</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={couponForm.durationMonths}
                      onChange={(e) => setCouponForm((prev) => ({ ...prev, durationMonths: Number(e.target.value) || 1 }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-ghana-green outline-none transition-all font-bold"
                    />
                  </div>
                </div>
                <button type="submit" disabled={couponBusy} className="w-full generator-btn generator-btn--primary py-3.5 text-xs">
                  {couponBusy ? 'Securing...' : 'Generate Batch'}
                </button>
              </form>

              {generatedCodes.length > 0 && (
                <div className="mt-6 p-4 bg-ghana-green/5 border border-ghana-green/20 rounded-2xl animate-scale-up">
                  <div className="text-[10px] font-black text-ghana-green uppercase tracking-widest mb-3">Recently Generated</div>
                  <div className="space-y-2">
                    {generatedCodes.map((code) => (
                      <div key={code} className="flex justify-between items-center p-3 bg-white rounded-xl border border-ghana-green/10">
                        <code className="font-mono font-bold text-gray-900">{code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(code); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-ghana-green transition-colors">
                          <Copy size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <LayoutDashboard size={12} /> Inventory Vault
                </div>
                {coupons.length === 0 ? (
                  <div className="py-10 text-center text-xs text-gray-400 italic">Vault is empty.</div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {coupons.map((coupon) => (
                      <div key={coupon.code} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-ghana-green/30 transition-colors">
                        <div>
                          <code className="font-mono font-bold text-gray-900">{coupon.code}</code>
                          <div className="text-[10px] font-bold text-gray-400">{coupon.duration_months} Month Premium</div>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(coupon.code); }} className="p-2 rounded-lg hover:bg-white hover:text-ghana-green transition-colors text-gray-400 shadow-sm">
                          <Copy size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="admin-section glass-card p-6 bg-gray-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-ghana-green/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <h4 className="text-lg font-black mb-1 flex items-center gap-2">
                <Activity size={18} className="text-ghana-green" /> System Health
              </h4>
              <p className="text-xs text-gray-400 mb-6">Overall performance status.</p>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">DB Status</span>
                  <span className="flex items-center gap-1.5 text-ghana-green font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-ghana-green animate-pulse" /> Online
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Active Users</span>
                  <span className="font-black">{analytics?.total_users ?? 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Adoption Rate</span>
                  <span className="font-black text-ghana-green">
                    {analytics?.total_users ? Math.round(((analytics?.active_subscriptions || 0) / analytics.total_users) * 100) : 0}%
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                 <button className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-all flex items-center justify-center gap-2">
                   <Settings size={14} /> Global Settings
                 </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Create Competition Modal */}
        {showCompModal && (
          <div className="admin-modal-overlay">
            <div className="admin-modal glass-card p-10 animate-scale-up">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-gray-900">New Broadcast</h2>
                <button onClick={() => setShowCompModal(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>
              
              <form onSubmit={handleCreateCompetition} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label>Title</label>
                    <input type="text" placeholder="e.g. Science Mock 2026" value={newComp.title} onChange={(e) => setNewComp({ ...newComp, title: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Reward</label>
                    <input type="text" placeholder="e.g. 50 GHS" value={newComp.prize} onChange={(e) => setNewComp({ ...newComp, prize: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={newComp.start_date} onChange={(e) => setNewComp({ ...newComp, start_date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Deadline</label>
                    <input type="date" value={newComp.end_date} onChange={(e) => setNewComp({ ...newComp, end_date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Announcement Content</label>
                  <textarea placeholder="Write full details here..." value={newComp.description} onChange={(e) => setNewComp({ ...newComp, description: e.target.value })} style={{ minHeight: '140px' }} required />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowCompModal(false)} className="flex-1 generator-btn generator-btn--secondary py-4">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 generator-btn generator-btn--primary py-4">
                    Publish to System
                  </button>
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
