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
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [codeInput, setCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [state, setState] = useState<LiveQuizStateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<PracticeMarkResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      } catch {
        // keep quiet during polling
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [roomCode]);

  const createRoom = async () => {
    setError('');
    if (!playerName.trim()) return setError('Enter your name first.');
    setLoading(true);
    try {
      const created = await questionsAPI.createLiveQuiz({
        player_name: playerName.trim(),
        subject,
        year: selectedYear,
        question_type: questionType,
        num_questions: 5,
        difficulty_level: difficulty,
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
    <div className="generator-section">
      <div className="generator-hero">
        <h2>Live Quiz Battle</h2>
        <p>Create a room, share the code, and quiz together in real time.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-grid generator-panel">
        <div className="form-group">
          <label>Your Name</label>
          <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Enter your name" />
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
          <label>Type</label>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="short_answer">Short Answer</option>
            <option value="essay">Essay</option>
            <option value="true_false">True/False</option>
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
      </div>

      <div className="practice-actions">
        <button className="btn-primary" onClick={createRoom} disabled={loading}>Create Live Quiz</button>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="Enter code"
          style={{ maxWidth: 160 }}
        />
        <button className="btn-secondary" onClick={joinRoom} disabled={loading}>Join</button>
        {roomCode && <span className="practice-score">Room Code: {roomCode}</span>}
      </div>

      {state && (
        <>
          <div className="question-card">
            <h4>Leaderboard</h4>
            {state.leaderboard.map((row) => (
              <p key={row.player}>
                <strong>{row.player}</strong>: {row.percentage}% {row.submitted ? '(submitted)' : '(in progress)'}
              </p>
            ))}
          </div>

          <div className="questions-list">
            {state.questions.map((q, idx) => (
              <div key={idx} className="question-card">
                <h4>Q{idx + 1}</h4>
                <p><strong>{q.question_text}</strong></p>
                {q.options && (
                  <div className="options">
                    {q.options.map((opt, i) => <p key={i} className="option">{String.fromCharCode(65 + i)}. {opt}</p>)}
                  </div>
                )}
                {q.options ? (
                  <select
                    value={answers[idx] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                  >
                    <option value="">Select answer</option>
                    {q.options.map((opt, i) => <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>)}
                  </select>
                ) : (
                  <textarea
                    rows={3}
                    value={answers[idx] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="Type answer"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="practice-actions">
            <button className="btn-primary" onClick={submitQuiz} disabled={loading}>Submit Quiz</button>
            {result && <span className="practice-score">Your Score: {result.percentage}%</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default LiveQuiz;
