import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, X, Clock, Brain, FileText, Zap, Printer } from 'lucide-react';
import { questionsAPI, Question, GeneratedQuestions } from '../services/api';
import MathRenderer from './MathRenderer';

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
  const [mockTimeLimit] = useState(30);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>([]);
  const [semester, setSemester] = useState('all_year');

  const availableYears = Array.from(new Set(subjects.map((s) => s.year))).sort();
  if (!availableYears.includes('Year 3') && subjects.length > 0) {
    availableYears.push('Year 3');
  }

  const filteredSubjects = selectedYear === 'Year 3' 
    ? Array.from(new Map(subjects.map(s => [s.name, s])).values())
    : subjects.filter((s) => s.year === selectedYear);

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
          // Remove the filter to show all types of history items
          setExamHistory(hist.reverse());
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
      let result;
      if (questionType === 'professional') {
        result = await questionsAPI.generateProfessionalMock(subject, selectedYear);
      } else {
        result = await questionsAPI.generateQuestions(
          subject,
          selectedYear,
          questionType,
          numQuestions,
          difficulty,
          [],
          semester
        );
      }
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
          details_json: JSON.stringify({
            results: res.results,
            questions: questions,
            subject: subject,
            selectedYear: selectedYear,
            difficulty: difficulty,
            questionType: questionType
          })
        });
        // Refresh local history
        const hist = await questionsAPI.getExamHistory();
        setExamHistory(hist.reverse());
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

  const handleViewHistory = (entry: ExamHistoryEntry) => {
    try {
      if (!entry.details_json) return;
      const data = JSON.parse(entry.details_json);
      
      // If it's the old format just containing results array
      if (Array.isArray(data)) {
        alert("This history item was saved in an older format and cannot be viewed instantly. Please generate a new practice.");
        return;
      }

      setQuestions(data.questions || []);
      setExamResult({
        results: data.results,
        score_obtained: entry.score_obtained,
        total_questions: entry.total_questions,
        percentage: entry.percentage
      });
      setSubject(data.subject || entry.subject);
      setSelectedYear(data.selectedYear || 'Year 1');
      setDifficulty(data.difficulty || 'medium');
      setQuestionType(data.questionType || 'multiple_choice');
      setShowAnswers(true);
      setIsPrintAnswerSheet(false);
      
      // Scroll to top to see questions
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error("Failed to parse history details", e);
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
      return (
        <div key={`ans-${globalIndex}`} className="mb-4 pb-2 border-b border-gray-300">
          <strong>{labelPrefix}</strong>
          {q.options && q.options.length > 0 ? (
            <div className="flex gap-4 mt-2">
              {q.options.map((_, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <div className="w-5 h-5 border border-black rounded-full"></div>
                  {String.fromCharCode(65+i)}
                </span>
              ))}
            </div>
          ) : (
            <div className="h-32 border border-dashed border-gray-400 mt-2 rounded"></div>
          )}
        </div>
      );
    }

    return (
      <div 
        key={`q-${globalIndex}`} 
        className="question-card glass-card"
        style={{ animationDelay: `${globalIndex * 0.1}s` }}
      >
        <div className="question-card__header">
          <span className="question-card__number">{labelPrefix}</span>
          <span className="question-card__type">{q.question_type.replace('_', ' ')}</span>
        </div>
        
        <div className="question-card__body">
          <div className="question-card__text">
            <MathRenderer text={q.question_text} />
          </div>

          <div className="question-card__input-area">
            {isSimulating ? (
              q.options && q.options.length > 0 ? (
                <div className="options-grid">
                  {q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const cleanedOpt = opt.replace(/^(Option\s+[A-D][:.]\s*|[A-D][:.]\s*)/i, '').trim();
                    const isSelected = studentAnswers[globalIndex] === letter;
                    return (
                      <label key={i} className={`option-item ${isSelected ? 'option-item--selected' : ''}`}>
                        <input 
                          type="radio" 
                          name={`question-${globalIndex}`} 
                          value={letter}
                          checked={isSelected}
                          onChange={(e) => handleStudentAnswerChange(globalIndex, e.target.value)}
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
                  placeholder="Type your detailed answer here..."
                  rows={6}
                  className="essay-input"
                  value={studentAnswers[globalIndex] || ''}
                  onChange={(e) => handleStudentAnswerChange(globalIndex, e.target.value)}
                />
              )
            ) : (
              q.options && (
                <div className="mt-4">
                  {q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const cleanedOpt = opt.replace(/^(Option\s+[A-D][:.]\s*|[A-D][:.]\s*)/i, '').trim();
                    return (
                      <p key={i} className="mb-2">{letter}: <MathRenderer text={cleanedOpt} /></p>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {showAnswers && (
            <div className="question-card__feedback">
              {examResult && examResult.results[globalIndex] && (
                <div className={`feedback-score ${examResult.results[globalIndex].is_correct ? 'feedback-score--correct' : 'feedback-score--wrong'}`}>
                  <strong>Score: {examResult.results[globalIndex].score * 100}%</strong>
                  <p>{examResult.results[globalIndex].feedback}</p>
                </div>
              )}
              <div className="feedback-content">
                <div className="feedback-item">
                  <span className="feedback-label">Correct Answer</span>
                  <div className="feedback-value"><MathRenderer text={q.correct_answer || 'See explanation'} /></div>
                </div>
                <div className="feedback-item">
                  <span className="feedback-label">Explanation</span>
                  <div className="feedback-value"><MathRenderer text={q.explanation} /></div>
                </div>
              </div>
              <div className="feedback-footer">
                <span>Difficulty: {q.difficulty_level}</span>
                <span>Confidence: {(q.pattern_confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className={`${showHistoryOnly ? '' : 'mt-10'} p-6 bg-gray-50 rounded-xl`}>
      <h3 className="text-xl font-semibold mb-4">📜 Past Practices History</h3>
      {examHistory.length === 0 ? (
        <p className="mt-3 text-gray-500">No practice history found yet.</p>
      ) : (
        <div className="grid gap-4 mt-4">
          {examHistory.map(entry => (
            <div 
              key={entry.id} 
              className="p-4 bg-white border border-gray-200 rounded-lg flex justify-between items-center cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all"
              onClick={() => handleViewHistory(entry)}
            >
              <div>
                <strong className="block text-lg">{entry.subject.replace(/_/g, ' ').toUpperCase()}</strong>
                <span className="block text-xs font-bold text-green-600 mb-1">
                  {entry.exam_type.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="text-gray-500">{new Date(entry.created_at).toLocaleString()} • <span className="text-blue-600">View Results →</span></span>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${entry.percentage >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                  {entry.percentage}%
                </div>
                <span className="text-gray-500">{entry.score_obtained} / {entry.total_questions} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );


  if (showHistoryOnly) {
    return (
      <div className="generator-shell">
        <header className="generator-header">
          <div className="generator-header__content">
            <h1 className="generator-title">Activity History</h1>
            <p className="generator-subtitle">Review your past performance and track your growth over time.</p>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold text-gray-500 bg-gray-100/50 px-4 py-2 rounded-full border border-gray-200">
             <Clock size={16} /> {examHistory.length} Sessions Recorded
          </div>
        </header>

        <div className="mt-8">
          {renderHistory()}
        </div>
      </div>
    );
  }

  return (
    <div className={`generator-shell ${isSimulating ? 'generator-shell--simulating' : ''}`}>
      <div className="generator-header">
        <div className="generator-header__content">
          <h2 className="generator-title">
            {isSimulating ? (
              <span className="flex items-center gap-3">
                <Shield className="text-red-500" />
                Restricted Exam Mode
              </span>
            ) : (
              'Question Generator'
            )}
          </h2>
          <p className="generator-subtitle">
            {isSimulating
              ? 'Navigation locked. Complete the session to exit.'
              : 'Master your exams with AI-powered practice sets.'
            }
          </p>
        </div>
        {!isSimulating && (
          <div className="generator-header__actions">
             <button onClick={handleGenerate} disabled={loading || loadingSubjects} className="generator-btn generator-btn--primary">
                {loading ? <span className="animate-pulse">Generating...</span> : <><Brain size={18} /> Generate</>}
             </button>
          </div>
        )}
      </div>

      {error && (
        <div className="generator-error">
          <X className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {isSimulating ? (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex justify-between items-center">
          <span><strong>📋 Subject:</strong> {filteredSubjects.find(s => s.id === subject)?.name || subject}</span>
          <span><strong>Answered:</strong> {Object.keys(studentAnswers).length} / {questions.length}</span>
          {timeLeft !== null && (
            <span className={`font-bold px-3 py-1 rounded-full border ${timeLeft < 60 ? 'text-red-600 bg-red-100 border-red-600 animate-pulse' : 'text-gray-700 bg-gray-100 border-gray-300'}`}>
              ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}
          <button onClick={submitExamGrading} disabled={isSubmitting} className="generator-btn generator-btn--primary" style={{ padding: '0.5rem 1.25rem', borderRadius: '10px' }}>
            {isSubmitting ? 'Grading...' : <><Zap size={16} /> Submit Exam</>}
          </button>
        </div>
      ) : (
        <>
          {examResult && (
            <div className="generator-result glass-card animate-scale-up">
              <div className="result-aura" />
              <div className="result-content">
                <span className="result-label">Practice Complete</span>
                <h1 className="result-percentage">{examResult.percentage.toFixed(0)}%</h1>
                <p className="result-summary">You scored <strong>{examResult.score_obtained}</strong> out of <strong>{examResult.total_questions}</strong></p>
                <button 
                  onClick={() => {setQuestions([]); setExamResult(null);}} 
                  className="generator-btn generator-btn--primary"
                >
                  Start New Session
                </button>
              </div>
            </div>
          )}
          <div className="generator-form glass-card">
            <div className="generator-form-grid">
              <div className="form-group">
                <label>Year / Level</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  disabled={loadingSubjects || availableYears.length === 0}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subject</label>
                <select
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
                <label>Format</label>
                <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="essay">Structured Essay</option>
                  <option value="standard">Full WASSCE Mock</option>
                  <option value="professional">Professional Layout</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <input type="number" min="1" max="50" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value))} />
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="easy">Beginner</option>
                  <option value="medium">Standard</option>
                  <option value="hard">Advanced</option>
                </select>
              </div>

              <div className="form-group">
                <label>Semester</label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                  <option value="all_year">Full Year</option>
                  <option value="semester_1">Semester 1</option>
                  <option value="semester_2">Semester 2</option>
                </select>
              </div>
            </div>

            <div className="generator-form-actions">
              <button onClick={startSimulation} disabled={loading || loadingSubjects} className="generator-btn generator-btn--secondary">
                🔒 Start Restricted Mock
              </button>
            </div>
          </div>
        </>
      )}

      {questions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3 items-center">
          <button onClick={() => {setShowAnswers(!showAnswers); setIsPrintAnswerSheet(false);}} className="generator-btn generator-btn--secondary" style={{ padding: '0.6rem 1.25rem' }}>
            {showAnswers ? <><X size={16} /> Hide Answers</> : <><Zap size={16} /> Show Answers</>}
          </button>
          <button onClick={() => {setIsPrintAnswerSheet(false); setTimeout(() => window.print(), 100);}} className="generator-btn generator-btn--secondary" style={{ padding: '0.6rem 1.25rem' }}>
            <Printer size={16} /> Print Paper
          </button>
          <button onClick={() => {setIsPrintAnswerSheet(true); setShowAnswers(false); setTimeout(() => window.print(), 100);}} className="generator-btn generator-btn--secondary" style={{ padding: '0.6rem 1.25rem' }}>
            <FileText size={16} /> Print Answer Sheet
          </button>
        </div>
      )}

      {generationTime > 0 && !isSimulating && !isPrintAnswerSheet && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
          <span>{questions.length} questions generated by AI in {generationTime.toFixed(1)}s</span>
          {generationMeta?.source_used && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
               Using: {generationMeta.source_used.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {isPrintAnswerSheet && (
         <div className="text-center p-6 border-b-2 border-black mb-8">
           <h1 className="text-2xl font-bold uppercase">OFFICIAL ANSWER SHEET</h1>
           <h2 className="text-xl font-semibold uppercase">{filteredSubjects.find(s => s.id === subject)?.name.toUpperCase()}</h2>
           <p>Ensure answers are clearly marked in the spaces provided below.</p>
         </div>
      )}

      <div className="space-y-6">
        {questions.map((q, index) => renderQuestionCard(q, index, `Question ${index + 1}`))}
      </div>

      {!isSimulating && examHistory.length > 0 && renderHistory()}
    </div>
  );
}

export default QuestionGenerator;
