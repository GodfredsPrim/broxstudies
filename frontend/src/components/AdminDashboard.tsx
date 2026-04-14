import React, { useEffect, useState } from 'react';
import {
  adminAPI,
  setAuthToken,
  type AdminAnalytics,
  type Competition,
  type PaymentRequest,
} from '../services/api';

type CouponInventoryItem = {
  code: string;
  duration_months: number;
  created_at: string;
};

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
  const [adminLogin, setAdminLogin] = useState({ username: '', password: '' });

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
        adminAPI.listCompetitions(),
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

    // Live update polling - every 40 seconds
    const pollId = setInterval(() => {
      void loadData();
    }, 40000);

    return () => clearInterval(pollId);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { access_token } = await adminAPI.login(adminLogin.username, adminLogin.password);
      localStorage.setItem('bisame_access_token', access_token);
      setAuthToken(access_token);
      window.location.hash = 'admin';
      window.location.reload();
    } catch (err: any) {
      alert('Login Failed: ' + (err?.response?.data?.detail || 'Error'));
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createCompetition(newComp);
      alert('Announcement / competition posted successfully.');
      setNewComp({ title: '', description: '', prize: '', start_date: '', end_date: '', quiz_json: '[]' });
      const modal = document.getElementById('create-comp-modal');
      if (modal) modal.style.display = 'none';
      await loadData();
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleConfirmPayment = async (requestId: number) => {
    if (!window.confirm('Confirm this purchase and activate user subscription?')) return;
    try {
      await adminAPI.confirmPayment(requestId);
      alert('Purchase confirmed.');
      await loadData();
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Error'));
    }
  };

  const handleRejectPayment = async (requestId: number) => {
    if (!window.confirm('Reject this purchase request?')) return;
    try {
      await adminAPI.rejectPayment(requestId);
      alert('Purchase request rejected.');
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

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="pulse-loader"></div>
        <p style={{ marginLeft: '15px', color: '#64748b', fontWeight: 600 }}>Loading Administrative Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '450px', background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔐</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px' }}>Authentication Error</h2>
          <p style={{ color: '#64748b', marginBottom: '25px' }}>{error}</p>
          <button 
            onClick={() => window.location.hash = ''}
            style={{ padding: '12px 24px', borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Return to Study Home
          </button>
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Pending Purchases', value: pendingPayments.length, color: '#ef4444' },
    { label: 'Access Codes', value: coupons.length, color: '#f59e0b' },
    { label: 'Codes Generated', value: analytics?.total_codes_generated ?? 0, color: '#3b82f6' },
    { label: 'Codes Used', value: analytics?.total_codes_used ?? 0, color: '#10b981' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Administrative Dashboard</h1>
            <p style={{ color: '#64748b', margin: '5px 0 0 0' }}>Post announcements, review purchases, manage competitions, and inspect user code inventory.</p>
          </div>
          <button
            onClick={() => void loadData()}
            style={{ padding: '12px 24px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
          >
            Refresh Dashboard
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
          {cards.map((stat) => (
            <div key={stat.label} style={{ padding: '24px', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{stat.label}</span>
              <div style={{ fontSize: '2rem', margin: '5px 0 0 0', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <section style={{ background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Purchases</h3>
                <span style={{ padding: '4px 12px', background: '#fee2e2', color: '#ef4444', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>
                  {pendingPayments.length} Pending
                </span>
              </div>

              {pendingPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No pending purchases.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingPayments.map((payment) => (
                    <div key={payment.id} style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', flex: 1 }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>User</div>
                          <div style={{ fontWeight: 700 }}>{payment.full_name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{payment.email}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>MoMo</div>
                          <div style={{ fontWeight: 600 }}>{payment.momo_name}</div>
                          <div style={{ fontSize: '0.85rem' }}>{payment.momo_number}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Reference</div>
                          <div style={{ fontWeight: 600 }}>{payment.reference || '—'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => void handleConfirmPayment(payment.id)} style={{ padding: '10px 20px', borderRadius: '12px', background: '#10b981', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                          Confirm
                        </button>
                        <button onClick={() => void handleRejectPayment(payment.id)} style={{ padding: '10px 20px', borderRadius: '12px', background: 'white', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Announcements & Competitions</h3>
                <button
                  onClick={() => {
                    const modal = document.getElementById('create-comp-modal');
                    if (modal) modal.style.display = 'flex';
                  }}
                  style={{ padding: '10px 20px', borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  + Post New
                </button>
              </div>

              {competitions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No announcements or competitions posted yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {competitions.map((item) => (
                    <div key={item.id} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'start' }}>
                        <div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>{item.title}</div>
                          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '12px' }}>{item.description}</p>
                        </div>
                        <span style={{ padding: '6px 12px', background: item.is_active ? '#dcfce7' : '#e2e8f0', color: item.is_active ? '#166534' : '#475569', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800 }}>
                          {item.is_active ? 'Active' : 'Scheduled'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                        <span><strong>Start:</strong> {item.start_date}</span>
                        <span><strong>End:</strong> {item.end_date}</span>
                        <span><strong>Prize:</strong> {item.prize || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', fontWeight: 800 }}>Access Code Inventory</h4>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>Inspect user codes and generate fresh access inventory.</p>

              <form onSubmit={handleGenerateCoupons} style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={couponForm.quantity}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                  style={{ padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                  placeholder="Quantity"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={couponForm.durationMonths}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, durationMonths: Number(e.target.value) || 1 }))}
                  style={{ padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                  placeholder="Duration (months)"
                />
                <button
                  type="submit"
                  disabled={couponBusy}
                  style={{ padding: '12px', borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {couponBusy ? 'Generating...' : 'Generate Codes'}
                </button>
              </form>

              {generatedCodes.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '14px', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#155e75', marginBottom: '10px' }}>New Codes</div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {generatedCodes.map((code) => (
                      <code key={code} style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{code}</code>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                {coupons.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', color: '#94a3b8' }}>No unused codes available.</div>
                ) : (
                  coupons.map((coupon) => (
                    <div key={coupon.code} style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <code style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>{coupon.code}</code>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{coupon.duration_months} month plan</div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code);
                          alert('Copied!');
                        }}
                        style={{ padding: '6px 10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Copy
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>

        <div id="create-comp-modal" style={{ display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '32px', width: '100%', maxWidth: '600px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '30px' }}>Post Announcement / Competition</h2>
            <form onSubmit={handleCreateCompetition} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '15px' }}>
                <input type="text" placeholder="Title" value={newComp.title} onChange={(e) => setNewComp({ ...newComp, title: e.target.value })} style={{ padding: '15px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }} required />
                <input type="text" placeholder="Prize (optional)" value={newComp.prize} onChange={(e) => setNewComp({ ...newComp, prize: e.target.value })} style={{ padding: '15px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <input type="date" value={newComp.start_date} onChange={(e) => setNewComp({ ...newComp, start_date: e.target.value })} style={{ padding: '15px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }} required />
                <input type="date" value={newComp.end_date} onChange={(e) => setNewComp({ ...newComp, end_date: e.target.value })} style={{ padding: '15px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }} required />
              </div>
              <textarea placeholder="Write announcement or competition details here..." value={newComp.description} onChange={(e) => setNewComp({ ...newComp, description: e.target.value })} style={{ padding: '15px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: '120px' }} required />
              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="button" onClick={() => { const modal = document.getElementById('create-comp-modal'); if (modal) modal.style.display = 'none'; }} style={{ flex: 1, padding: '15px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }}>
                  Cancel
                </button>
                <button type="submit" style={{ flex: 1, padding: '15px', borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
