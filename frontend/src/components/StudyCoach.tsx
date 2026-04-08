import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { GeneratedQuestions, PracticeMarkResponse, Question, questionsAPI } from '../services/api';

interface Subject {
  id: string;
  name: string;
  year: string;
}

export function StudyCoach() {
  const [studentId, setStudentId] = useState('student_demo');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedYear, setSelectedYear] = useState('Year 1');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<GeneratedQuestions | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<PracticeMarkResponse | null>(null);
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [recommendedDifficulty, setRecommendedDifficulty] = useState('medium');
  const [resourceStatusText, setResourceStatusText] = useState('');
  const [prepProgress, setPrepProgress] = useState(0);

  const years = useMemo(() => Array.from(new Set(subjects.map((s) => s.year))).sort(), [subjects]);
  const filteredSubjects = useMemo(() => subjects.filter((s) => s.year === selectedYear), [subjects, selectedYear]);
  const currentQuestion: Question | undefined = session?.questions[currentIndex];

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await questionsAPI.getSubjects();
        const list = Array.isArray(data.subjects) ? data.subjects : [];
        setSubjects(list);
        const first = list[0];
        if (first) {
          setSelectedYear(first.year);
          setSubject(first.id);
        }
      } catch {
        setError('Unable to load subjects for study session.');
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const first = filteredSubjects[0];
    if (first) setSubject(first.id);
  }, [selectedYear, filteredSubjects]);

  const startSession = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setResourceStatusText('Checking subject resources...');
    setPrepProgress(8);
    const progressTimer = setInterval(() => {
      setPrepProgress((prev) => (prev < 92 ? prev + 6 : prev));
    }, 600);
    try {
      const status = await questionsAPI.getResourceStatus(selectedYear, subject);
      const statusSummary = Object.entries(status.status)
        .map(([k, v]) => `${k}: ${v.cached ? 'cached' : 'not cached'}`)
        .join(' | ');
      setResourceStatusText(statusSummary);

      const targetDifficulty = adaptiveMode ? recommendedDifficulty : difficulty;
      const generated = await questionsAPI.generateQuestions(subject, selectedYear, questionType, 5, targetDifficulty);
      setSession(generated);
      setCurrentIndex(0);
      setAnswers({});
      setPrepProgress(100);
      const fetchSummary = generated.source_details?.fetch_summary;
      if (fetchSummary) {
        setResourceStatusText(
          `Download check -> downloaded: ${fetchSummary.downloaded ?? 0}, cached: ${fetchSummary.existing ?? 0}, failed: ${fetchSummary.failed ?? 0}`
        );
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to start session.';
      setError(msg);
    } finally {
      clearInterval(progressTimer);
      setLoading(false);
      setTimeout(() => setPrepProgress(0), 700);
    }
  };

  const submitAndMark = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const payload = session.questions.map((q, idx) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        options: q.options,
        student_answer: answers[idx] || '',
      }));
      const subjectKey = subject.includes(':') ? subject.split(':', 2)[1] : subject;
      const marked = await questionsAPI.markPractice(payload, studentId.trim() || 'anonymous', subjectKey);
      setResult(marked);
      if (adaptiveMode) {
        const pct = marked.percentage;
        if (pct >= 80) setRecommendedDifficulty('hard');
        else if (pct >= 55) setRecommendedDifficulty('medium');
        else setRecommendedDifficulty('easy');
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to mark practice.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getMarked = (index: number) => result?.results.find((r) => r.index === index);

  return (
    <div className="generator-section">
      <div className="generator-hero">
        <h2>Study With AI Coach</h2>
        <p>Start a guided session, answer each question, and get instant AI marking.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-grid generator-panel">
        <div className="form-group">
          <label>Student ID</label>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. student_001"
          />
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
          <label>Question Type</label>
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
        <div className="form-group">
          <label>Study Mode</label>
          <select
            value={adaptiveMode ? 'adaptive' : 'manual'}
            onChange={(e) => setAdaptiveMode(e.target.value === 'adaptive')}
          >
            <option value="adaptive">Adaptive (Recommended)</option>
            <option value="manual">Manual</option>
          </select>
          {adaptiveMode && (
            <small style={{ color: '#555' }}>Recommended difficulty: {recommendedDifficulty}</small>
          )}
        </div>
      </div>

      <div className="practice-actions">
        <button className="btn-primary" onClick={startSession} disabled={loading || !subject}>
          {loading ? 'Preparing...' : 'Start Study Session'}
        </button>
        {session && (
          <button className="btn-secondary" onClick={submitAndMark} disabled={loading}>
            {loading ? 'Marking...' : 'Mark My Session'}
          </button>
        )}
        {result && (
          <span className="practice-score">
            Score: {result.score_obtained}/{result.total_questions} ({result.percentage}%)
          </span>
        )}
      </div>
      {loading && prepProgress > 0 && (
        <div className="prep-progress">
          <div className="prep-progress__bar" style={{ width: `${prepProgress}%` }} />
        </div>
      )}
      {resourceStatusText && <div className="info">{resourceStatusText}</div>}

      {session && currentQuestion && (
        <div className="question-card">
          <h4>Practice Question {currentIndex + 1} of {session.questions.length}</h4>
          <p><strong>{currentQuestion.question_text}</strong></p>

          {currentQuestion.options && (
            <div className="options">
              {currentQuestion.options.map((opt, i) => (
                <p className="option" key={i}>{String.fromCharCode(65 + i)}. {opt}</p>
              ))}
            </div>
          )}

          <div className="practice-input">
            <label><strong>Your Answer</strong></label>
            {currentQuestion.options ? (
              <select
                value={answers[currentIndex] || ''}
                onChange={(e) => setAnswers((p) => ({ ...p, [currentIndex]: e.target.value }))}
              >
                <option value="">Select answer</option>
                {currentQuestion.options.map((opt, i) => (
                  <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>
                ))}
              </select>
            ) : (
              <textarea
                rows={4}
                value={answers[currentIndex] || ''}
                onChange={(e) => setAnswers((p) => ({ ...p, [currentIndex]: e.target.value }))}
                placeholder="Type your answer here..."
              />
            )}
          </div>

          {getMarked(currentIndex) && (
            <div className={`marking-feedback ${getMarked(currentIndex)?.is_correct ? 'correct' : 'incorrect'}`}>
              <p><strong>AI Feedback:</strong> {getMarked(currentIndex)?.feedback}</p>
              <p><strong>Expected:</strong> {getMarked(currentIndex)?.expected_answer}</p>
            </div>
          )}

          <div className="practice-actions">
            <button
              className="btn-secondary"
              onClick={() => setCurrentIndex((v) => Math.max(0, v - 1))}
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              onClick={() => setCurrentIndex((v) => Math.min((session.questions.length - 1), v + 1))}
              disabled={currentIndex >= session.questions.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyCoach;
