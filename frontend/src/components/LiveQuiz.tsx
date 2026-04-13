import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { LiveQuizStateResponse, PracticeMarkResponse, questionsAPI } from '../services/api';

interface Subject {
  id: string;
  name: string;
  year: string;
}

export function LiveQuiz() {
  const [playerName, setPlayerName] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedYear, setSelectedYear] = useState('Year 1');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [codeInput, setCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [state, setState] = useState<LiveQuizStateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<PracticeMarkResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLimit, setTimeLimit] = useState(5);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const years = useMemo(() => Array.from(new Set(subjects.map((s) => s.year))).sort(), [subjects]);
  const filteredSubjects = useMemo(() => subjects.filter((s) => s.year === selectedYear), [subjects, selectedYear]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await questionsAPI.getSubjects();
        const list = Array.isArray(data.subjects) ? data.subjects : [];
        setSubjects(list);
        if (list[0]) {
          setSelectedYear(list[0].year);
          setSubject(list[0].id);
        }
      } catch {
        setError('Could not load subjects.');
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const first = filteredSubjects[0];
    if (first) setSubject(first.id);
  }, [selectedYear, filteredSubjects]);

  useEffect(() => {
    if (!roomCode) return;
    const poll = setInterval(async () => {
      try {
        const latest = await questionsAPI.getLiveQuizState(roomCode);
        setState(latest);
        
        // If we don't have a local result but the leaderboard says we submitted,
        // we should reflect that in the UI.
        const me = latest.leaderboard.find(p => p.player.toLowerCase() === playerName.toLowerCase());
        if (me?.submitted && !result) {
            // We can't easily reconstruct the full PracticeMarkResponse here 
            // without a dedicated endpoint, but we can at least disable the button
            // and show the percentage from the leaderboard.
            setResult({
                percentage: me.percentage,
                score_obtained: me.score,
                total_questions: latest.questions.length,
                results: [] 
            });
        }
      } catch {
        // keep quiet during polling
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [roomCode]);

  useEffect(() => {
    if (!state || result) {
      setTimeLeft(null);
      return;
    }
    
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const elapsed = now - state.created_at;
      const remaining = Math.max(0, (state.time_limit * 60) - elapsed);
      setTimeLeft(Math.floor(remaining));
      
      if (remaining <= 0 && !result && !loading) {
        clearInterval(timer);
        submitQuiz();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [state, result, loading]);

  const createRoom = async () => {
    setError('');
    if (!playerName.trim()) return setError('Enter your name first.');
    setLoading(true);
    try {
      const created = await questionsAPI.createLiveQuiz({
        player_name: playerName.trim(),
        subject,
        year: selectedYear,
        question_type: 'multiple_choice',
        num_questions: 5,
        difficulty_level: difficulty,
        time_limit: timeLimit,
      });
      setRoomCode(created.code);
      const latest = await questionsAPI.getLiveQuizState(created.code);
      setState(latest);
      setAnswers({});
      setResult(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to create room.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    setError('');
    if (!playerName.trim()) return setError('Enter your name first.');
    if (!codeInput.trim()) return setError('Enter quiz code.');
    setLoading(true);
    try {
      const code = codeInput.trim().toUpperCase();
      await questionsAPI.joinLiveQuiz(code, playerName.trim());
      setRoomCode(code);
      const latest = await questionsAPI.getLiveQuizState(code);
      setState(latest);
      setResult(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to join room.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!roomCode || !playerName.trim()) return;
    setLoading(true);
    try {
      const maxIndex = state?.questions.length || 0;
      const arr = Array.from({ length: maxIndex }, (_, i) => answers[i] || '');
      const submitted = await questionsAPI.submitLiveQuiz(roomCode, playerName.trim(), arr);
      setResult(submitted.result);
      // Immediately poll for the latest state to update leaderboard
      const latest = await questionsAPI.getLiveQuizState(roomCode);
      setState(latest);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to submit quiz.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`generator-section ${roomCode ? 'battle-mode-active' : ''}`}>
      {!roomCode ? (
        <>
          <div className="generator-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '2.5rem' }}>⚔️</div>
              <div>
                <h2>Quiz Challenge</h2>
                <p>Face off against your peers in a high-stakes, real-time competitive arena.</p>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-grid generator-panel" style={{ border: '1px solid var(--battle-primary)', background: 'linear-gradient(180deg, #fff, #f0f7ff)' }}>
            <div className="form-group">
              <label>Your Name</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Enter combatant name" />
            </div>
            <div className="form-group">
              <label>Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Time Limit (mins)</label>
              <input 
                type="number" 
                min="1" 
                max="60" 
                value={timeLimit} 
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 1)} 
              />
            </div>
          </div>

          <div className="battle-join-area" style={{ marginTop: '30px', textAlign: 'center' }}>
            <div style={{ marginBottom: '15px', fontSize: '0.9rem', opacity: 0.6, fontWeight: 600 }}>OR JOIN AN EXISTING BATTLE</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="PROMO CODE / ROOM CODE"
                className="minimal-code-input"
                />
                <button className="btn-secondary" onClick={joinRoom} disabled={loading} style={{ padding: '0 30px' }}>
                JOIN BATTLE
                </button>
            </div>
            
            <div style={{ margin: '30px 0', height: '1px', background: 'linear-gradient(90deg, transparent, #dbe4ef, transparent)' }} />
            
            <button className="btn-primary" onClick={createRoom} disabled={loading} style={{ background: 'var(--battle-primary)', padding: '16px 40px', fontSize: '1.1rem', borderRadius: '50px', boxShadow: '0 10px 20px rgba(59, 130, 246, 0.2)' }}>
                🚀 Host New Battle Arena
            </button>
          </div>
        </>
      ) : (
        <div className="battle-room">
          <div className="battle-hud">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>BATTLE CODE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--battle-primary)', letterSpacing: '4px' }}>{roomCode}</div>
                <button 
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(roomCode);
                    alert('Battle code copied to clipboard!');
                  }}
                  title="Copy Battle Code"
                >
                  📋
                </button>
              </div>
            </div>

            {timeLeft !== null && (
              <div className={`timer-pill ${timeLeft < 60 ? 'pulse-warning' : ''}`}>
                {timeLeft < 60 ? '⚠️ ' : '⏱️ '}
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}

            <button 
              className="btn-secondary" 
              onClick={() => { setRoomCode(''); setState(null); setResult(null); }}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              Exit Arena
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '20px' }}>
            <div className="questions-container">
              {state?.questions.map((q, idx) => (
                <div key={idx} className="glass-card" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--battle-primary)' }}>QUESTION {idx + 1}</span>
                    <span style={{ opacity: 0.6 }}>{q.question_type.replace('_', ' ')}</span>
                  </div>
                  <p style={{ fontSize: '1.1rem', marginBottom: '20px', lineHeight: 1.6 }}>{q.question_text}</p>
                  
                  {q.options ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isSelected = answers[idx] === opt;
                        return (
                          <div 
                            key={i} 
                            className={`battle-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => setAnswers(prev => ({ ...prev, [idx]: opt }))}
                          >
                            <span style={{ fontWeight: 800, color: isSelected ? '#fff' : 'var(--battle-primary)' }}>{letter}</span>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      className="glass-card"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', resize: 'none' }}
                      value={answers[idx] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                      placeholder="Type your strategic response..."
                    />
                  )}
                </div>
              ))}

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button 
                  className="btn-primary" 
                  onClick={submitQuiz} 
                  disabled={loading || !!result} 
                  style={{ width: '100%', maxWidth: '300px', padding: '15px', fontSize: '1.2rem' }}
                >
                  {loading ? 'Submitting...' : 'FINISH BATTLE'}
                </button>
                {result && (
                  <div className="glass-card" style={{ marginTop: '20px', border: '2px solid var(--ghana-green)', background: 'rgba(11, 122, 75, 0.1)' }}>
                    <h2 style={{ color: 'var(--ghana-green)', marginBottom: '5px' }}>BATTLE COMPLETE</h2>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>Performance: {result.percentage}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sidebar">
              <div className="glass-card">
                <h4 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>ARENA LEADERBOARD</h4>
                <div className="leaderboard-advanced">
                  {state?.leaderboard.map((row) => (
                    <div key={row.player} className="leaderboard-row" style={{ 
                      boxShadow: row.player.toLowerCase() === playerName.toLowerCase() ? '0 0 10px rgba(59, 130, 246, 0.3)' : 'none',
                      border: row.player.toLowerCase() === playerName.toLowerCase() ? '1px solid var(--battle-primary)' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {row.submitted ? '✅' : '⚔️'}
                        <strong>{row.player}</strong>
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--battle-primary)' }}>{row.submitted ? `${row.percentage}%` : '---'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveQuiz;
