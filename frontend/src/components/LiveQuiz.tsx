import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Zap,
  Search,
  Copy,
  CheckCircle2,
  Play,
  LogOut,
  User,
  BarChart3,
  Timer
} from 'lucide-react';
import { LiveQuizStateResponse, PracticeMarkResponse, questionsAPI } from '../services/api';
import MathRenderer from './MathRenderer';

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

  const years = useMemo(() => {
    const y = Array.from(new Set(subjects.map((s) => s.year))).sort();
    if (y.length > 0 && !y.includes('Year 3')) y.push('Year 3');
    return y;
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    if (selectedYear === 'Year 3') {
      return Array.from(new Map(subjects.map(s => [s.name, s])).values());
    }
    return subjects.filter((s) => s.year === selectedYear);
  }, [subjects, selectedYear]);

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


  return (
    <div className={`generator-shell ${roomCode ? 'generator-shell--simulating' : ''}`}>
      {!roomCode ? (
        <>
          <div className="generator-header">
            <div className="generator-header__content">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Zap size={32} />
                </div>
                <div>
                  <h2 className="generator-title">Challenge Quiz</h2>
                  <p className="generator-subtitle">Join or host a real-time practice session with other students.</p>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="error-message" style={{ margin: '20px auto', maxWidth: '800px' }}>⚠️ {error}</div>}

          <div className="generator-form glass-card">
            <div className="generator-form-grid">
              <div className="form-group col-span-full">
                <label>Display Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    value={playerName} 
                    onChange={(e) => setPlayerName(e.target.value)} 
                    placeholder="Enter your display name..." 
                    className="pl-12"
                  />
                </div>
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
              <div className="form-group col-span-full">
                <label>Semester Selection</label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                  <option value="all_year">Full Year (Recommended)</option>
                  <option value="semester_1">First Semester (Sem 1)</option>
                  <option value="semester_2">Second Semester (Sem 2)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-12 p-10 glass-card text-center border-2 border-dashed border-gray-200">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Join Existing Room</div>
            <div className="flex flex-col md:flex-row justify-center gap-4 max-w-xl mx-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="ENTER ROOM CODE"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none text-center font-black tracking-widest text-xl transition-all"
                  />
                </div>
                <button className="generator-btn generator-btn--primary px-10" onClick={joinRoom} disabled={loading}>
                  JOIN
                </button>
            </div>
            
            <div className="flex items-center gap-6 my-10">
              <div className="h-px bg-gray-100 flex-1" />
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">OR</span>
              <div className="h-px bg-gray-100 flex-1" />
            </div>
            
            <button className="w-full md:w-auto px-12 py-5 rounded-2xl bg-gray-900 text-white font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-500/20" onClick={createRoom} disabled={loading}>
               <Play size={24} fill="currentColor" /> Host New Room
            </button>
          </div>
        </>
      ) : (
        <div className="animate-fade-in">
          <div className="sim-exit-bar glass-card">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Room</span>
                <span className="text-xl font-black tracking-widest">{roomCode}</span>
                <button 
                  onClick={() => { navigator.clipboard.writeText(roomCode); alert('Room code copied!'); }}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {timeLeft !== null && (
                <div className={`flex items-center gap-2 font-black px-4 py-2 rounded-full border ${timeLeft < 60 ? 'text-red-500 bg-red-50 border-red-200 animate-pulse' : 'text-gray-300'}`}>
                  <Timer size={18} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              )}

              <button 
                className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-100"
                onClick={() => { setRoomCode(''); setState(null); setResult(null); }}
                title="Leave Room"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
            <div className="lg:col-span-8 space-y-8">
              {state?.questions.map((q, idx) => (
                <div key={idx} className="question-card glass-card">
                  <div className="question-card__header">
                    <span className="question-card__number">Question {idx + 1}</span>
                    <span className="question-card__type">Multiple Choice</span>
                  </div>
                  
                  <div className="question-card__body">
                    <div className="question-card__text text-xl font-bold mb-8">
                      <MathRenderer text={q.question_text} />
                    </div>
                    
                    {q.options ? (
                      <div className="options-grid">
                        {q.options.map((opt, i) => {
                          const letter = String.fromCharCode(65 + i);
                          const isSelected = answers[idx] === opt;
                          const cleanedOpt = opt.replace(/^(Option\s+[A-D][:.]\s*|[A-D][:.]\s*)/i, '').trim();
                          return (
                            <label key={i} className={`option-item ${isSelected ? 'option-item--selected' : ''}`}>
                              <input 
                                type="radio" 
                                name={`quiz-q-${idx}`}
                                checked={isSelected}
                                onChange={() => setAnswers(prev => ({ ...prev, [idx]: opt }))}
                                className="hidden-radio"
                              />
                              <span className="option-letter">{letter}</span>
                              <span className="option-text"><MathRenderer text={cleanedOpt} /></span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea
                        rows={4}
                        className="essay-input"
                        value={answers[idx] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Type your answer here..."
                      />
                    )}
                  </div>
                </div>
              ))}

              <div className="py-12">
                {!result && (
                  <button 
                    onClick={submitQuiz} 
                    disabled={loading} 
                    className="w-full max-w-md mx-auto generator-btn generator-btn--primary py-5 text-xl"
                  >
                    {loading ? 'Submitting...' : <><CheckCircle2 size={24} /> Submit Final Answers</>}
                  </button>
                )}
                {result && (
                  <div className="generator-result glass-card animate-scale-up">
                    <div className="result-aura" />
                    <div className="result-content">
                      <span className="result-label">Quiz Complete</span>
                      <h1 className="result-percentage">{result.percentage}%</h1>
                      <p className="result-summary">Score: <strong>{result.score_obtained}</strong> / {result.total_questions}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-24 space-y-6">
                <div className="glass-card p-6">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BarChart3 size={16} /> Live Leaderboard
                  </h4>
                  <div className="space-y-3">
                    {state?.leaderboard.map((row, idx) => {
                      const isMe = row.player.toLowerCase() === playerName.toLowerCase();
                      const isTop3 = idx < 3;
                      return (
                        <div key={row.player} className={`flex justify-between items-center p-4 rounded-2xl transition-all ${
                          isMe ? 'bg-blue-50 border border-blue-100 shadow-sm' : 'bg-gray-50 border border-transparent'
                        }`}>
                          <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                              isTop3 ? 'bg-blue-500 text-white' : 'bg-white text-gray-400'
                            }`}>
                              {idx + 1}
                            </span>
                            <strong className={`font-bold ${isMe ? 'text-blue-600' : 'text-gray-900'}`}>{row.player}</strong>
                          </div>
                          <div className={`font-black ${row.submitted ? 'text-ghana-green' : 'text-gray-300 animate-pulse'}`}>
                            {row.submitted ? `${row.percentage}%` : 'Solving...'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
