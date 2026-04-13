import React from 'react'
import './index.css'
import { QuestionGenerator } from './components/QuestionGenerator'
import StudyCoach from './components/StudyCoach'
import LiveQuiz from './components/LiveQuiz'
import { AnalysisDashboard } from './components/AnalysisDashboard'
import ResourceFetcher from './components/ResourceFetcher'
import { questionsAPI } from './services/api'

function App() {
  const [activeTab, setActiveTab] = React.useState('generator')
  const [isExamSimulating, setIsExamSimulating] = React.useState(false)

  // Trigger deferred document loading on app startup
  React.useEffect(() => {
    questionsAPI.loadDeferred().catch(err => {
      console.log('Deferred loading not available or already running:', err)
    })
  }, [])

  return (
    <div className={`app ${isExamSimulating ? 'exam-mode' : ''}`}>
      {!isExamSimulating && (
        <>
          <header className="app-header">
            <h1>Ghana SHS AI Question Generator</h1>
            <p>Generate practice exam questions using AI and past question patterns</p>
          </header>

          <nav className="app-nav">
            <button
              className={`nav-btn ${activeTab === 'generator' ? 'active' : ''}`}
              onClick={() => setActiveTab('generator')}
            >
              Generate Question
            </button>
            <button
              className={`nav-btn ${activeTab === 'study' ? 'active' : ''}`}
              onClick={() => setActiveTab('study')}
            >
              Study with AI
            </button>
            <button
              className={`nav-btn ${activeTab === 'live_quiz' ? 'active' : ''}`}
              onClick={() => setActiveTab('live_quiz')}
            >
              Quiz Challenge
            </button>
            <button
              className={`nav-btn ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              Likely WASSCE Questions
            </button>
            <button
              className={`nav-btn ${activeTab === 'resources' ? 'active' : ''}`}
              onClick={() => setActiveTab('resources')}
            >
              Get Books Here
            </button>
          </nav>
        </>
      )}

      <main className="app-content">
        {activeTab === 'generator' && (
          <QuestionGenerator 
            onSimulationToggle={(val) => setIsExamSimulating(val)} 
            isSimulating={isExamSimulating} 
          />
        )}
        {activeTab === 'study' && <StudyCoach />}
        {activeTab === 'live_quiz' && <LiveQuiz />}
        {activeTab === 'analysis' && <AnalysisDashboard />}
        {activeTab === 'resources' && <ResourceFetcher />}
      </main>

      {!isExamSimulating && (
        <footer className="app-footer">
          <p>Ghana SHS AI Question Generator &copy; 2026</p>
        </footer>
      )}
    </div>
  )
}

export default App
