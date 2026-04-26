export interface AuthUser {
  id: number
  email: string
  full_name?: string | null
  is_verified?: boolean
  has_access?: boolean
  subscription_status?: string
  is_admin?: boolean
  created_at?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface AuthConfigResponse {
  google_client_id?: string | null
  access_code_length?: number
  allow_free_trial?: boolean
  signup_open?: boolean
}

export interface Subject {
  id: string
  name: string
  year: string
}

export interface SubjectsResponse {
  subjects: Subject[]
}

export interface ResourceSubject {
  name: string
  url: string
}

export interface AvailableResourcesResponse {
  status: string
  data: Record<string, ResourceSubject[]>
  available_years: string[]
  total_subjects_by_year: Record<string, number>
}

export interface Book {
  id: string
  title: string
  author: string
  category: 'novel' | 'storybook' | 'entrepreneur' | 'subject' | 'african' | 'ghanaian' | string
  rating: number
  cover_url?: string
  description: string
  pages?: number
  isbn?: string
  publication_year?: string
  source?: string
}

export interface BookQuizQuestion {
  question: string
  type: 'multiple_choice' | 'short_answer' | 'true_false' | string
  options?: string[]
  answer?: string
}

export interface BookQuizResponse {
  book_id: string
  title: string
  questions: BookQuizQuestion[]
  source?: string
}

export interface Question {
  question_text: string
  question_type: 'multiple_choice' | 'essay' | 'short_answer' | 'true_false' | string
  options?: string[]
  correct_answer?: string
  explanation?: string
  difficulty_level?: string
  pattern_confidence?: number
  topic?: string
}

export interface GeneratedQuestions {
  questions: Question[]
  generation_time: number
  source_used?: string
  organized_papers?: Record<string, Question[]>
}

export interface DocumentStatus {
  status: 'loaded' | 'not_loaded' | 'loading' | string
  documents?: Record<string, any>
  message?: string
}

export interface LoadingProgress {
  is_loading: boolean
  progress_percentage: number
  current_file?: string | null
  loaded_count?: number
  total_count?: number
  remaining?: number
  category?: string
}

export interface ExamHistoryEntry {
  id: number
  exam_type: string
  subject: string
  score_obtained: number
  total_questions: number
  percentage: number
  created_at: string
  details_json?: string
}

export interface LeaderboardEntry {
  rank: number
  player_name: string
  total_points: number
  is_online?: boolean
}

export interface TutorResponse {
  explanation: string
  related_questions?: string[]
  sources?: string[]
}

export interface LiveQuizCreateResponse {
  code: string
  host_player: string
  total_questions: number
}

export interface LiveQuizPlayer {
  player: string
  submitted: boolean
  score: number
  percentage: number
}

export interface LiveQuizStateResponse {
  code: string
  host: string
  questions: Question[]
  leaderboard: LiveQuizPlayer[]
  time_limit: number
  created_at: number
}

export interface LiveQuizSubmitResponse {
  status: string
  result: PracticeMarkResponse
}

export interface PracticeMarkResponse {
  percentage: number
  score_obtained: number
  total_questions: number
  results: Array<{
    is_correct: boolean
    score: number
    feedback: string
  }>
}

/* ------------------------------ ADMIN ------------------------------ */
export interface AdminAnalytics {
  total_users: number
  active_subscriptions: number
  expiring_subscriptions: number
  total_revenue_ghs: number
  total_codes_generated: number
  total_codes_used: number
  recent_activity: Array<Record<string, unknown>>
}

export interface PendingPayment {
  id: number
  user_id: number
  full_name?: string
  email?: string
  momo_name?: string
  momo_number?: string
  reference?: string
  status: string
  created_at: string
}

export interface AccessCodeRecord {
  code: string
  duration_months: number
  created_at: string
}

export interface Competition {
  id: number
  title: string
  description: string
  prize: string
  start_date: string
  end_date: string
  is_active: boolean
  quiz_json?: string | null
  pdf_url?: string | null
  image_url?: string | null
  created_at: string
}

export interface CompetitionCreateBody {
  title: string
  description: string
  prize: string
  start_date: string
  end_date: string
  quiz_json?: string | null
  pdf_url?: string | null
}
