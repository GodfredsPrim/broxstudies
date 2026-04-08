import { useState, useEffect } from 'react';
import axios from 'axios';
import { questionsAPI, Question, GeneratedQuestions } from '../services/api';

interface Subject {
  id: string;
  name: string;
  year: string;
}

export function QuestionGenerator() {
  const [subject, setSubject] = useState('mathematics');
  const [selectedYear, setSelectedYear] = useState('Year 1');
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
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

  return (
    <div className="generator-section">
      <div className="generator-hero">
        <h2>Practice Like Exam Day</h2>
        <p>
          Pick your year and subject. We fetch resources on-demand and generate realistic prep questions.
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
            max="20"
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
      </div>

      <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
        <button
          onClick={handleGenerate}
          disabled={loading || loadingSubjects}
          className="btn-primary"
        >
          {loading ? 'Generating Questions...' : 'Generate Questions'}
        </button>
      </div>

      {generationTime > 0 && (
        <div className="info generation-summary">
          <span>Generated {questions.length} questions in {generationTime.toFixed(2)}s</span>
          {generationMeta?.source_used && (
            <span className={`source-badge source-${generationMeta.source_used.replace(/\+/g, '_').replace(/[^a-z_]/g, '')}`}>
              Source: {generationMeta.source_used.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      <div className="questions-list">
        {questions.map((q, index) => (
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

            <div className="answer-section">
              <p><strong>Answer:</strong> {q.correct_answer}</p>
              <p><strong>Explanation:</strong> {q.explanation}</p>
              <p><small>Difficulty: {q.difficulty_level} | Confidence: {(q.pattern_confidence * 100).toFixed(0)}%</small></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

