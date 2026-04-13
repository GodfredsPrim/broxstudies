import { useEffect, useState } from 'react';
import { analysisAPI, questionsAPI, ReliabilityResponse, StudentMasteryResponse, TeacherInsightsResponse } from '../services/api';

export function AnalysisDashboard() {
  const [subject, setSubject] = useState('mathematics');
  const [analysis, setAnalysis] = useState<any>(null);
  const [studentId, setStudentId] = useState('student_demo');
  const [mastery, setMastery] = useState<StudentMasteryResponse | null>(null);
  const [teacherInsights, setTeacherInsights] = useState<TeacherInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analysisAPI.analyzePatterns(subject);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      alert('Failed to analyze patterns');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMastery = async () => {
    try {
      const data = await questionsAPI.getStudentMastery(studentId.trim() || 'student_demo');
      setMastery(data);
    } catch (error) {
      console.error('Error loading mastery:', error);
      alert('Failed to load student mastery');
    }
  };

  const handleLoadTeacher = async () => {
    try {
      const data = await questionsAPI.getTeacherInsights(subject);
      setTeacherInsights(data);
    } catch (error) {
      console.error('Error loading teacher insights:', error);
      alert('Failed to load teacher insights');
    }
  };

  // Removed reliability polling

  return (
    <div className="analysis-section">
      <div className="generator-hero">
        <h2>Likely WASSCE Questions: Patterns</h2>
        <p>Explore hidden patterns and frequent topics in past WAEC exams visually to stay ahead of the curve.</p>
      </div>

      <div className="form-group">
        <label htmlFor="analysisSubject">Subject:</label>
        <select
          id="analysisSubject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="mathematics">Mathematics</option>
          <option value="english">English</option>
          <option value="science">Science</option>
          <option value="social_studies">Social Studies</option>
          <option value="ict">ICT</option>
          <option value="electives">Electives</option>
        </select>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="btn-secondary"
      >
        {loading ? 'Analyzing...' : 'Analyze Patterns'}
      </button>

      <div className="form-grid" style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label htmlFor="studentId">Student ID:</label>
          <input
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="student_demo"
          />
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
          <button onClick={handleLoadMastery} className="btn-primary">Load Student Mastery</button>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
          <button onClick={handleLoadTeacher} className="btn-primary">Load Teacher Insights</button>
        </div>
      </div>

      {analysis && (
        <div className="analysis-results">
          <h3>Analysis Results for {analysis.subject}</h3>

          <div className="result-card">
            <h4>Questions Analyzed</h4>
            <p className="result-value">{analysis.total_past_questions_analyzed}</p>
          </div>

          <div className="result-card">
            <h4>Common Topics</h4>
            <ul>
              {analysis.common_topics.map((topic: string, i: number) => (
                <li key={i}>{topic}</li>
              ))}
            </ul>
          </div>

          <div className="result-card">
            <h4>Difficulty Distribution</h4>
            <div className="stats">
              <p>Easy: {analysis.difficulty_distribution.easy || 0}%</p>
              <p>Medium: {analysis.difficulty_distribution.medium || 0}%</p>
              <p>Hard: {analysis.difficulty_distribution.hard || 0}%</p>
            </div>
          </div>

          <div className="result-card">
            <h4>Question Patterns</h4>
            <pre>{JSON.stringify(analysis.question_patterns, null, 2)}</pre>
          </div>
        </div>
      )}

      {mastery && (
        <div className="analysis-results">
          <h3>Student Mastery</h3>
          <div className="result-card">
            <h4>Streak</h4>
            <p className="result-value">{mastery.streak}</p>
          </div>
          <div className="result-card">
            <h4>Subject Performance</h4>
            <pre>{JSON.stringify(mastery.subjects, null, 2)}</pre>
          </div>
        </div>
      )}

      {teacherInsights && (
        <div className="analysis-results">
          <h3>Teacher Insights</h3>
          <div className="result-card">
            <p><strong>Subject:</strong> {teacherInsights.subject}</p>
            <p><strong>Students With Attempts:</strong> {teacherInsights.students_with_attempts}</p>
            <p><strong>Average Latest Score:</strong> {teacherInsights.average_latest_score}%</p>
            <p><strong>At Risk Students:</strong> {teacherInsights.at_risk_students}</p>
            <p><strong>Intervention:</strong> {teacherInsights.recommended_intervention}</p>
          </div>
        </div>
      )}

      {/* System Reliability section removed */}
    </div>
  );
}
