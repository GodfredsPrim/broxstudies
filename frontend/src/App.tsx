import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Gate } from '@/components/Gate'
import { AdminGate } from '@/components/AdminGate'
import { BootGate } from '@/components/BootGate'

import { LoginPage } from '@/pages/Login'
import { SignupPage } from '@/pages/Signup'
import { ActivatePage } from '@/pages/Activate'
import { StudyPage } from '@/pages/Study'
import { AdminPage } from '@/pages/Admin'
import { PracticePage } from '@/pages/Practice'
import { WassceePage } from '@/pages/Wassce'
import { QuizPage } from '@/pages/Quiz'
import { NewsPage } from '@/pages/News'
import { RankingsPage } from '@/pages/Rankings'
import { LibraryPage } from '@/pages/Library'
import { HistoryPage } from '@/pages/History'
import { NotFoundPage } from '@/pages/stubs'

export default function App() {
  return (
    <BootGate>
      <Routes>
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

        {/* Main app shell */}
        <Route element={<AppShell />}>
          {/* Study is the landing page — open to guests with a 3-chat meter */}
          <Route index element={<StudyPage />} />

          {/* Admin dashboard — access-code gate (POST /api/admin/login-secret) */}
          <Route
            path="/admin"
            element={
              <AdminGate>
                <AdminPage />
              </AdminGate>
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
              <Gate requireSubscription={false} label="Library" pitch="Browse a premium global library powered by local favorites and OpenLibrary discovery. Find Ghanaian classics, global bestsellers, study guides, and post-reading quizzes.">
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

        {/* Old paths that existed in slice 1 → send to Study */}
        <Route path="/study" element={<Navigate to="/" replace />} />
        <Route path="/home" element={<Navigate to="/" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BootGate>
  )
}
