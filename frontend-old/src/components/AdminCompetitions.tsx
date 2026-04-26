import React, { useEffect, useState } from 'react'
import { Trophy, Edit3, Trash2, RefreshCw } from 'lucide-react'
import { adminAPI, type Competition } from '../services/api'
import '../admin.css'

export const AdminCompetitions: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newComp, setNewComp] = useState({
    title: '',
    description: '',
    prize: '',
    start_date: '',
    end_date: '',
    quiz_json: '[]',
  })

  const loadData = async () => {
    try {
      const comps = await adminAPI.listAllCompetitions()
      setCompetitions(comps)
    } catch (err) {
      console.error('Failed to load competitions:', err)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => void loadData(), 60000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminAPI.createCompetition(newComp)
      alert('Competition created successfully.')
      setNewComp({ title: '', description: '', prize: '', start_date: '', end_date: '', quiz_json: '[]' })
      setShowModal(false)
      await loadData()
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.detail || 'Unknown error'))
    }
  }

  const handleDelete = async (compId: number) => {
    if (!window.confirm('Delete this competition permanently?')) return
    alert(`Competition deletion for ID ${compId} is not available yet. Please use a backend admin tool when implemented.`)
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <header className="admin-header glass-card">
          <div className="admin-header__brand">
            <div className="admin-header__icon"><Trophy size={24} className="text-white" /></div>
            <div>
              <h1 className="admin-title">Competition Management</h1>
              <p className="admin-subtitle">Create and manage all competitions.</p>
            </div>
          </div>
          <button onClick={() => void loadData()} className="admin-btn admin-btn--secondary">
            <RefreshCw size={18} /> Refresh
          </button>
        </header>

        <section className="admin-section glass-card">
          <div className="section-header mb-6">
            <h3 className="section-title">All Competitions</h3>
            <button onClick={() => setShowModal(true)} className="admin-btn admin-btn--primary">
              <Edit3 size={14} /> Create New
            </button>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Prize</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map((comp) => (
                  <tr key={comp.id}>
                    <td>
                      <div className="admin-comp-title">{comp.title}</div>
                      <div className="admin-meta line-clamp-1">{comp.description}</div>
                    </td>
                    <td><span className="admin-prize">{comp.prize || '—'}</span></td>
                    <td>{comp.start_date}</td>
                    <td>{comp.end_date}</td>
                    <td>
                      <span className={`admin-badge ${comp.is_active ? 'admin-badge--success' : 'admin-badge--neutral'}`}>
                        {comp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-action-buttons">
                        <button onClick={() => void handleDelete(comp.id)} className="admin-btn admin-btn--danger" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal glass-card p-10 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-gray-900">Create Competition</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompetition} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" placeholder="e.g. Science Mock 2026" value={newComp.title} onChange={e => setNewComp({ ...newComp, title: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Prize</label>
                  <input type="text" placeholder="e.g. 50 GHS" value={newComp.prize} onChange={e => setNewComp({ ...newComp, prize: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={newComp.start_date} onChange={e => setNewComp({ ...newComp, start_date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={newComp.end_date} onChange={e => setNewComp({ ...newComp, end_date: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea placeholder="Full competition details..." value={newComp.description} onChange={e => setNewComp({ ...newComp, description: e.target.value })} style={{ minHeight: '120px' }} required />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 admin-btn admin-btn--secondary py-4">
                  Cancel
                </button>
                <button type="submit" className="flex-1 admin-btn admin-btn--primary py-4">
                  Create Competition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminCompetitions
