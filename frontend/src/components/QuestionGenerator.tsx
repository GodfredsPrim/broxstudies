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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState('');
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
      const count = questionType === 'standard' ? 25 : numQuestions;
      const result = await questionsAPI.generateQuestions(
        subject,
        selectedYear,
        questionType,
        count,
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

  const startSimulation = () => {
    if (onSimulationToggle) {
      onSimulationToggle(true);
    }
  };

  const stopSimulation = () => {
    if (onSimulationToggle) {
      onSimulationToggle(false);
    }
  };

  // Split questions into sections for standard/full exam display
  const mcqQuestions = questions.filter(q => q.question_type === 'multiple_choice');
  const theoryQuestions = questions.filter(q => q.question_type === 'essay' || q.question_type === 'short_answer');
  const isStandardExam = questionType === 'standard' && questions.length > 0 && (mcqQuestions.length > 0 || theoryQuestions.length > 0);

  const renderQuestionCard = (q: Question, index: number, sectionLabel: string) => (
    <div key={`${sectionLabel}-${index}`} className="question-card">
      <h4>{sectionLabel} – Question {index + 1}</h4>
      <p><strong>{q.question_text}</strong></p>

      {q.options && (
        <div className="options">
          {q.options.map((opt, i) => (
            <p key={i} className="option">{String.fromCharCode(65 + i)}. {opt}</p>
          ))}
        </div>
      )}

      {showAnswers && (
        <div className="answer-section">
          <p><strong>Answer:</strong> {q.correct_answer}</p>
          <p><strong>Explanation:</strong> {q.explanation}</p>
          <p><small>Difficulty: {q.difficulty_level} | Confidence: {(q.pattern_confidence * 100).toFixed(0)}%</small></p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`generator-section ${isSimulating ? 'simulating' : ''}`}>
      <div className="generator-hero">
        <h2>{isSimulating ? '📝 Official Mock Exam — Restricted Mode' : 'Exam Simulator'}</h2>
        <p>
          {isSimulating
            ? 'You are in exam mode. Navigation is locked. Complete the paper and press "Submit & Finish Exam" to exit.'
            : 'Generate realistic exam questions. Select "Standard (Full Exam)" to create a complete WASSCE-style paper with MCQs and Theory sections.'
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
        <div className="sim-exit-bar">
          <span><strong>📋 Subject:</strong> {filteredSubjects.find(s => s.id === subject)?.name || subject}</span>
          <span><strong>Questions:</strong> {questions.length}</span>
          <button onClick={stopSimulation} className="btn-secondary">✅ Submit &amp; Finish Exam</button>
        </div>
      ) : (
        <>
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
                <option value="standard">Standard (Full Exam)</option>
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
                value={questionType === 'standard' ? 25 : numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                disabled={questionType === 'standard'}
              />
              {questionType === 'standard' && (
                <small style={{color: '#666', marginTop: '4px', display: 'block'}}>Fixed: 20 MCQ + 5 Theory</small>
              )}
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
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap'}}>
            <button
              onClick={handleGenerate}
              disabled={loading || loadingSubjects}
              className="btn-primary"
            >
              {loading ? 'Generating...' : (questionType === 'standard' ? '📄 Generate Full Exam Paper' : 'Generate Questions')}
            </button>

            {questions.length > 0 && questionType === 'standard' && (
              <button
                onClick={startSimulation}
                className="btn-primary"
                style={{ background: 'linear-gradient(125deg, #1a1a2e, #16213e)', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
              >
                🔒 Start Mock Exam (Restricted Mode)
              </button>
            )}
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
                {mcqQuestions.map((q, i) => renderQuestionCard(q, i, 'A'))}
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
                {theoryQuestions.map((q, i) => renderQuestionCard(q, i, 'B'))}
              </>
            )}
          </>
        ) : (
          questions.map((q, index) => (
            <div key={index} className="question-card">
              <h4>Question {index + 1}</h4>
              <p><strong>{q.question_text}</strong></p>

              {q.options && (
                <div className="options">
                  {q.options.map((opt, i) => (
                    <p key={i} className="option">{String.fromCharCode(65 + i)}. {opt}</p>
                  ))}
                </div>
              )}

              {showAnswers && (
                <div className="answer-section">
                  <p><strong>Answer:</strong> {q.correct_answer}</p>
                  <p><strong>Explanation:</strong> {q.explanation}</p>
                  <p><small>Difficulty: {q.difficulty_level} | Confidence: {(q.pattern_confidence * 100).toFixed(0)}%</small></p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
