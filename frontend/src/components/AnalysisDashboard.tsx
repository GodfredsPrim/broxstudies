import { useState, useEffect } from 'react';
import axios from 'axios';
import { questionsAPI, Question } from '../services/api';

interface Subject {
  id: string;
  name: string;
  year: string;
}

export function AnalysisDashboard() {
  const [subject, setSubject] = useState('mathematics');
  const [selectedYear, setSelectedYear] = useState('Year 1');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState('');
  const [mockTimeLimit, setMockTimeLimit] = useState(120); // Default 120 minutes for full paper
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const availableYears = Array.from(new Set(subjects.map((s) => s.year))).sort();
  const filteredSubjects = subjects.filter((s) => s.year === selectedYear);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const data = await questionsAPI.getSubjects();
        const subjectList = data.subjects || [];
        setSubjects(Array.isArray(subjectList) ? subjectList : []);
        if (Array.isArray(subjectList) && subjectList.length > 0) {
          const firstYear = subjectList.find((s: Subject) => s.year === 'Year 1')?.year || subjectList[0].year;
          setSelectedYear(firstYear);
          const firstForYear = subjectList.find((s: Subject) => s.year === firstYear);
          if (firstForYear) {
            setSubject(firstForYear.id);
          }
        }
        setError('');
      } catch (error) {
        console.error('Error fetching subjects:', error);
        setError('Could not load subjects.');
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (!subjects.length) return;
    const firstForYear = subjects.find((s) => s.year === selectedYear);
    if (firstForYear) {
      setSubject(firstForYear.id);
    }
  }, [selectedYear, subjects]);

  const handleGenerate = async () => {
    if (!subject) {
      alert('Please select a subject');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Standard type is hardcoded here for "Likely WASSCE Questions"
      const result = await questionsAPI.generateQuestions(
        subject,
        selectedYear,
        'standard',
        46, // 40 MCQ + 6 Theory
        'medium'
      );
      setQuestions(result.questions);
      setShowAnswers(false);
      setStudentAnswers({});
      setExamResult(null);
    } catch (error) {
      console.error('Error generating questions:', error);
      const backendMessage = axios.isAxiosError(error)
        ? (error.response?.data?.detail || error.message)
        : 'Failed to generate paper.';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const startSimulation = () => {
    setIsSimulating(true);
    setStudentAnswers({});
    setExamResult(null);
    setShowAnswers(false);
    setTimeLeft(mockTimeLimit * 60);
    setTimerActive(true);
    
    try {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request denied:', err);
      });
    } catch (e) {
      console.warn('Fullscreen API error:', e);
    }
  };

  const stopSimulation = () => {
    setTimerActive(false);
    setTimeLeft(null);
    setIsSimulating(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  const submitExamGrading = async () => {
    setIsSubmitting(true);
    try {
      const items = questions.map((q, i) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        options: q.options,
        student_answer: studentAnswers[i] || '',
      }));
      
      const res = await questionsAPI.markPractice(items, 'simulation_user', subject);
      setExamResult(res);
      setShowAnswers(true);
    } catch (err) {
      console.error('Error marking practice:', err);
      alert('Error submitting exam for grading.');
    } finally {
      setIsSubmitting(false);
      stopSimulation();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isSimulating && !document.fullscreenElement && !examResult) {
        alert('Restricted mode violation: Fullscreen exited. Auto-submitting exam now.');
        submitExamGrading();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isSimulating, studentAnswers, examResult]);

  useEffect(() => {
    let interval: any;
    if (timerActive && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev !== null && prev <= 1) {
            clearInterval(interval);
            submitExamGrading();
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const mcqQuestions = questions.filter(q => q.question_type === 'multiple_choice');
  const theoryQuestions = questions.filter(q => q.question_type === 'essay' || q.question_type === 'short_answer');

  const renderQuestionCard = (q: Question, globalIndex: number, labelPrefix: string) => (
    <div key={`q-${globalIndex}`} className="question-card" style={{ padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px', marginBottom: '15px', background: '#fff' }}>
      <h4 style={{ color: '#0b7a4b', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>{labelPrefix}</h4>
      <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem' }}><strong>{q.question_text}</strong></p>

      <div className="interactive-answer">
        {q.options && q.options.length > 0 ? (
          <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              return (
                <label key={i} className="option" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', background: studentAnswers[globalIndex] === letter ? '#e6f7ff' : '#f9f9f9', borderRadius: '6px', border: studentAnswers[globalIndex] === letter ? '1px solid #1890ff' : '1px solid transparent' }}>
                  <input 
                    type="radio" 
                    name={`hall-question-${globalIndex}`} 
                    value={letter}
                    checked={studentAnswers[globalIndex] === letter}
                    onChange={(e) => setStudentAnswers(prev => ({ ...prev, [globalIndex]: e.target.value }))}
                  />
                  <span>{letter}. {opt}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <textarea
            placeholder="Type your detailed answer here... (Show all workings for sub-parts like (a)(i), (b))"
            rows={8}
            style={{ width: '100%', marginTop: '15px', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontFamily: 'inherit', fontSize: '1rem' }}
            value={studentAnswers[globalIndex] || ''}
            onChange={(e) => setStudentAnswers(prev => ({ ...prev, [globalIndex]: e.target.value }))}
          />
        )}
      </div>

      {showAnswers && (
        <div className="answer-section" style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '6px', borderLeft: '4px solid #10b981' }}>
          {examResult && examResult.results[globalIndex] && (
            <div style={{ marginBottom: '10px', padding: '8px', background: examResult.results[globalIndex].is_correct ? '#d1fae5' : '#fee2e2', borderRadius: '4px' }}>
              <strong>Score:</strong> {examResult.results[globalIndex].score * 100}% | <strong>Feedback:</strong> {examResult.results[globalIndex].feedback}
            </div>
          )}
          <p><strong>Expected Answer/Rubric:</strong> {q.correct_answer || 'See explanation'}</p>
          <p><strong>Explanation:</strong> {q.explanation}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`analysis-section ${isSimulating ? 'simulating' : ''}`} style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {!isSimulating && (
        <div className="generator-hero">
          <h2>Likely WASSCE Questions: Full Paper Hall</h2>
          <p>Generate and solve complete 40-MCQ + 6-Theory WASSCE examination papers under strict simulation.</p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {isSimulating ? (
        <div className="sim-exit-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#101923', color: '#fff', padding: '15px 25px', borderRadius: '8px', position: 'sticky', top: 0, zIndex: 1000, marginBottom: '20px' }}>
          <span><strong>📋 Subject:</strong> {subjects.find(s => s.id === subject)?.name}</span>
          <span><strong>Progress:</strong> {Object.keys(studentAnswers).length} / {questions.length}</span>
          {timeLeft !== null && (
            <span style={{ fontWeight: 'bold', color: timeLeft < 300 ? '#ff4d4f' : '#fff' }}>
              ⏱️ Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}
          <button onClick={submitExamGrading} disabled={isSubmitting} className="btn-primary" style={{ background: '#52c41a', border: 'none' }}>
            {isSubmitting ? 'Grading...' : '✅ Submit Paper'}
          </button>
        </div>
      ) : (
        <>
          <div className="form-grid generator-panel" style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #dbe4ef', marginBottom: '20px' }}>
            <div className="form-group">
              <label>Select Year:</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Select Subject:</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Time Limit (mins):</label>
              <input type="number" value={mockTimeLimit} onChange={(e) => setMockTimeLimit(parseInt(e.target.value) || 1)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
            <button onClick={handleGenerate} disabled={loading} className="btn-primary" style={{ flex: 1, padding: '15px' }}>
              {loading ? '📄 Constructing Full Paper...' : '📑 Generate Full WASSCE Paper'}
            </button>
            {questions.length > 0 && (
              <button onClick={startSimulation} className="btn-secondary" style={{ flex: 1, background: '#101923' }}>
                🔒 Start Exam (Restricted)
              </button>
            )}
          </div>
        </>
      )}

      {examResult && !isSimulating && (
        <div className="exam-results-card" style={{ background: 'linear-gradient(135deg, #0b7a4b, #10a261)', color: 'white', padding: '30px', borderRadius: '15px', marginBottom: '30px', textAlign: 'center', boxShadow: '0 10px 25px rgba(11, 122, 75, 0.3)' }}>
          <h2 style={{ color: '#fff' }}>Simulation Official Result</h2>
          <h1 style={{ fontSize: '4rem', margin: '10px 0' }}>{examResult.percentage}%</h1>
          <p style={{ fontSize: '1.2rem' }}>Answered {examResult.total_questions} questions | Score: {examResult.score_obtained}</p>
          <p style={{ marginTop: '15px', opacity: 0.9 }}>Review your answers below to learn from mistakes.</p>
        </div>
      )}

      <div className="questions-list">
        {questions.length > 0 && (
          <>
            <h3 style={{ marginTop: '2rem', background: '#f0f4f8', padding: '10px 15px', borderRadius: '8px' }}>SECTION A: OBJECTIVE (40 QUESTIONS)</h3>
            {mcqQuestions.map((q, i) => renderQuestionCard(q, questions.indexOf(q), `Question ${i + 1}`))}
            
            <h3 style={{ marginTop: '3rem', background: '#f0f4f8', padding: '10px 15px', borderRadius: '8px' }}>SECTION B: THEORY (6 QUESTIONS)</h3>
            {theoryQuestions.map((q, i) => renderQuestionCard(q, questions.indexOf(q), `Question ${i + 1} (Theory)`))}
          </>
        )}
      </div>
    </div>
  );
}
