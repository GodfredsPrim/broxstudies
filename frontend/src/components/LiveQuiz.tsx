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
  const [semester, setSemester] = useState('all_year');

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
    if (first && !filteredSubjects.some(s => s.id === subject)) setSubject(first.id);
  }, [selectedYear, filteredSubjects, subject]);

  useEffect(() => {
    if (!roomCode) return;
    const poll = setInterval(async () => {
      try {
        const latest = await questionsAPI.getLiveQuizState(roomCode);
        setState(latest);
        
        const me = latest.leaderboard.find(p => p.player.toLowerCase() === playerName.toLowerCase());
        if (me?.submitted && !result) {
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
  }, [roomCode, playerName, result]);

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
        semester,
      });
      setRoomCode(created.code);
      const latest = await questionsAPI.getLiveQuizState(created.code);
      setState(latest);
      setAnswers({});
      setResult(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to create quiz room.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    setError('');
    if (!playerName.trim()) return setError('Enter your name first.');
    if (!codeInput.trim()) return setError('Enter the room code.');
    setLoading(true);
    try {
      const code = codeInput.trim().toUpperCase();
      await questionsAPI.joinLiveQuiz(code, playerName.trim());
      setRoomCode(code);
      const latest = await questionsAPI.getLiveQuizState(code);
      setState(latest);
      setResult(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to join quiz room.';
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
      const latest = await questionsAPI.getLiveQuizState(roomCode);
      setState(latest);

      // Save to global history for leaderboard points
      try {
        await questionsAPI.saveExamHistory({
          exam_type: 'challenge_quiz',
          subject: subject,
          score_obtained: submitted.result.score_obtained,
          total_questions: submitted.result.total_questions,
          percentage: submitted.result.percentage,
          details_json: JSON.stringify(submitted.result.results || [])
        });
      } catch (historyErr) {
        console.warn('Failed to save challenge history:', historyErr);
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to submit quiz score.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  return (
    <div className={`generator-section ${roomCode ? 'quiz-active' : ''}`}>
      {!roomCode ? (
        <>
          <div className="generator-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' }}>⚡</div>
              <div>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Challenge Quiz</h2>
                <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>Join or host a real-time practice session with other students.</p>
              </div>
            </div>
          </div>

          {error && <div className="error-message" style={{ margin: '20px auto', maxWidth: '800px' }}>⚠️ {error}</div>}

          <div className="form-grid generator-panel" style={{ 
            border: '1px solid #e2e8f0', 
            background: 'white',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
            borderRadius: '24px',
            padding: '40px'
          }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Your Name</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Enter your display name..." style={{ fontSize: '1.2rem', padding: '15px' }} />
            </div>
            <div className="form-group">
              <label>Academic Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name.replace(/_/g, ' ')}</option>)}
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
                type="number" min="1" max="60" 
                value={timeLimit} 
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 1)} 
              />
            </div>
            <div className="form-group">
              <label>Semester Selection</label>
              <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="all_year">Full Year (Recommended)</option>
                <option value="semester_1">First Semester (Sem 1)</option>
                <option value="semester_2">Second Semester (Sem 2)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '20px', fontSize: '0.85rem', color: '#64748b', fontWeight: 800, letterSpacing: '1px' }}>JOIN EXISTING ROOM</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', maxWidth: '500px', margin: '0 auto' }}>
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  style={{ textAlign: 'center', fontSize: '1.2rem', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%' }}
                />
                <button className="btn-secondary" onClick={joinRoom} disabled={loading} style={{ padding: '0 40px', fontSize: '1.1rem', borderRadius: '12px' }}>
                  JOIN
                </button>
            </div>
            
            <div style={{ margin: '40px 0', height: '1px', background: '#e2e8f0' }} />
            
            <button className="btn-primary" onClick={createRoom} disabled={loading} style={{ background: '#0f172a', color: 'white', padding: '18px 60px', fontSize: '1.2rem', borderRadius: '16px', fontWeight: 700 }}>
               Host New Room
            </button>
          </div>
        </>
      ) : (
        <div className="quiz-room-active" style={{ padding: '20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#0f172a', padding: '25px', borderRadius: '24px', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>ROOM CODE</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '4px' }}>{roomCode}</div>
              <button 
                onClick={() => { navigator.clipboard.writeText(roomCode); alert('Room code copied!'); }}
                style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                📋
              </button>
            </div>

            {timeLeft !== null && (
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: timeLeft < 60 ? '#ef4444' : 'white' }}>
                ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}

            <button 
              className="btn-secondary" 
              onClick={() => { setRoomCode(''); setState(null); setResult(null); }}
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 20px', borderRadius: '12px' }}
            >
              Leave Room
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '30px' }}>
            <div className="questions-container">
              {state?.questions.map((q, idx) => (
                <div key={idx} style={{ marginBottom: '25px', padding: '35px', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                    <span style={{ fontWeight: 800, color: '#3b82f6', fontSize: '1rem' }}>QUESTION {idx + 1}</span>
                  </div>
                  <p style={{ fontSize: '1.25rem', marginBottom: '30px', lineHeight: 1.6, color: '#0f172a', fontWeight: 500 }}>{q.question_text}</p>
                  
                  {q.options ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      {q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isSelected = answers[idx] === opt;
                        return (
                          <div 
                            key={i} 
                            style={{ 
                                padding: '18px',
                                borderRadius: '16px',
                                border: '2px solid',
                                borderColor: isSelected ? '#3b82f6' : '#f1f5f9',
                                background: isSelected ? '#eff6ff' : '#f8fafc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px'
                            }}
                            onClick={() => setAnswers(prev => ({ ...prev, [idx]: opt }))}
                          >
                            <span style={{ 
                              fontWeight: 800, 
                              color: isSelected ? 'white' : '#3b82f6',
                              background: isSelected ? '#3b82f6' : 'white',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              border: isSelected ? 'none' : '1px solid #e2e8f0'
                            }}>{letter}</span>
                            <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', fontSize: '1.1rem' }}
                      value={answers[idx] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                      placeholder="Type your answer here..."
                    />
                  )}
                </div>
              ))}

              <div style={{ margin: '40px 0', textAlign: 'center' }}>
                {!result && (
                  <button 
                    onClick={submitQuiz} 
                    disabled={loading} 
                    style={{ width: '100%', maxWidth: '400px', padding: '20px', fontSize: '1.3rem', borderRadius: '16px', background: '#3b82f6', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    {loading ? 'Submitting...' : 'Submit Final Answers'}
                  </button>
                )}
                {result && (
                  <div style={{ marginTop: '30px', border: '2px solid #10b981', background: '#ecfdf5', padding: '40px', borderRadius: '32px' }}>
                    <h2 style={{ color: '#047857', marginBottom: '10px', fontSize: '2rem', fontWeight: 800 }}>Quiz Complete</h2>
                    <p style={{ color: '#064e3b', opacity: 0.8, fontSize: '1.1rem' }}>Your final score is</p>
                    <p style={{ fontSize: '5rem', fontWeight: 900, color: '#047857', margin: '10px 0' }}>{result.percentage}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sidebar">
              <div style={{ position: 'sticky', top: '20px', background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>LIVE LEADERBOARD</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {state?.leaderboard.map((row, idx) => {
                    const isMe = row.player.toLowerCase() === playerName.toLowerCase();
                    return (
                      <div key={row.player} style={{ 
                        padding: '15px',
                        borderRadius: '12px',
                        background: isMe ? '#eff6ff' : '#f8fafc',
                        border: '1px solid',
                        borderColor: isMe ? '#3b82f6' : '#e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.2rem' }}>{getRankBadge(idx)}</span>
                          <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{row.player}</strong>
                        </div>
                        <div style={{ fontWeight: 800, color: row.submitted ? '#10b981' : '#94a3b8' }}>
                          {row.submitted ? `${row.percentage}%` : '...'}
                        </div>
                      </div>
                    );
                  })}
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
