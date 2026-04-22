import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Zap, FileText, ChevronRight, Gift, Calendar } from 'lucide-react';
import { adminAPI, type Competition } from '../services/api';

export const CompetitionPortal: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const fetchCompetitions = async () => {
    try {
      const data = await adminAPI.listCompetitions();
      setCompetitions(data);
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleRegister = async (compId: number) => {
    setRegisteringId(compId);
    try {
      await adminAPI.registerForCompetition(compId);
      alert('Success! You are now registered for this competition. Keep an eye on the start date!');
      fetchCompetitions();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to register.');
    } finally {
      setRegisteringId(null);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
      <div className="pulse-loader"></div>
      <p style={{ marginLeft: '15px', fontWeight: 600 }}>Loading Announcements...</p>
    </div>
  );

  return (
    <div className="generator-shell">
      <header className="generator-header">
        <div className="generator-header__content">
          <h1 className="generator-title">Monthly Challenges</h1>
          <p className="generator-subtitle">Stay updated with the latest rewards, announcements, and competition details.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {competitions.length > 0 ? competitions.map((comp) => (
          <div key={comp.id} className="group glass-card overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border border-gray-100">
            <div className="relative">
              <div className="absolute top-4 right-4 z-10">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  comp.pdf_url ? 'bg-ghana-green text-white' : 'bg-amber-500 text-white'
                }`}>
                  {comp.pdf_url ? '🚀 Live' : '⏳ Pending'}
                </span>
              </div>
              
              {comp.image_url ? (
                <div className="h-48 overflow-hidden">
                  <img src={comp.image_url} alt={comp.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-gray-200">
                   <Trophy size={64} strokeWidth={1} />
                </div>
              )}
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-2xl font-black text-gray-900 mb-3 group-hover:text-ghana-green transition-colors">{comp.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3">{comp.description}</p>
              
              <div className="mt-auto space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 group-hover:bg-white group-hover:border-ghana-green/20 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Gift size={14} className="text-ghana-green" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grand Prize</span>
                  </div>
                  <div className="text-2xl font-black text-ghana-green">{comp.prize}</div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200/50 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                      <Calendar size={14} />
                      {new Date(comp.start_date).toLocaleDateString()}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-ghana-green group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                <div className="flex gap-3">
                  {comp.pdf_url ? (
                    <>
                      <a 
                        href={comp.pdf_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-900 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                      >
                        <FileText size={14} /> Paper
                      </a>
                      <button 
                        className="flex-[1.5] py-3.5 rounded-xl bg-gray-900 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-ghana-green transition-all shadow-lg hover:shadow-ghana-green/20"
                        onClick={() => handleRegister(comp.id)}
                        disabled={registeringId === comp.id}
                      >
                        {registeringId === comp.id ? 'Loading...' : <><Zap size={14} /> Register</>}
                      </button>
                    </>
                  ) : (
                    <div className="w-full py-3.5 rounded-xl bg-gray-50 border border-dashed border-gray-300 text-gray-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                       <Clock size={14} /> Waiting for Paper Drop
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-32 text-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
               <Calendar size={48} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">No current announcements</h2>
            <p className="text-gray-500 max-w-sm mx-auto">Check back soon for new rewards and updates!</p>
          </div>
        )}
      </div>
    </div>
  );
};
