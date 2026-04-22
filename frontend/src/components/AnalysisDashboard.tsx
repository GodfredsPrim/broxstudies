import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Clock, Zap, FileText, Printer, History, Loader2 } from 'lucide-react';
import { questionsAPI, Question } from '../services/api';
import MathRenderer from './MathRenderer';

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
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>([]);
  const [organizedPapers, setOrganizedPapers] = useState<Record<string, Question[]> | null>(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);

  const loadingStages = [
    'Scanning past-paper archive...',
    'Fetching textbooks from curriculumresources.edu.gh...',
    'Analysing the official WASSCE paper structure...',
    'Generating objective questions from textbook topics...',
    'Drafting theory questions and marking rubrics...',
    'Validating each question against WASSCE standard...',
    'Assembling your paper — almost done...',
  ];

  useEffect(() => {
    if (!loading) {
      setLoadingElapsed(0);
      setLoadingStageIndex(0);
      return;
    }
    const tick = setInterval(() => setLoadingElapsed((s) => s + 1), 1000);
    const rotate = setInterval(
      () => setLoadingStageIndex((i) => Math.min(i + 1, loadingStages.length - 1)),
      8000,
    );
    return () => {
      clearInterval(tick);
      clearInterval(rotate);
    };
  }, [loading]);

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
          setExamHistory(hist.filter((h: any) => h.exam_type === 'likely_wassce'));
        } catch(e) {}
        
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
      const result = await questionsAPI.generateProfessionalMock(subject, selectedYear);
      setQuestions(result.questions);
      setOrganizedPapers(result.organized_papers || null);
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
      
      try {
        await questionsAPI.saveExamHistory({
          exam_type: 'likely_wassce',
          subject: subject,
          score_obtained: res.score_obtained,
          total_questions: res.total_questions,
          percentage: res.percentage,
          details_json: JSON.stringify({
            results: res.results,
            questions: questions,
            subject: subject,
            selectedYear: selectedYear
          })
        });
      } catch (historyErr) {
        console.error('Failed to save history', historyErr);
      }
    } catch (err) {
      console.error('Error marking practice:', err);
      alert('Error submitting exam for grading.');
    } finally {
      setIsSubmitting(false);
      stopSimulation();
    }
  };

  const handleViewHistory = (entry: ExamHistoryEntry) => {
    try {
      if (!entry.details_json) return;
      const data = JSON.parse(entry.details_json);
      
      if (Array.isArray(data)) {
        alert("This history item was saved in an older format and cannot be viewed instantly.");
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
      setShowAnswers(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error("Failed to parse history details", e);
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
          {q.options && q.options.length > 0 ? (
            <div className="options-grid">
              {q.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const cleanedOpt = opt.replace(/^(Option\s+[A-D][:.]\s*|[A-D][:.]\s*)/i, '').trim();
                const isSelected = studentAnswers[globalIndex] === letter;
                return (
                  <label key={i} className={`option-item ${isSelected ? 'option-item--selected' : ''}`}>
                    <input 
                      type="radio" 
                      name={`hall-question-${globalIndex}`} 
                      value={letter}
                      checked={isSelected}
                      onChange={(e) => setStudentAnswers(prev => ({ ...prev, [globalIndex]: e.target.value }))}
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
              placeholder="Type your detailed answer here... (Show all workings for sub-parts like (a)(i), (b))"
              rows={8}
              className="essay-input"
              value={studentAnswers[globalIndex] || ''}
              onChange={(e) => setStudentAnswers(prev => ({ ...prev, [globalIndex]: e.target.value }))}
            />
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
          </div>
        )}
      </div>
    </div>
  );

  const loadingMinutes = Math.floor(loadingElapsed / 60);
  const loadingSeconds = loadingElapsed % 60;

  return (
    <div className={`generator-shell ${isSimulating ? 'generator-shell--simulating' : ''}`}>
      {loading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Generating paper"
        >
          <div className="glass-card max-w-md w-[92%] p-8 text-center space-y-5 rounded-2xl shadow-2xl">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-ghana-green" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Building your WASSCE paper</h3>
              <p className="text-sm opacity-70 mt-1">
                This usually takes 45&ndash;90 seconds. The first time you pick a subject it may take a bit longer while its textbooks download.
              </p>
            </div>
            <div className="bg-ghana-green/5 border border-ghana-green/20 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold">{loadingStages[loadingStageIndex]}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm opacity-70">
              <Clock size={14} />
              <span>
                {loadingMinutes > 0 ? `${loadingMinutes}m ` : ''}
                {loadingSeconds.toString().padStart(2, '0')}s elapsed
              </span>
            </div>
            <p className="text-xs opacity-50">Please keep this tab open.</p>
          </div>
        </div>
      )}

      {!isSimulating && (
        <div className="generator-header">
          <div className="generator-header__content">
            <h2 className="generator-title">Likely WASSCE Hall</h2>
            <p className="generator-subtitle">
              {selectedYear === 'Year 3' 
                ? 'Strict Past-Question Mode: Authentic WASSCE examination patterns.' 
                : 'Solve complete 40-MCQ + 6-Theory papers under strict simulation.'}
            </p>
          </div>
          <div className="generator-header__actions">
             <button onClick={handleGenerate} disabled={loading} className="generator-btn generator-btn--primary">
                {loading ? <span className="animate-pulse">Constructing...</span> : <><FileText size={18} /> Generate Paper</>}
             </button>
          </div>
        </div>
      )}

      {error && <div className="generator-error"><X className="w-5 h-5" /> {error}</div>}

      {isSimulating ? (
        <div className="sim-exit-bar glass-card">
          <div className="flex items-center gap-6">
            <span><strong>📋 Subject:</strong> {subjects.find(s => s.id === subject)?.name}</span>
            <span><strong>Progress:</strong> {Object.keys(studentAnswers).length} / {questions.length}</span>
          </div>
          <div className="flex items-center gap-6">
            {timeLeft !== null && (
              <span className={`flex items-center gap-2 font-bold px-3 py-1 rounded-full border ${timeLeft < 300 ? 'text-red-500 bg-red-50 border-red-200 animate-pulse' : 'text-gray-300'}`}>
                <Clock size={16} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            )}
            <button onClick={submitExamGrading} disabled={isSubmitting} className="generator-btn generator-btn--primary" style={{ padding: '0.5rem 1.25rem', borderRadius: '10px' }}>
              {isSubmitting ? 'Grading...' : <><Zap size={16} /> Submit Paper</>}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="generator-form glass-card">
            <div className="generator-form-grid">
              <div className="form-group">
                <label>Select Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Select Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Time Limit (mins)</label>
                <input type="number" value={mockTimeLimit} onChange={(e) => setMockTimeLimit(parseInt(e.target.value) || 1)} />
              </div>
            </div>

            {questions.length > 0 && (
              <div className="generator-form-actions" style={{ marginTop: '2rem' }}>
                <button onClick={startSimulation} className="generator-btn generator-btn--secondary">
                  🔒 Start Exam (Restricted)
                </button>
                <button onClick={() => window.print()} className="generator-btn generator-btn--secondary">
                  <Printer size={16} /> Print Paper
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {examResult && !isSimulating && (
        <div className="generator-result glass-card animate-scale-up">
          <div className="result-aura" />
          <div className="result-content">
            <span className="result-label">Official Result</span>
            <h1 className="result-percentage">{examResult.percentage}%</h1>
            <p className="result-summary">Score: <strong>{examResult.score_obtained}</strong> / {examResult.total_questions}</p>
            <p className="text-sm opacity-60">Review your answers below to master the concepts.</p>
          </div>
        </div>
      )}

      <div className="questions-list space-y-12">
        {questions.length > 0 && (() => {
          const paperLabels: Record<string, string> = {
            paper_1: 'Paper 1: Objective Test',
            paper_2: 'Paper 2: Theory',
            paper_3: 'Paper 3: Practical / Alternative',
          };
          const paperKeys = organizedPapers
            ? Object.keys(organizedPapers).filter((k) => (organizedPapers[k] || []).length > 0)
            : [];

          if (paperKeys.length > 0) {
            let running = 0;
            return (
              <>
                {paperKeys.map((key, sectionIdx) => {
                  const paperQs = organizedPapers![key] || [];
                  const heading = `${paperLabels[key] || key.replace('_', ' ').toUpperCase()} (${paperQs.length} Question${paperQs.length === 1 ? '' : 's'})`;
                  const sectionStart = running;
                  running += paperQs.length;
                  return (
                    <div key={key}>
                      <div className="section-divider" style={sectionIdx > 0 ? { marginTop: '5rem' } : undefined}>
                        <span className="section-divider__label">{heading}</span>
                      </div>
                      {paperQs.map((q, i) => {
                        const labelIndex = sectionStart + i;
                        const prefix = key === 'paper_1' ? `Question ${i + 1}` : `Question ${i + 1} (${paperLabels[key]?.split(':')[1]?.trim() || 'Theory'})`;
                        return renderQuestionCard(q, labelIndex, prefix);
                      })}
                    </div>
                  );
                })}
              </>
            );
          }

          return (
            <>
              {mcqQuestions.length > 0 && (
                <>
                  <div className="section-divider">
                    <span className="section-divider__label">Section A: Objective ({mcqQuestions.length} Question{mcqQuestions.length === 1 ? '' : 's'})</span>
                  </div>
                  {mcqQuestions.map((q, i) => renderQuestionCard(q, questions.indexOf(q), `Question ${i + 1}`))}
                </>
              )}
              {theoryQuestions.length > 0 && (
                <>
                  <div className="section-divider" style={{ marginTop: '5rem' }}>
                    <span className="section-divider__label">Section B: Theory ({theoryQuestions.length} Question{theoryQuestions.length === 1 ? '' : 's'})</span>
                  </div>
                  {theoryQuestions.map((q, i) => renderQuestionCard(q, questions.indexOf(q), `Question ${i + 1} (Theory)`))}
                </>
              )}
            </>
          );
        })()}
      </div>

      {!isSimulating && !!examHistory.length && (
        <div className="generator-history mt-20 p-8 glass-card">
          <div className="flex items-center gap-3 mb-6">
             <History className="text-ghana-green" />
             <h3 className="text-xl font-bold">Past Papers History</h3>
          </div>
          <div className="grid gap-4">
          {examHistory.map(entry => (
            <div 
              key={entry.id} 
              className="p-4 bg-white/50 border border-gray-100 rounded-xl flex justify-between items-center cursor-pointer hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all" 
              onClick={() => handleViewHistory(entry)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-ghana-green/10 rounded-full flex items-center justify-center text-ghana-green">
                  <FileText size={20} />
                </div>
                <div>
                  <strong className="block text-lg">{entry.subject.replace(/_/g, ' ').toUpperCase()}</strong>
                  <span className="text-sm text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${entry.percentage >= 50 ? 'text-ghana-green' : 'text-red-500'}`}>
                  {entry.percentage}%
                </div>
                <span className="text-xs font-semibold opacity-60 uppercase">{entry.score_obtained} / {entry.total_questions} PTS</span>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

    </div>
  );
}
