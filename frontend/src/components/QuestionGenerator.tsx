import { useState, useEffect } from 'react';
import axios from 'axios';
import { questionsAPI, Question, GeneratedQuestions } from '../services/api';

interface Subject {
  id: string;
  name: string;
  year: string;
}

interface ExamHistoryEntry {
  id: number;
  exam_type: string;
  subject: string;
  score_obtained: number;
  total_questions: number;
  percentage: number;
  created_at: string;
  details_json?: string;
}

interface QuestionGeneratorProps {
  onSimulationToggle?: (active: boolean) => void;
  isSimulating?: boolean;
  showHistoryOnly?: boolean;
}

export function QuestionGenerator({ onSimulationToggle, isSimulating, showHistoryOnly = false }: QuestionGeneratorProps) {
  const [subject, setSubject] = useState('mathematics');
  const [selectedYear, setSelectedYear] = useState('Year 1');
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isPrintAnswerSheet, setIsPrintAnswerSheet] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [generationMeta, setGenerationMeta] = useState<GeneratedQuestions | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState('');
  const [mockTimeLimit, setMockTimeLimit] = useState(30); 
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>([]);
  const [semester, setSemester] = useState('all_year');

  const availableYears = Array.from(new Set(subjects.map((s) => s.year))).sort();
  // Ensure Year 3 is included if it exists
  const filteredSubjects = subjects.filter((s) => s.year === selectedYear);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
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
        
        try {
          const hist = await questionsAPI.getExamHistory();
          setExamHistory(hist.filter((h: any) => h.exam_type === 'practice_generator').reverse());
        } catch(e) {}
        
      } catch (error) {
        console.error('Error fetching subjects:', error);
        setError('Could not load subjects. Backend may still be loading or unavailable.');
        setTimeout(() => {
          fetchSubjects();
        }, 5000);
      } finally {
        setLoadingSubjects(false);
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
    setQuestions([]);
    setExamResult(null);
    setStudentAnswers({});

    try {
      const result = await questionsAPI.generateQuestions(
        subject,
        selectedYear,
        questionType,
        numQuestions,
        difficulty,
        [],
        semester
      );
      setQuestions(result.questions);
      setGenerationTime(result.generation_time);
      setGenerationMeta(result);
      setShowAnswers(false);
      setIsPrintAnswerSheet(false);
    } catch (error) {
      console.error('Error generating questions:', error);
      const backendMessage = axios.isAxiosError(error)
        ? (error.response?.data?.detail || error.message)
        : 'Failed to generate questions. Please try again.';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const startSimulation = async () => {
    if (questions.length === 0) {
      await handleGenerate();
    }
    if (onSimulationToggle) {
      onSimulationToggle(true);
    }
    setTimeLeft(mockTimeLimit * 60);
    setTimerActive(true);
    
    // Trigger fullscreen
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    }
  };

  const handleStudentAnswerChange = (index: number, val: string) => {
    setStudentAnswers(prev => ({ ...prev, [index]: val }));
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
      
      try {
        await questionsAPI.saveExamHistory({
          exam_type: 'practice_generator',
          subject: subject,
          score_obtained: res.score_obtained,
          total_questions: res.total_questions,
          percentage: res.percentage,
          details_json: JSON.stringify(res.results)
        });
        // Refresh local history
        const hist = await questionsAPI.getExamHistory();
        setExamHistory(hist.filter((h: any) => h.exam_type === 'practice_generator').reverse());
      } catch(e) {}
    } catch (err) {
      console.error('Error marking practice:', err);
      alert('Error submitting exam for grading.');
    } finally {
      setIsSubmitting(false);
      setTimerActive(false);
      setTimeLeft(null);
      stopSimulation(); 
    }
  };

  const stopSimulation = () => {
    setTimerActive(false);
    setTimeLeft(null);
    if (onSimulationToggle) {
      onSimulationToggle(false);
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
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
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const renderQuestionCard = (q: Question, globalIndex: number, labelPrefix: string) => {
    if (isPrintAnswerSheet) {
      // Render as a blank answer sheet item for printing
      return (
        <div key={`ans-${globalIndex}`} className="answer-sheet-item" style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
          <strong>{labelPrefix}</strong>
          {q.options && q.options.length > 0 ? (
            <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
              {q.options.map((_, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '18px', height: '18px', border: '1px solid #000', borderRadius: '50%' }}></div>
                  {String.fromCharCode(65+i)}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ height: '120px', border: '1px dashed #ccc', marginTop: '8px', borderRadius: '4px' }}></div>
          )}
        </div>
      );
    }

    return (
      <div key={`q-${globalIndex}`} className="question-card" style={{ padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px', marginBottom: '15px' }}>
        <h4>{labelPrefix}</h4>
        <p style={{ whiteSpace: 'pre-wrap' }}><strong>{q.question_text}</strong></p>

        {isSimulating ? (
          <div className="interactive-answer">
            {q.options && q.options.length > 0 ? (
              <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  return (
                    <label key={i} className="option" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', background: studentAnswers[globalIndex] === letter ? '#e6f7ff' : '#f9f9f9', borderRadius: '6px' }}>
                      <input 
                        type="radio" 
                        name={`question-${globalIndex}`} 
                        value={letter}
                        checked={studentAnswers[globalIndex] === letter}
                        onChange={(e) => handleStudentAnswerChange(globalIndex, e.target.value)}
                      />
                      <span>{letter}. {opt}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <textarea
                placeholder="Type your detailed answer here..."
                rows={6}
                style={{ width: '100%', marginTop: '15px', padding: '12px', border: '1px solid #cad7e6', borderRadius: '10px', fontFamily: 'inherit', fontSize: '1rem' }}
                value={studentAnswers[globalIndex] || ''}
                onChange={(e) => handleStudentAnswerChange(globalIndex, e.target.value)}
              />
            )}
          </div>
        ) : (
          q.options && (
            <div className="options" style={{ marginTop: '15px' }}>
              {q.options.map((opt, i) => (
                <p key={i} className="option">{String.fromCharCode(65 + i)}. {opt}</p>
              ))}
            </div>
          )
        )}

        {showAnswers && (
          <div className="answer-section" style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '6px', borderLeft: '4px solid #10b981' }}>
            {examResult && examResult.results[globalIndex] && (
              <div style={{ marginBottom: '10px', padding: '8px', background: examResult.results[globalIndex].is_correct ? '#d1fae5' : '#fee2e2', borderRadius: '4px' }}>
                <strong>Score:</strong> {examResult.results[globalIndex].score * 100}% | <strong>Feedback:</strong> {examResult.results[globalIndex].feedback}
              </div>
            )}
            <p><strong>Expected Answer/Rubric:</strong> {q.correct_answer || 'See explanation'}</p>
            <p><strong>Explanation:</strong> {q.explanation}</p>
            <p><small style={{ color: '#666' }}>Difficulty: {q.difficulty_level} | Confidence: {(q.pattern_confidence * 100).toFixed(0)}%</small></p>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => (
    <div style={{ marginTop: showHistoryOnly ? '0' : '40px', padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>
      <h3>📜 Past Practices History</h3>
      {examHistory.length === 0 ? (
        <p style={{ marginTop: '10px', color: '#64748b' }}>No practice history found yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
          {examHistory.map(entry => (
            <div key={entry.id} className="history-item-card" style={{ padding: '15px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>{entry.subject.replace(/_/g, ' ').toUpperCase()}</strong>
                <span style={{ color: '#64748b' }}>{new Date(entry.created_at).toLocaleString()}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: entry.percentage >= 50 ? '#10b981' : '#ef4444' }}>
                  {entry.percentage}%
                </div>
                <span style={{ color: '#64748b' }}>{entry.score_obtained} / {entry.total_questions} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (showHistoryOnly) return renderHistory();

  return (
    <div className={`generator-section ${isSimulating ? 'simulating' : ''}`}>
      <div className="generator-hero">
        <h2>{isSimulating ? '📝 Official Mock Exam — Restricted Mode' : 'Generate Question'}</h2>
        <p>
          {isSimulating
            ? 'You are in exam mode. Navigation is locked. Complete the session and press "Submit & Finish" to exit.'
            : 'Generate realistic practice questions using textbooks and past questions. Mixed Resource Mode available for Year 3.'
          }
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isSimulating ? (
        <div className="sim-exit-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', marginBottom: '20px' }}>
          <span><strong>📋 Subject:</strong> {filteredSubjects.find(s => s.id === subject)?.name || subject}</span>
          <span><strong>Answered:</strong> {Object.keys(studentAnswers).length} / {questions.length}</span>
          {timeLeft !== null && (
            <span style={{ 
              fontWeight: 'bold', 
              color: timeLeft < 60 ? '#dc2626' : '#374151',
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: timeLeft < 60 ? '#fee2e2' : '#f3f4f6',
              border: '1px solid',
              borderColor: timeLeft < 60 ? '#dc2626' : '#d1d5db',
              animation: timeLeft < 60 ? 'pulse 1.5s infinite' : 'none'
            }}>
              ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}
          <button onClick={submitExamGrading} disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Grading...' : '✅ Submit Exam'}
          </button>
        </div>
      ) : (
        <>
          {examResult && (
            <div className="exam-results-card" style={{ background: 'linear-gradient(to right, #10253d, #1a3a5e)', color: 'white', padding: '25px', borderRadius: '12px', marginBottom: '25px', textAlign: 'center', boxShadow: 'var(--shadow-3d)' }}>
              <h2>Simulation Complete</h2>
              <h1 style={{ fontSize: '3.5rem', margin: '10px 0', fontFamily: 'Sora, sans-serif' }}>{examResult.percentage.toFixed(0)}%</h1>
              <p>You scored {examResult.score_obtained} out of {examResult.total_questions}</p>
              <button 
                onClick={() => {setQuestions([]); setExamResult(null);}} 
                style={{marginTop: '15px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
              >
                Start New Session
              </button>
            </div>
          )}
          <div className="form-grid generator-panel">
            <div className="form-group">
              <label htmlFor="year">Select Year / Format:</label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loadingSubjects || availableYears.length === 0}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year === 'Year 3' ? 'Year 3 (Mixed Resources)' : year}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="subject">Choose Subject:</label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loadingSubjects}
              >
                {filteredSubjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>{subj.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="qType">Format:</label>
              <select id="qType" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="essay">Structured Essay</option>
                <option value="standard">Full WASSCE Mock (46 Qs)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="numQ">Quantity:</label>
              <input id="numQ" type="number" min="1" max="50" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value))} />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty">Difficulty:</label>
              <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Beginner</option>
                <option value="medium">Standard</option>
                <option value="hard">Advanced</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="mockTime">Time (mins):</label>
              <input id="mockTime" type="number" min="1" value={mockTimeLimit} onChange={(e) => setMockTimeLimit(parseInt(e.target.value) || 1)} />
            </div>

            <div className="form-group">
              <label htmlFor="semester">Semester Selection:</label>
              <select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="all_year">Full Year (Recommended)</option>
                <option value="semester_1">First Semester (Sem 1)</option>
                <option value="semester_2">Second Semester (Sem 2)</option>
              </select>
            </div>
          </div>

          <div style={{display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap'}}>
            <button onClick={handleGenerate} disabled={loading || loadingSubjects} className="btn-primary">
              {loading ? 'Generating...' : '🚀 Generate Practice'}
            </button>
            <button onClick={startSimulation} disabled={loading || loadingSubjects} className="btn-secondary">
              🔒 Start Restricted Mock Exam
            </button>
          </div>
        </>
      )}

      {questions.length > 0 && (
        <div className="exam-controls" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => {setShowAnswers(!showAnswers); setIsPrintAnswerSheet(false);}} className="btn-secondary">
            {showAnswers ? '🙈 Hide Answers' : '👁️ Show Answers'}
          </button>
          <button onClick={() => {setIsPrintAnswerSheet(false); setTimeout(() => window.print(), 100);}} className="btn-secondary">
            🖨️ Print Question Paper
          </button>
          <button onClick={() => {setIsPrintAnswerSheet(true); setShowAnswers(false); setTimeout(() => window.print(), 100);}} className="btn-secondary">
            📝 Print Answer Sheet Only
          </button>
        </div>
      )}

      {generationTime > 0 && !isSimulating && !isPrintAnswerSheet && (
        <div className="info generation-summary">
          <span>{questions.length} questions generated by AI in {generationTime.toFixed(1)}s</span>
          {generationMeta?.source_used && (
            <span className={`source-badge source-${generationMeta.source_used}`}>
               Using: {generationMeta.source_used.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {isPrintAnswerSheet && (
         <div className="print-header" style={{ textAlign: 'center', padding: '20px', borderBottom: '2px solid #000', marginBottom: '30px' }}>
           <h1 style={{ textTransform: 'uppercase' }}>OFFICIAL ANSWER SHEET</h1>
           <h2>{filteredSubjects.find(s => s.id === subject)?.name.toUpperCase()}</h2>
           <p>Ensure answers are clearly marked in the spaces provided below.</p>
         </div>
      )}

      <div className="questions-list">
        {questions.map((q, index) => renderQuestionCard(q, index, `Question ${index + 1}`))}
      </div>

      {!isSimulating && examHistory.length > 0 && renderHistory()}
    </div>
  );
}

export default QuestionGenerator;
