import { useState, useEffect } from 'react';
import axios from 'axios';
import { questionsAPI, Question, GeneratedQuestions } from '../services/api';

interface Subject {
  id: string;
  name: string;
  year: string;
}

interface QuestionGeneratorProps {
  onSimulationToggle?: (active: boolean) => void;
  isSimulating?: boolean;
}

export function QuestionGenerator({ onSimulationToggle, isSimulating }: QuestionGeneratorProps) {
  const [subject, setSubject] = useState('mathematics');
  const [selectedYear, setSelectedYear] = useState('Year 1');
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [generationMeta, setGenerationMeta] = useState<GeneratedQuestions | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState('');
  const [mockTimeLimit, setMockTimeLimit] = useState(30); // Default 30 minutes
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const availableYears = Array.from(new Set(subjects.map((s) => s.year))).sort();
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
      } catch (error) {
        console.error('Error fetching subjects:', error);
        setError('Could not load subjects. Backend may still be loading or unavailable.');
        setTimeout(() => {
          fetchSubjects();
        }, 2000);
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
    try {
      const result = await questionsAPI.generateQuestions(
        subject,
        selectedYear,
        questionType,
        numQuestions,
        difficulty
      );
      setQuestions(result.questions);
      setGenerationTime(result.generation_time);
      setGenerationMeta(result);
      setShowAnswers(false);
    } catch (error) {
      console.error('Error generating questions:', error);
      const backendMessage = axios.isAxiosError(error)
        ? (error.response?.data?.detail || error.message)
        : 'Failed to generate questions. Please try again.';
      setError(backendMessage);
      alert(`Failed to generate questions: ${backendMessage}`);
    } finally {
      setLoading(false);
    }
  };


  const handleStudentAnswerChange = (index: number, val: string) => {
    setStudentAnswers(prev => ({ ...prev, [index]: val }));
  };

  const submitExamGrading = async () => {
    setIsSubmitting(true);
    try {
      // Map global index for grading
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
      setTimerActive(false);
      setTimeLeft(null);
      stopSimulation(); // Exit simulation mode to view results
    }
  };

  const stopSimulation = () => {
    setTimerActive(false);
    setTimeLeft(null);
    if (onSimulationToggle) {
      onSimulationToggle(false);
    }
    
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  // Anti-cheat fullscreen enforcement
  useEffect(() => {
    const handleFullscreenChange = () => {
      // If we are simulating but suddenly lose fullscreen, auto-submit to penalize cheating
      if (isSimulating && !document.fullscreenElement && !examResult) {
        alert('Restricted mode violation: Fullscreen exited. Auto-submitting exam now.');
        submitExamGrading();
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isSimulating, studentAnswers, examResult]);

  // Handle countdown timer
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

  // Split questions into sections for standard/full exam display
  const mcqQuestions = questions.filter(q => q.question_type === 'multiple_choice');
  const theoryQuestions = questions.filter(q => q.question_type === 'essay' || q.question_type === 'short_answer');
  const isStandardExam = false;

  const renderQuestionCard = (q: Question, globalIndex: number, labelPrefix: string) => (
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
              style={{ width: '100%', marginTop: '15px', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontFamily: 'inherit' }}
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

  return (
    <div className={`generator-section ${isSimulating ? 'simulating' : ''}`}>
      <div className="generator-hero">
        <h2>{isSimulating ? '📝 Official Mock Exam — Restricted Mode' : 'Generate Question'}</h2>
        <p>
          {isSimulating
            ? 'You are in exam mode. Navigation is locked. Complete the session and press "Submit & Finish" to exit.'
            : 'Generate realistic practice questions. Select a type and difficulty to build your targeted practice set.'
          }
        </p>
      </div>

      {error && (
        <div className="error-message" style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Restricted mode: show only a top bar with subject + exit button */}
      {isSimulating ? (
        <div className="sim-exit-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', marginBottom: '20px' }}>
          <span><strong>📋 Subject:</strong> {filteredSubjects.find(s => s.id === subject)?.name || subject}</span>
          <span><strong>Answered:</strong> {Object.keys(studentAnswers).length} / {questions.length}</span>
          {timeLeft !== null && (
            <span style={{ 
              fontWeight: 'bold', 
              color: timeLeft < 60 ? '#dc2626' : '#374151',
              padding: '4px 12px',
              borderRadius: '4px',
              backgroundColor: timeLeft < 60 ? '#fee2e2' : '#f3f4f6',
              border: timeLeft < 60 ? '1px solid #dc2626' : '1px solid #d1d5db',
              animation: timeLeft < 60 ? 'pulse 1.5s infinite' : 'none'
            }}>
              ⏱️ Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}
          <button onClick={submitExamGrading} disabled={isSubmitting} className="btn-secondary" style={{ background: '#10b981', color: 'white', border: 'none' }}>
            {isSubmitting ? 'Grading...' : '✅ Submit & Finish Exam'}
          </button>
        </div>
      ) : (
        <>
          {examResult && (
            <div className="exam-results-card" style={{ background: 'linear-gradient(to right, #1e3c72, #2a5298)', color: 'white', padding: '25px', borderRadius: '12px', marginBottom: '25px', textAlign: 'center' }}>
              <h2>Simulation Complete</h2>
              <h1 style={{ fontSize: '3rem', margin: '15px 0' }}>{examResult.percentage.toFixed(1)}%</h1>
              <p>You scored {examResult.score_obtained} out of {examResult.total_questions}</p>
            </div>
          )}
          <div className="form-grid generator-panel">
            <div className="form-group">
              <label htmlFor="year">Year:</label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loadingSubjects || availableYears.length === 0}
              >
                {availableYears.length === 0 ? (
                  <option>Loading years...</option>
                ) : (
                  availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject:</label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loadingSubjects}
                style={{opacity: loadingSubjects ? 0.6 : 1}}
              >
                {loadingSubjects ? (
                  <option>Loading subjects...</option>
                ) : filteredSubjects.length === 0 ? (
                  <option>No subjects available</option>
                ) : (
                  filteredSubjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="qType">Question Type:</label>
              <select
                id="qType"
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="short_answer">Short Answer</option>
                <option value="essay">Essay</option>
                <option value="true_false">True/False</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="numQ">Number of Questions:</label>
              <input
                id="numQ"
                type="number"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty">Difficulty Level:</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="mockTime">Time Limit (mins):</label>
              <input
                id="mockTime"
                type="number"
                min="1"
                max="180"
                value={mockTimeLimit}
                onChange={(e) => setMockTimeLimit(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap'}}>
            <button
              onClick={handleGenerate}
              disabled={loading || loadingSubjects}
              className="btn-primary"
            >
              {loading ? 'Generating...' : 'Generate Questions'}
            </button>

          </div>
        </>
      )}

      {/* Show/Hide Answers + Print controls */}
      {questions.length > 0 && (
        <div className="exam-controls" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => setShowAnswers(!showAnswers)} className="btn-secondary">
            {showAnswers ? '🙈 Hide Answers' : '👁️ Show Answers'}
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            🖨️ Print Question Sheet
          </button>
        </div>
      )}

      {generationTime > 0 && !isSimulating && (
        <div className="info generation-summary">
          <span>Generated {questions.length} questions in {generationTime.toFixed(2)}s</span>
          {generationMeta?.source_used && (
            <span className={`source-badge source-${generationMeta.source_used.replace(/\+/g, '_').replace(/[^a-z_]/g, '')}`}>
              Source: {generationMeta.source_used.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {/* Render questions — with section headers for standard exam */}
      <div className="questions-list">
        {isStandardExam ? (
          <>
            {mcqQuestions.length > 0 && (
              <>
                <h3 style={{
                  marginTop: '1rem', marginBottom: '0.5rem', padding: '0.6rem 1rem',
                  background: 'linear-gradient(120deg, #0b7a4b, #10a261)', color: '#fff',
                  borderRadius: '10px', fontFamily: 'Sora, sans-serif'
                }}>
                  SECTION A — Objective (Multiple Choice)
                </h3>
                {mcqQuestions.map((q, i) => {
                  const globalIdx = questions.indexOf(q);
                  return renderQuestionCard(q, globalIdx, `SECTION A – Question ${i + 1}`);
                })}
              </>
            )}
            {theoryQuestions.length > 0 && (
              <>
                <h3 style={{
                  marginTop: '1.5rem', marginBottom: '0.5rem', padding: '0.6rem 1rem',
                  background: 'linear-gradient(120deg, #c61f1f, #d33e2f)', color: '#fff',
                  borderRadius: '10px', fontFamily: 'Sora, sans-serif'
                }}>
                  SECTION B — Theory / Structured
                </h3>
                {theoryQuestions.map((q, i) => {
                  const globalIdx = questions.indexOf(q);
                  return renderQuestionCard(q, globalIdx, `SECTION B – Question ${i + 1}`);
                })}
              </>
            )}
          </>
        ) : (
          questions.map((q, index) => renderQuestionCard(q, index, `Question ${index + 1}`))
        )}
      </div>
    </div>
  );
}
