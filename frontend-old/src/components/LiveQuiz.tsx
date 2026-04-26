import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Zap,
  Search,
  Copy,
  CheckCircle2,
  Play,
  LogOut,
  User,
  BarChart3,
  Timer,
  Trophy,
  Crown,
} from 'lucide-react';
import { LiveQuizStateResponse, PracticeMarkResponse, questionsAPI } from '../services/api';
import MathRenderer from './MathRenderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section';
import { ErrorState } from '@/components/ui/error-state';

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
  const [codeInput, setCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [state, setState] = useState<LiveQuizStateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<PracticeMarkResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLimit, setTimeLimit] = useState(5);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [semester, setSemester] = useState('all_year');
  const [copied, setCopied] = useState(false);

  const years = useMemo(() => {
    const y = Array.from(new Set(subjects.map((s) => s.year))).sort();
    if (y.length > 0 && !y.includes('Year 3')) y.push('Year 3');
    return y;
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    if (selectedYear === 'Year 3') {
      return Array.from(new Map(subjects.map(s => [s.name, s])).values());
    }
    return subjects.filter((s) => s.year === selectedYear);
  }, [subjects, selectedYear]);

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
    if (first && !filteredSubjects.some(s => s.id === subject)) setSubject(first.id);
  }, [selectedYear, filteredSubjects, subject]);

  useEffect(() => {
    if (!roomCode) return;
    const poll = setInterval(async () => {
      try {
        const latest = await questionsAPI.getLiveQuizState(roomCode);
        setState(latest);

        const me = latest.leaderboard.find(p => p.player.toLowerCase() === playerName.toLowerCase());
        if (me?.submitted && !result) {
          setResult({
            percentage: me.percentage,
            score_obtained: me.score,
            total_questions: latest.questions.length,
            results: []
          });
        }
      } catch {
        // silent during polling
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [roomCode, playerName, result]);

  useEffect(() => {
    if (!state || result) {
      setTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const elapsed = now - state.created_at;
      const remaining = Math.max(0, (state.time_limit * 60) - elapsed);
      setTimeLeft(Math.floor(remaining));

      if (remaining <= 0 && !result && !loading) {
        clearInterval(timer);
        submitQuiz();
      }
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, result, loading]);

  const createRoom = async () => {
    setError('');
    if (!playerName.trim()) return setError('Enter your name first.');
    setLoading(true);
    try {
      const created = await questionsAPI.createLiveQuiz({
        player_name: playerName.trim(),
        subject,
        year: selectedYear,
        question_type: 'multiple_choice',
        num_questions: 5,
        difficulty_level: difficulty,
        time_limit: timeLimit,
        semester,
      });
      setRoomCode(created.code);
      const latest = await questionsAPI.getLiveQuizState(created.code);
      setState(latest);
      setAnswers({});
      setResult(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to create quiz room.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    setError('');
    if (!playerName.trim()) return setError('Enter your name first.');
    if (!codeInput.trim()) return setError('Enter the room code.');
    setLoading(true);
    try {
      const code = codeInput.trim().toUpperCase();
      await questionsAPI.joinLiveQuiz(code, playerName.trim());
      setRoomCode(code);
      const latest = await questionsAPI.getLiveQuizState(code);
      setState(latest);
      setResult(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to join quiz room.';
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

      try {
        await questionsAPI.saveExamHistory({
          exam_type: 'challenge_quiz',
          subject: subject,
          score_obtained: submitted.result.score_obtained,
          total_questions: submitted.result.total_questions,
          percentage: submitted.result.percentage,
          details_json: JSON.stringify(submitted.result.results || [])
        });
      } catch (historyErr) {
        console.warn('Failed to save challenge history:', historyErr);
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.detail || err.message) : 'Failed to submit quiz score.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`generator-shell ${roomCode ? 'generator-shell--simulating' : ''}`}>
      {!roomCode ? (
        <>
          <SectionHeader
            eyebrow="Challenge Quiz"
            title="Host or Join a Live Room"
            description="Create a real-time quiz room for your classmates or join one with a code. Best of 5 questions, timed, scored instantly."
            actions={
              <Badge variant="brass" size="lg" className="gap-1.5">
                <Zap size={14} /> Live
              </Badge>
            }
          />

          {error && (
            <div>
              <ErrorState
                size="sm"
                title="Couldn't continue"
                description={error}
                onRetry={() => setError('')}
                retryLabel="Dismiss"
              />
            </div>
          )}

          {/* Configuration card */}
          <Card className="border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-7">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gh-ink-blue-50 text-gh-ink-blue dark:bg-white/5 dark:text-gh-gold-glow">
                <User size={16} />
              </div>
              <h3 className="text-base font-bold tracking-tight text-gh-ink dark:text-gh-cream">
                Set up your room
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Display Name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gh-ink-40 dark:text-gh-chalk" size={16} />
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your display name…"
                    className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper pl-10 pr-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Academic Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  {filteredSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
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
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Time Limit (mins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value) || 1)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                  Semester Selection
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gh-chalk bg-gh-paper px-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                >
                  <option value="all_year">Full Year (Recommended)</option>
                  <option value="semester_1">First Semester (Sem 1)</option>
                  <option value="semester_2">Second Semester (Sem 2)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Join / Host split */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-4 border border-dashed border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-7">
              <div>
                <Badge variant="blue" size="sm" className="mb-3">Join Existing</Badge>
                <h3 className="text-lg font-extrabold tracking-tight text-gh-ink dark:text-gh-cream sm:text-xl">
                  Got a room code?
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-gh-ink-60 dark:text-gh-chalk">
                  Enter the 4–6 character code your classmate shared to jump straight in.
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gh-ink-40 dark:text-gh-chalk" size={18} />
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="h-12 w-full rounded-xl border border-gh-chalk bg-gh-paper pl-11 pr-4 text-center text-lg font-black tracking-[0.3em] text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream"
                />
              </div>

              <Button onClick={joinRoom} disabled={loading} size="lg" variant="outline" className="gap-2">
                {loading ? 'Joining…' : (<><LogOut className="rotate-180" size={16} /> Join Room</>)}
              </Button>
            </Card>

            <Card className="flex flex-col gap-4 border-gh-ink-blue/30 bg-gradient-to-br from-gh-ink-blue to-gh-ink-blue-600 p-5 text-white shadow-brand-md dark:border-gh-gold-glow/30 sm:p-7">
              <div>
                <Badge variant="brass" size="sm" className="mb-3">Host New</Badge>
                <h3 className="text-lg font-extrabold tracking-tight sm:text-xl">
                  Host a new quiz room
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-white/80">
                  Share the code with friends, race against the clock, and climb the live leaderboard.
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs font-bold text-white/80">
                <Badge variant="outline" size="sm" className="border-white/20 bg-white/10 text-white">
                  5 Questions
                </Badge>
                <Badge variant="outline" size="sm" className="border-white/20 bg-white/10 text-white">
                  {timeLimit} min timer
                </Badge>
                <Badge variant="outline" size="sm" className="border-white/20 bg-white/10 text-white capitalize">
                  {difficulty}
                </Badge>
              </div>

              <Button
                onClick={createRoom}
                disabled={loading}
                size="lg"
                className="gap-2 border-transparent bg-gh-brass text-white shadow-brand-md hover:bg-gh-brass-600"
              >
                {loading ? 'Creating…' : (<><Play size={16} fill="currentColor" /> Host New Room</>)}
              </Button>
            </Card>
          </div>
        </>
      ) : (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          {/* In-room sticky bar */}
          <div className="sim-exit-bar glass-card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl bg-gh-ink px-4 py-2 text-white">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Room</span>
                <span className="text-lg font-black tracking-[0.25em]">{roomCode}</span>
                <button
                  onClick={copyRoomCode}
                  aria-label="Copy room code"
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
              {state && (
                <Badge variant="neutral" size="md" className="gap-1.5">
                  <User size={12} /> {state.leaderboard.length} players
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {timeLeft !== null && (
                <Badge
                  variant={timeLeft < 60 ? 'ember' : 'blue'}
                  size="lg"
                  className={`gap-1.5 tabular-nums ${timeLeft < 60 ? 'animate-pulse' : ''}`}
                >
                  <Timer size={14} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRoomCode(''); setState(null); setResult(null); }}
                className="gap-2 border-gh-ember/20 text-gh-ember hover:bg-gh-ember-50 hover:text-gh-ember"
              >
                <LogOut size={14} /> Leave
              </Button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Questions */}
            <div className="space-y-6 lg:col-span-8">
              {state?.questions.map((q, idx) => (
                <div key={idx} className="question-card glass-card">
                  <div className="question-card__header">
                    <span className="question-card__number">Question {idx + 1}</span>
                    <span className="question-card__type">Multiple Choice</span>
                  </div>

                  <div className="question-card__body">
                    <div className="question-card__text">
                      <MathRenderer text={q.question_text} />
                    </div>

                    {q.options ? (
                      <div className="options-grid">
                        {q.options.map((opt, i) => {
                          const letter = String.fromCharCode(65 + i);
                          const isSelected = answers[idx] === opt;
                          const cleanedOpt = opt.replace(/^(Option\s+[A-D][:.]\s*|[A-D][:.]\s*)/i, '').trim();
                          return (
                            <label key={i} className={`option-item ${isSelected ? 'option-item--selected' : ''}`}>
                              <input
                                type="radio"
                                name={`quiz-q-${idx}`}
                                checked={isSelected}
                                onChange={() => setAnswers(prev => ({ ...prev, [idx]: opt }))}
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
                        rows={4}
                        className="essay-input"
                        value={answers[idx] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Type your answer here..."
                      />
                    )}
                  </div>
                </div>
              ))}

              {!result ? (
                <Button
                  onClick={submitQuiz}
                  disabled={loading}
                  size="lg"
                  className="mx-auto w-full max-w-md gap-2"
                >
                  {loading ? 'Submitting…' : (<><CheckCircle2 size={18} /> Submit Final Answers</>)}
                </Button>
              ) : (
                <div className="generator-result glass-card">
                  <div className="result-content">
                    <span className="result-label">Quiz Complete</span>
                    <h1 className="result-percentage">{result.percentage}%</h1>
                    <p className="result-summary">
                      Score: <strong>{result.score_obtained}</strong> / {result.total_questions}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Live leaderboard */}
            <div className="lg:col-span-4">
              <div className="sticky top-24">
                <Card className="border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                      <BarChart3 size={14} /> Live Leaderboard
                    </div>
                    {state && state.leaderboard.length > 0 && (
                      <Badge variant="blue" size="sm">
                        {state.leaderboard.filter(r => r.submitted).length}/{state.leaderboard.length} done
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    {state?.leaderboard.map((row, idx) => {
                      const isMe = row.player.toLowerCase() === playerName.toLowerCase();
                      const isTop3 = idx < 3;
                      return (
                        <div
                          key={row.player}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all sm:p-4 ${
                            isMe
                              ? 'border-gh-ink-blue/30 bg-gh-ink-blue-50 shadow-brand-sm dark:border-gh-gold-glow/30 dark:bg-white/5'
                              : 'border-gh-chalk bg-gh-cream/60 dark:border-white/10 dark:bg-white/5'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${
                                idx === 0
                                  ? 'bg-gh-brass text-white'
                                  : isTop3
                                    ? 'bg-gh-ink-blue text-white'
                                    : 'bg-gh-paper text-gh-ink-60 dark:bg-white/10 dark:text-gh-chalk'
                              }`}
                            >
                              {idx === 0 ? <Crown size={14} /> : idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`truncate text-sm font-bold tracking-tight ${
                                  isMe ? 'text-gh-ink-blue dark:text-gh-gold-glow' : 'text-gh-ink dark:text-gh-cream'
                                }`}
                              >
                                {row.player}
                                {isMe && <span className="ml-1 text-[10px] font-black uppercase">(you)</span>}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            {row.submitted ? (
                              <span className="text-sm font-black tabular-nums text-gh-brass-600 dark:text-gh-gold-glow">
                                {row.percentage}%
                              </span>
                            ) : (
                              <span className="text-xs font-bold uppercase tracking-widest text-gh-ink-40 animate-pulse dark:text-gh-chalk">
                                Solving…
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {(!state || state.leaderboard.length === 0) && (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gh-chalk py-6 text-xs font-bold text-gh-ink-40 dark:border-white/10 dark:text-gh-chalk">
                        <Trophy size={14} /> Waiting for players…
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveQuiz;
