import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Star, TrendingUp, Users } from 'lucide-react';
import { adminAPI, type LeaderboardEntry } from '../services/api';

export const GlobalLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await adminAPI.getLeaderboard();
        setLeaderboard(data);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>🥇 Calculating Rankings...</div>;

  return (
    <div className="generator-shell">
      <header className="generator-header">
        <div className="generator-header__content">
          <h1 className="generator-title">Global Hall of Fame</h1>
          <p className="generator-subtitle">The top performing students in Ghana based on all-time practice scores.</p>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold text-gray-500 bg-gray-100/50 px-4 py-2 rounded-full border border-gray-200">
           <Users size={16} /> {leaderboard.length} Ranked
        </div>
      </header>

      <div className="grid gap-4 max-w-3xl mx-auto">
        {leaderboard.map((entry) => {
          const isTop3 = entry.rank <= 3;
          const rankColors = {
            1: 'bg-yellow-400 text-white shadow-yellow-200',
            2: 'bg-slate-400 text-white shadow-slate-200',
            3: 'bg-amber-600 text-white shadow-amber-200'
          };

          return (
            <div 
              key={entry.rank} 
              className={`group glass-card p-5 flex justify-between items-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                entry.rank === 1 ? 'border-yellow-400/50 bg-yellow-50/10' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transform group-hover:rotate-12 transition-transform ${
                  isTop3 ? rankColors[entry.rank as 1|2|3] : 'bg-gray-900 text-white shadow-gray-200'
                }`}>
                  {entry.rank === 1 ? <Crown size={20} /> : entry.rank}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-gray-900">{entry.player_name}</span>
                    {entry.is_online && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ghana-green opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-ghana-green"></span>
                      </span>
                    )}
                  </div>
                  {entry.rank === 1 && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-yellow-600 uppercase tracking-widest mt-0.5">
                      <Star size={10} fill="currentColor" /> Grand Champion
                    </span>
                  )}
                  {isTop3 && entry.rank > 1 && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                      <Medal size={10} /> Top Tier
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end text-2xl font-black text-gray-900">
                  <TrendingUp size={18} className="text-ghana-green" />
                  {entry.total_points.toLocaleString()}
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Points</div>
              </div>
            </div>
          );
        })}

        {leaderboard.length === 0 && (
          <div className="py-32 text-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
               <Trophy size={48} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No rankings yet</h2>
            <p className="text-gray-500">Start practicing to get on the board!</p>
          </div>
        )}
      </div>
    </div>
  );
};
