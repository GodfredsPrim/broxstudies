import { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Zap, FileText, Printer, History, Loader2, ShieldCheck, Trophy } from 'lucide-react';
import { questionsAPI, Question } from '../services/api';
import MathRenderer from './MathRenderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonLines } from '@/components/ui/skeleton';
import { SankofaIcon, AdinkraWatermark } from '@/components/ui/adinkra';

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
          <Card className="w-[92%] max-w-md space-y-5 rounded-2xl border-gh-chalk bg-gh-paper p-8 text-center shadow-brand-lg dark:border-white/10 dark:bg-gh-night-raised">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-gh-ink-blue dark:text-gh-gold-glow" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-gh-ink dark:text-gh-cream">Building your WASSCE paper</h3>
              <p className="mt-1 text-sm leading-relaxed text-gh-ink-60 dark:text-gh-chalk">
                This usually takes 45&ndash;90 seconds. The first time you pick a subject it may take a bit longer while its textbooks download.
              </p>
            </div>
            <div className="rounded-xl border border-gh-ink-blue/15 bg-gh-ink-blue-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-semibold text-gh-ink-blue dark:text-gh-cream">{loadingStages[loadingStageIndex]}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gh-ink-60 dark:text-gh-chalk">
              <Clock size={14} />
              <span>
                {loadingMinutes > 0 ? `${loadingMinutes}m ` : ''}
                {loadingSeconds.toString().padStart(2, '0')}s elapsed
              </span>
            </div>
            <p className="text-xs text-gh-ink-40">Please keep this tab open.</p>
          </Card>
        </div>
      )}

      {!isSimulating && (
        <SectionHeader
          eyebrow="Likely WASSCE Hall"
          title={selectedYear === 'Year 3' ? 'Strict Past-Question Mode' : 'Full Paper Simulation'}
          description={
            selectedYear === 'Year 3'
              ? 'Authentic WASSCE examination patterns drawn from official past papers.'
              : 'Solve complete 40-MCQ + 6-Theory papers under strict simulation.'
          }
          actions={
            <Button
              onClick={handleGenerate}
              disabled={loading}
              size="lg"
              className="gap-2"
            >
              <FileText size={18} />
              {loading ? 'Constructing…' : 'Generate Paper'}
            </Button>
          }
        />
      )}

      {error && !loading && (
        <ErrorState
          size="sm"
          title="Couldn't load your paper"
          description={error}
          onRetry={handleGenerate}
          retryLabel="Try again"
        />
      )}

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
            <Button
              onClick={submitExamGrading}
              disabled={isSubmitting}
              size="sm"
              className="gap-2"
            >
              {isSubmitting ? 'Grading…' : <><Zap size={16} /> Submit Paper</>}
            </Button>
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
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  onClick={startSimulation}
                  variant="secondary"
                  size="lg"
                  className="gap-2"
                >
                  <ShieldCheck size={18} />
                  Start Exam (Restricted)
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  <Printer size={16} />
                  Print Paper
                </Button>
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

      {!isSimulating && !questions.length && !loading && (
        <Card className="relative overflow-hidden border-gh-chalk bg-gh-paper p-6 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <History className="h-5 w-5 text-gh-ink-blue dark:text-gh-gold-glow" />
            <h3 className="text-lg font-bold tracking-tight text-gh-ink dark:text-gh-cream sm:text-xl">
              Past Papers History
            </h3>
          </div>
          {examHistory.length === 0 ? (
            <div className="relative">
              <AdinkraWatermark
                symbol={SankofaIcon}
                className="text-gh-ink-blue dark:text-gh-gold-glow"
                opacity={0.05}
              />
              <EmptyState
                size="sm"
                icon={<SankofaIcon size={32} />}
                title="No papers yet"
                description="Sankofa — go back and fetch it. Generate your first WASSCE paper to start building your history."
                action={
                  <Button onClick={handleGenerate} className="gap-2">
                    <FileText size={16} />
                    Generate your first paper
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3">
              {examHistory.map(entry => {
                const pct = entry.percentage;
                const scoreVariant = pct >= 80 ? 'brass' : pct >= 50 ? 'blue' : 'ember';
                const scoreClass =
                  pct >= 80
                    ? 'text-gh-brass-600 dark:text-gh-gold-glow'
                    : pct >= 50
                      ? 'text-gh-ink-blue dark:text-gh-ink-blue-50'
                      : 'text-gh-ember';
                return (
                  <button
                    key={entry.id}
                    onClick={() => handleViewHistory(entry)}
                    className="group flex w-full items-center justify-between gap-4 rounded-xl border border-gh-chalk bg-gh-cream/60 p-4 text-left transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:border-gh-ink-blue/20 hover:bg-gh-paper hover:shadow-brand-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gh-ink-blue-50 text-gh-ink-blue dark:bg-white/10 dark:text-gh-gold-glow">
                        {pct >= 80 ? <Trophy size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold tracking-tight text-gh-ink dark:text-gh-cream">
                          {entry.subject.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-xs text-gh-ink-40 dark:text-gh-chalk">
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className={`text-xl font-extrabold tabular-nums ${scoreClass}`}>
                        {pct}%
                      </div>
                      <Badge variant={scoreVariant} size="sm">
                        {entry.score_obtained} / {entry.total_questions} pts
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {!isSimulating && !subjects.length && !error && (
        <Card className="border-gh-chalk bg-gh-paper p-6 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised">
          <SkeletonLines count={4} />
        </Card>
      )}

    </div>
  );
}
