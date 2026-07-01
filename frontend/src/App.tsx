import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Gate } from '@/components/Gate'
import { AdminGate } from '@/components/AdminGate'
import { BootGate } from '@/components/BootGate'

import { LoginPage } from '@/pages/Login'
import { SignupPage } from '@/pages/Signup'
import { ActivatePage } from '@/pages/Activate'
import { TrackSelectionPage } from '@/pages/TrackSelection'
import { StudyPage } from '@/pages/Study'
import { AdminPage } from '@/pages/Admin'
import { PracticePage } from '@/pages/Practice'
import { WassceePage } from '@/pages/Wassce'
import { QuizPage } from '@/pages/Quiz'
import { NewsPage } from '@/pages/News'
import { RankingsPage } from '@/pages/Rankings'
import { LibraryPage } from '@/pages/Library'
import { HistoryPage } from '@/pages/History'
import { LandingPage } from '@/pages/Landing'
import { DashboardPage } from '@/pages/Dashboard'
import { AnalyticsPage } from '@/pages/Analytics'
import { NotFoundPage } from '@/pages/stubs'

export default function App() {
  return (
    <BootGate>
      <Routes>
        {/* Public marketing landing */}
        <Route path="/welcome" element={<LandingPage />} />

        {/* Public auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/activate"
          element={
            <Gate requireSubscription={false} label="Activate" pitch="Log in to activate your subscription.">
              <ActivatePage />
            </Gate>
          }
        />
        <Route path="/select-track" element={<TrackSelectionPage />} />

        {/* Main app shell */}
        <Route element={<AppShell />}>
          {/* Dashboard is the home for signed-in users */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* AI Tutor */}
          <Route index element={<StudyPage />} />

          {/* Admin dashboard */}
          <Route
            path="/admin"
            element={
              <AdminGate>
                <AdminPage />
              </AdminGate>
            }
          />

          {/* Analytics */}
          <Route
            path="/analytics"
            element={
              <Gate requireSubscription={false} label="Analytics" pitch="Track your performance and get AI recommendations when you sign in.">
                <AnalyticsPage />
              </Gate>
            }
          />

          {/* Auth-gated destinations */}
          <Route
            path="/practice"
            element={
              <Gate label="Practice Questions" pitch="Unlimited generated papers, per-question feedback, and full history — yours when you activate.">
                <PracticePage />
              </Gate>
            }
          />
          <Route
            path="/wassce"
            element={
              <Gate label="Likely WASSCE Questions" pitch="Topic-by-topic likelihood scores from years of past-paper analysis — unlock when you activate.">
                <WassceePage />
              </Gate>
            }
          />
          <Route
            path="/quiz"
            element={
              <Gate label="Quiz Challenge" pitch="Host or join live, timed quizzes with classmates. Subscribed students can create rooms.">
                <QuizPage />
              </Gate>
            }
          />
          <Route
            path="/news"
            element={
              <Gate requireSubscription={false} label="News & Updates" pitch="Announcements, competitions, and rewards — open to all signed-in students.">
                <NewsPage />
              </Gate>
            }
          />
          <Route
            path="/rankings"
            element={
              <Gate requireSubscription={false} label="Rankings" pitch="Compare your standing with every other student using BroxStudies.">
                <RankingsPage />
              </Gate>
            }
          />
          <Route
            path="/library"
            element={
              <Gate requireSubscription={false} label="Library" pitch="Browse a premium global library powered by local favorites and OpenLibrary discovery.">
                <LibraryPage />
              </Gate>
            }
          />
          <Route
            path="/history"
            element={
              <Gate requireSubscription={false} label="History" pitch="Your practice sets, exam attempts, and chats — reviewable anytime.">
                <HistoryPage />
              </Gate>
            }
          />
        </Route>

        {/* Legacy redirects */}
        <Route path="/study" element={<Navigate to="/" replace />} />
        <Route path="/home" element={<Navigate to="/dashboard" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BootGate>
  )
}
