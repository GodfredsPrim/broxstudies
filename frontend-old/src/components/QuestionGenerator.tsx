import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Clock, Brain, FileText, Zap, Printer, History, ShieldCheck, Trophy, EyeOff, Eye } from 'lucide-react';
import { questionsAPI, Question, GeneratedQuestions } from '../services/api';
import MathRenderer from './MathRenderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonLines } from '@/components/ui/skeleton';
import { SankofaIcon, AdinkraWatermark } from '@/components/ui/adinkra';

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
    <Card className="relative overflow-hidden border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <History className="h-5 w-5 text-gh-ink-blue dark:text-gh-gold-glow" />
        <h3 className="text-lg font-bold tracking-tight text-gh-ink dark:text-gh-cream sm:text-xl">
          Past Practices
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
            title="No practice history yet"
            description="Sankofa — go back and fetch it. Submit a practice paper to start tracking your growth."
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
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-gh-chalk bg-gh-cream/60 p-4 text-left transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:border-gh-ink-blue/20 hover:bg-gh-paper hover:shadow-brand-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gh-ink-blue-50 text-gh-ink-blue transition-colors group-hover:bg-gh-ink-blue group-hover:text-white dark:bg-white/10 dark:text-gh-gold-glow">
                    {pct >= 80 ? <Trophy size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold uppercase tracking-wide text-gh-ink dark:text-gh-cream sm:text-base">
                      {entry.subject.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gh-ink-40 dark:text-gh-chalk">
                      <Badge variant="outline" size="sm" className="capitalize">
                        {entry.exam_type.replace(/_/g, ' ')}
                      </Badge>
                      <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className={`text-xl font-extrabold tabular-nums ${scoreClass} sm:text-2xl`}>
                    {pct.toFixed(0)}%
                  </div>
                  <Badge variant={scoreVariant} size="sm">
                    {entry.score_obtained}/{entry.total_questions}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );


  if (showHistoryOnly) {
    return (
      <div className="generator-shell">
        <SectionHeader
          eyebrow="Your Journey"
          title="Activity History"
          description="Review your past performance and track your growth over time."
          actions={
            <Badge variant="blue" size="lg" className="gap-1.5">
              <Clock size={14} /> {examHistory.length} Session{examHistory.length === 1 ? '' : 's'}
            </Badge>
          }
        />
        {renderHistory()}
      </div>
    );
  }

  return (
    <div className={`generator-shell ${isSimulating ? 'generator-shell--simulating' : ''}`}>
      <SectionHeader
        eyebrow={isSimulating ? 'Restricted Mode' : 'Practice'}
        title={
          isSimulating ? (
            <span className="flex items-center gap-3">
              <Shield className="h-7 w-7 text-gh-ember" />
              Exam in Progress
            </span>
          ) : (
            'Question Generator'
          )
        }
        description={
          isSimulating
            ? 'Navigation locked. Complete the session to exit fullscreen.'
            : 'Master your exams with AI-powered practice sets built from the Ghana curriculum.'
        }
        actions={
          !isSimulating ? (
            <Button
              onClick={handleGenerate}
              disabled={loading || loadingSubjects}
              size="lg"
              className="gap-2"
            >
              <Brain size={18} />
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          ) : null
        }
      />

      {error && !loading && (
        <ErrorState
          size="sm"
          title="Couldn't load questions"
          description={error}
          onRetry={handleGenerate}
          retryLabel="Try again"
        />
      )}

      {loadingSubjects && !error && (
        <Card className="border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised">
          <SkeletonLines count={3} />
        </Card>
      )}

      {isSimulating ? (
        <Card className="flex flex-col gap-3 border-gh-chalk bg-gh-paper p-4 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gh-ink dark:text-gh-cream">
            <span><strong className="text-gh-ink-60 dark:text-gh-chalk">Subject:</strong> {filteredSubjects.find(s => s.id === subject)?.name || subject}</span>
            <span><strong className="text-gh-ink-60 dark:text-gh-chalk">Answered:</strong> {Object.keys(studentAnswers).length} / {questions.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft !== null && (
              <Badge
                variant={timeLeft < 60 ? 'ember' : 'neutral'}
                size="lg"
                className={`gap-1.5 tabular-nums ${timeLeft < 60 ? 'animate-pulse' : ''}`}
              >
                <Clock size={14} />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </Badge>
            )}
            <Button
              onClick={submitExamGrading}
              disabled={isSubmitting}
              size="sm"
              className="gap-2"
            >
              {isSubmitting ? 'Grading…' : <><Zap size={16} /> Submit</>}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {examResult && (
            <Card className="relative overflow-hidden border-transparent bg-gradient-to-br from-gh-ink-blue to-gh-ink-blue-600 p-6 text-center text-white shadow-brand-lg sm:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gh-brass/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 blur-3xl"
              />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <Badge variant="brass" size="md" className="gap-1.5 bg-gh-brass/20 text-gh-gold-glow">
                  <Trophy size={12} /> Practice Complete
                </Badge>
                <div className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-6xl font-black leading-none tracking-tight text-transparent sm:text-7xl">
                  {examResult.percentage.toFixed(0)}%
                </div>
                <p className="text-sm text-white/85 sm:text-base">
                  You scored <strong>{examResult.score_obtained}</strong> out of <strong>{examResult.total_questions}</strong>
                </p>
                <Button
                  onClick={() => { setQuestions([]); setExamResult(null); }}
                  size="lg"
                  className="gap-2 border-transparent bg-gh-brass text-white shadow-brand-md hover:bg-gh-brass-600"
                >
                  <Brain size={18} /> Start New Session
                </Button>
              </div>
            </Card>
          )}

          <Card className="border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-7">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Year / Level
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  disabled={loadingSubjects || availableYears.length === 0}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={loadingSubjects}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  {filteredSubjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>{subj.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Format
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="essay">Structured Essay</option>
                  <option value="standard">Full WASSCE Mock</option>
                  <option value="professional">Professional Layout</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value) || 1)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  <option value="easy">Beginner</option>
                  <option value="medium">Standard</option>
                  <option value="hard">Advanced</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  <option value="all_year">Full Year</option>
                  <option value="semester_1">Semester 1</option>
                  <option value="semester_2">Semester 2</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gh-chalk pt-5 dark:border-white/10">
              <Button
                onClick={startSimulation}
                disabled={loading || loadingSubjects}
                variant="secondary"
                size="lg"
                className="gap-2"
              >
                <ShieldCheck size={18} />
                Start Restricted Mock
              </Button>
              <span className="text-xs text-gh-ink-40 dark:text-gh-chalk">
                Locks the tab in fullscreen and auto-submits on exit.
              </span>
            </div>
          </Card>
        </>
      )}

      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => { setShowAnswers(!showAnswers); setIsPrintAnswerSheet(false); }}
            variant={showAnswers ? 'outline' : 'secondary'}
            size="default"
            className="gap-2"
          >
            {showAnswers ? <><EyeOff size={16} /> Hide Answers</> : <><Eye size={16} /> Show Answers</>}
          </Button>
          <Button
            onClick={() => { setIsPrintAnswerSheet(false); setTimeout(() => window.print(), 100); }}
            variant="outline"
            size="default"
            className="gap-2"
          >
            <Printer size={16} /> Print Paper
          </Button>
          <Button
            onClick={() => { setIsPrintAnswerSheet(true); setShowAnswers(false); setTimeout(() => window.print(), 100); }}
            variant="outline"
            size="default"
            className="gap-2"
          >
            <FileText size={16} /> Answer Sheet
          </Button>
        </div>
      )}

      {generationTime > 0 && !isSimulating && !isPrintAnswerSheet && (
        <Card className="flex flex-col items-start gap-2 border-gh-ink-blue/20 bg-gh-ink-blue-50 p-4 text-sm text-gh-ink-blue dark:border-white/10 dark:bg-white/5 dark:text-gh-ink-blue-50 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold">
            {questions.length} question{questions.length === 1 ? '' : 's'} generated by AI in {generationTime.toFixed(1)}s
          </span>
          {generationMeta?.source_used && (
            <Badge variant="blue" size="md">
              Using: {generationMeta.source_used.replace(/_/g, ' ')}
            </Badge>
          )}
        </Card>
      )}

      {isPrintAnswerSheet && (
         <div className="text-center p-6 border-b-2 border-black">
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
