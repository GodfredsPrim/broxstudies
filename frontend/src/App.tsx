import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Gate } from '@/components/Gate'
import { AdminGate } from '@/components/AdminGate'
import { BootGate } from '@/components/BootGate'
import { WelcomeRedirect } from '@/components/routing/RouteGuards'
import { Spinner } from '@/components/ui/Spinner'
import { StartupCupVotePrompt } from '@/components/StartupCupVotePrompt'
import { StartupCupVoteRedirect } from '@/pages/StartupCupVoteRedirect'

const LoginPage = lazy(() => import('@/pages/Login').then(m => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/pages/Signup').then(m => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword').then(m => ({ default: m.ForgotPasswordPage })))
const SettingsPage = lazy(() => import('@/pages/Settings').then(m => ({ default: m.SettingsPage })))
const ActivatePage = lazy(() => import('@/pages/Activate').then(m => ({ default: m.ActivatePage })))
const TrackSelectionPage = lazy(() => import('@/pages/TrackSelection').then(m => ({ default: m.TrackSelectionPage })))
const StudyPage = lazy(() => import('@/pages/Study').then(m => ({ default: m.StudyPage })))
const SourceStudioPage = lazy(() => import('@/pages/SourceStudio').then(m => ({ default: m.SourceStudioPage })))
const AdminPage = lazy(() => import('@/pages/Admin').then(m => ({ default: m.AdminPage })))
const PracticePage = lazy(() => import('@/pages/Practice').then(m => ({ default: m.PracticePage })))
const WassceePage = lazy(() => import('@/pages/Wassce').then(m => ({ default: m.WassceePage })))
const QuizPage = lazy(() => import('@/pages/Quiz').then(m => ({ default: m.QuizPage })))
const NewsPage = lazy(() => import('@/pages/News').then(m => ({ default: m.NewsPage })))
const RankingsPage = lazy(() => import('@/pages/Rankings').then(m => ({ default: m.RankingsPage })))
const LibraryPage = lazy(() => import('@/pages/Library').then(m => ({ default: m.LibraryPage })))
const HistoryPage = lazy(() => import('@/pages/History').then(m => ({ default: m.HistoryPage })))
const LandingPage = lazy(() => import('@/pages/Landing').then(m => ({ default: m.LandingPage })))
const DashboardPage = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.DashboardPage })))
const AnalyticsPage = lazy(() => import('@/pages/Analytics').then(m => ({ default: m.AnalyticsPage })))
const DocsPage = lazy(() => import('@/pages/Docs').then(m => ({ default: m.DocsPage })))
const LearningPage = lazy(() => import('@/pages/Learning').then(m => ({ default: m.LearningPage })))
const NotFoundPage = lazy(() => import('@/pages/stubs').then(m => ({ default: m.NotFoundPage })))

function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner />
    </div>
  )
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export default function App() {
  return (
    <>
      <BootGate>
        <WelcomeRedirect>
          <Routes>
          <Route path="/vote" element={<StartupCupVoteRedirect />} />
          <Route path="/welcome" element={<Lazy><LandingPage /></Lazy>} />

          <Route path="/login" element={<Lazy><LoginPage /></Lazy>} />
          <Route path="/signup" element={<Lazy><SignupPage /></Lazy>} />
          <Route path="/forgot-password" element={<Lazy><ForgotPasswordPage /></Lazy>} />
          <Route
            path="/activate"
            element={
              <Lazy>
                <Gate requireSubscription={false} label="Activate" pitch="Log in to activate your subscription.">
                  <ActivatePage />
                </Gate>
              </Lazy>
            }
          />
          <Route path="/select-track" element={<Lazy><TrackSelectionPage /></Lazy>} />

          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Lazy><DashboardPage /></Lazy>} />
            <Route path="/docs" element={<Lazy><DocsPage /></Lazy>} />
            <Route path="/learning" element={<Lazy><Gate requireSubscription={false} label="Learning Hub" pitch="Sign in to build your adaptive revision plan."><LearningPage /></Gate></Lazy>} />
            <Route index element={<Lazy><StudyPage /></Lazy>} />
            <Route path="/source-studio" element={<Lazy><SourceStudioPage /></Lazy>} />
            <Route
              path="/admin"
              element={
                <Lazy>
                  <AdminGate>
                    <AdminPage />
                  </AdminGate>
                </Lazy>
              }
            />
            <Route
              path="/analytics"
              element={
                <Lazy>
                  <Gate requireSubscription={false} label="Analytics" pitch="Track your performance and get AI recommendations when you sign in.">
                    <AnalyticsPage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/practice"
              element={
                <Lazy>
                  <Gate label="Practice Questions" pitch="Unlimited generated papers, per-question feedback, and full history — yours when you activate.">
                    <PracticePage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/wassce"
              element={
                <Lazy>
                  <Gate label="Likely WASSCE Questions" pitch="Topic-by-topic likelihood scores from years of past-paper analysis — unlock when you activate.">
                    <WassceePage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/quiz"
              element={
                <Lazy>
                  <Gate label="Quiz Challenge" pitch="Host or join live, timed quizzes with classmates. Subscribed students can create rooms.">
                    <QuizPage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/news"
              element={
                <Lazy>
                  <Gate requireSubscription={false} label="News & Updates" pitch="Announcements, competitions, and rewards — open to all signed-in students.">
                    <NewsPage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/rankings"
              element={
                <Lazy>
                  <Gate requireSubscription={false} label="Rankings" pitch="Compare your standing with every other student using BroxStudies.">
                    <RankingsPage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/library"
              element={
                <Lazy>
                  <Gate requireSubscription={false} label="Library" pitch="Browse a premium global library powered by local favorites and OpenLibrary discovery.">
                    <LibraryPage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/history"
              element={
                <Lazy>
                  <Gate requireSubscription={false} label="History" pitch="Your practice sets, exam attempts, and chats — reviewable anytime.">
                    <HistoryPage />
                  </Gate>
                </Lazy>
              }
            />
            <Route
              path="/settings"
              element={
                <Lazy>
                  <Gate requireSubscription={false} label="Settings" pitch="Manage your account.">
                    <SettingsPage />
                  </Gate>
                </Lazy>
              }
            />
          </Route>

          <Route path="/study" element={<Navigate to="/" replace />} />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Lazy><NotFoundPage /></Lazy>} />
          </Routes>
        </WelcomeRedirect>
      </BootGate>
      <StartupCupVotePrompt />
    </>
  )
}
