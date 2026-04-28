import { api } from './client'
import type {
  AccessCodeRecord,
  AdminAnalytics,
  AuthConfigResponse,
  AuthResponse,
  AuthUser,
  Book,
  BookQuizResponse,
  Competition,
  CompetitionCreateBody,
  DocumentStatus,
  ExamHistoryEntry,
  GeneratedQuestions,
  AvailableResourcesResponse,
  LeaderboardEntry,
  LiveQuizCreateResponse,
  LiveQuizStateResponse,
  LiveQuizSubmitResponse,
  LoadingProgress,
  PendingPayment,
  PracticeMarkResponse,
  SubjectsResponse,
  TutorResponse,
} from './types'

/* ------------------------------ AUTH ------------------------------ */
export const authApi = {
  config: () => api.get<AuthConfigResponse>('/api/auth/config').then(r => r.data),
  signup: (body: { email: string; password: string; full_name?: string }) =>
    api.post<AuthResponse>('/api/auth/signup', body).then(r => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/login', body).then(r => r.data),
  google: (body: { credential: string }) =>
    api.post<AuthResponse>('/api/auth/google', body).then(r => r.data),
  me: () => api.get<AuthUser>('/api/auth/me').then(r => r.data),
  verifyCode: (code: string) =>
    api.post<AuthUser>('/api/auth/verify-code', { code }).then(r => r.data),
  subscription: () =>
    api.get<{ has_access: boolean; subscription_status: string }>('/api/auth/subscription').then(r => r.data),
  adminLogin: (secret: string) =>
    api.post<AuthResponse>('/api/admin/login-secret', { secret }).then(r => r.data),
}

/* ------------------------------ SYSTEM ------------------------------ */
export const systemApi = {
  health: () => api.get<{ status: string }>('/health').then(r => r.data),
  documents: () => api.get<DocumentStatus>('/api/status/documents').then(r => r.data),
  loadingProgress: () =>
    api.get<LoadingProgress>('/api/questions/loading-progress').then(r => r.data),
  uploadStatus: () =>
    api.get<Record<string, any>>('/api/uploads/status').then(r => r.data),
}

/* ------------------------------ QUESTIONS ------------------------------ */
export interface GenerateQuestionBody {
  subject: string
  year: string
  question_type: string
  num_questions: number
  difficulty_level: string
  topics?: string[]
  semester?: string
}

export const questionsApi = {
  subjects: () => api.get<SubjectsResponse>('/api/questions/subjects').then(r => r.data),
  questionTypes: () => api.get<{ types: string[] }>('/api/questions/question-types').then(r => r.data),
  generate: (body: GenerateQuestionBody) =>
    api.post<GeneratedQuestions>('/api/questions/generate', body, { timeout: 600_000 }).then(r => r.data),
  generateProfessional: (subject: string, year: string) =>
    api.post<GeneratedQuestions>(
      '/api/questions/generate-professional',
      {
        subject,
        year,
        question_type: 'standard',
        num_questions: 46,
        difficulty_level: 'medium',
      },
      { timeout: 600_000 },
    ).then(r => r.data),
  markPractice: (    items: Array<{
      question_text: string
      question_type: string
      correct_answer?: string
      explanation?: string
      options?: string[]
      student_answer: string
    }>,
    user: string,
    subject: string,
  ) =>
    api
      .post<PracticeMarkResponse>('/api/questions/mark-practice', { items, user, subject })
      .then(r => r.data),
  examHistory: () =>
    api.get<ExamHistoryEntry[]>('/api/questions/history/exams').then(r => r.data),
  saveExamHistory: (body: Omit<ExamHistoryEntry, 'id' | 'created_at'>) =>
    api.post('/api/questions/history/exams', body).then(r => r.data),
}

export const liveQuizApi = {
  create: (body: {
    player_name: string
    subject: string
    year?: string
    question_type: string
    num_questions: number
    difficulty_level: string
    time_limit: number
    semester?: string
  }) => api.post<LiveQuizCreateResponse>('/api/questions/quiz/create', body).then(r => r.data),

  join: (code: string, playerName: string) =>
    api.post<{ status: string; code: string; player_name: string }>('/api/questions/quiz/join', {
      code,
      player_name: playerName,
    }).then(r => r.data),

  state: (code: string) =>
    api.get<LiveQuizStateResponse>(`/api/questions/quiz/${encodeURIComponent(code)}/state`).then(r => r.data),

  submit: (code: string, playerName: string, answers: string[]) =>
    api.post<LiveQuizSubmitResponse>(`/api/questions/quiz/${encodeURIComponent(code)}/submit`, {
      player_name: playerName,
      answers,
    }).then(r => r.data),
}

/* ------------------------------ TUTOR ------------------------------ */
export const tutorApi = {
  ask: (body: {
    question: string
    subject?: string
    is_main_concept_only?: boolean
    history?: Array<{ role: 'user' | 'ai'; content: string }>
  }) => api.post<TutorResponse>('/api/tutor/ask', body).then(r => r.data),
  history: (limit = 60) =>
    api
      .get<{ messages: Array<{ id: number; role: 'user' | 'ai'; content: string; created_at: string }> }>(
        '/api/tutor/history',
        { params: { limit } },
      )
      .then(r => r.data),
}

/* ------------------------------ RESOURCES ------------------------------ */
export const resourcesApi = {
  available: () =>
    api.get<AvailableResourcesResponse>('/api/resources/available-resources').then(r => r.data),
  fetchStatus: () =>
    api.get<Record<string, any>>('/api/resources/fetch-curriculum-resources/status').then(r => r.data),
}

export const libraryApi = {
  search: (query?: string, category?: string) =>
    api.get<Book[]>('/api/books/search', { params: { query, category } }).then(r => r.data),
  getBook: (id: string) => api.get<Book>(`/api/books/${encodeURIComponent(id)}`).then(r => r.data),
  quiz: (body: { book_id: string; num_questions?: number }) =>
    api.post<BookQuizResponse>('/api/books/quiz', body).then(r => r.data),
}

/* ------------------------------ COMPETITIONS ------------------------------ */
export const competitionsApi = {
  list: () => api.get<Competition[]>('/api/admin/competitions').then(r => r.data),
  leaderboard: () => api.get<LeaderboardEntry[]>('/api/admin/leaderboard').then(r => r.data),
  register: (compId: number) =>
    api.post<{ status: string }>(`/api/admin/competitions/${compId}/register`).then(r => r.data),
}
export const analysisApi = {
  patterns: (subject: string) =>
    api.get<Record<string, any>>(`/api/analysis/patterns/${encodeURIComponent(subject)}`).then(r => r.data),
  topics: (subject: string) =>
    api.get<Record<string, any>>(`/api/analysis/topics/${encodeURIComponent(subject)}`).then(r => r.data),
}

/* ------------------------------ ADMIN ------------------------------ */
export const adminApi = {
  analytics: () =>
    api.get<AdminAnalytics>('/api/admin/analytics').then(r => r.data),

  pendingPayments: () =>
    api.get<PendingPayment[]>('/api/admin/payments/pending').then(r => r.data),
  confirmPayment: (id: number) =>
    api.post<{ status: string }>(`/api/admin/payments/${id}/confirm`).then(r => r.data),
  rejectPayment: (id: number) =>
    api.post<{ status: string }>(`/api/admin/payments/${id}/reject`).then(r => r.data),

  codeInventory: () =>
    api.get<AccessCodeRecord[]>('/api/admin/coupons/inventory').then(r => r.data),
  generateCodes: (body: { quantity: number; duration_months?: number }) =>
    api
      .post<{ codes: string[]; duration_months: number }>('/api/admin/coupons/generate', body)
      .then(r => r.data),

  listCompetitions: () =>
    api.get<Competition[]>('/api/admin/competitions/all').then(r => r.data),
  createCompetition: (body: CompetitionCreateBody) =>
    api.post<number>('/api/admin/competitions', body).then(r => r.data),
  uploadCompetitionPdf: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<{ status: string; pdf_url: string }>(
        `/api/admin/competitions/${id}/upload-pdf`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(r => r.data)
  },
  uploadCompetitionImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<{ status: string; image_url: string }>(
        `/api/admin/competitions/${id}/upload-image`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(r => r.data)
  },
}

/* ------------------------------ UPLOADS ------------------------------ */
export const uploadsApi = {
  uploadPdf: (file: File, category: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    return api
      .post<{ ok: boolean; filename: string }>('/api/uploads/pdf', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },
}
