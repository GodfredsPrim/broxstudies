import { api, getToken } from './client'
import type {
  AccessCodeRecord,
  AdminAnalytics,
  AuthConfigResponse,
  AuthOtpRequiredResponse,
  AuthResponse,
  AuthUser,
  Book,
  BookQuizResponse,
  Competition,
  CompetitionCreateBody,
  DocumentStatus,
  ExamHistoryEntry,
  GeneratedQuestions,
  GenerationJob,
  AvailableResourcesResponse,
  LeaderboardEntry,
  LiveQuizCreateResponse,
  LiveQuizStateResponse,
  LiveQuizSubmitResponse,
  LoadingProgress,
  MoolreInitiateResponse,
  MoolreStatusResponse,
  MoolreTransactionHistoryItem,
  NewsArticle,
  NewsArticleCreateBody,
  PaystackInitResponse,
  PaystackVerifyResponse,
  PaymentConfirmResponse,
  PendingPayment,
  PracticeMarkResponse,
  SmsLogEntry,
  SubjectsResponse,
  TutorResponse,
  UserProgress,
} from './types'

/* ------------------------------ AUTH ------------------------------ */
export const authApi = {
  config: () => api.get<AuthConfigResponse>('/api/auth/config').then(r => r.data),
  signup: (body: { full_name: string; phone: string; password: string; email?: string }) =>
    api.post<AuthOtpRequiredResponse>('/api/auth/signup', body).then(r => r.data),
  login: (body: { identifier: string; password: string }) =>
    api.post<AuthResponse | AuthOtpRequiredResponse>('/api/auth/login', body).then(r => r.data),
  google: (body: { credential: string }) =>
    api.post<AuthResponse>('/api/auth/google', body).then(r => r.data),
  requestOtp: (phone: string) =>
    api.post<{ ok: boolean; message: string }>('/api/auth/request-otp', { phone }).then(r => r.data),
  verifyOtp: (phone: string, code: string) =>
    api.post<AuthResponse>('/api/auth/verify-otp', { phone, code }).then(r => r.data),
  addPhone: (phone: string) =>
    api.post<{ ok: boolean; message: string }>('/api/auth/add-phone', { phone }).then(r => r.data),
  verifyPhone: (phone: string, code: string) =>
    api.post<AuthUser>('/api/auth/verify-phone', { phone, code }).then(r => r.data),
  me: () => api.get<AuthUser>('/api/auth/me').then(r => r.data),
  getProgress: () => api.get<UserProgress>('/api/auth/progress').then(r => r.data),
  patchProgress: (body: Partial<UserProgress>) =>
    api.patch<UserProgress>('/api/auth/progress', body).then(r => r.data),
  verifyCode: (code: string, track?: string | null) =>
    api.post<AuthUser>('/api/auth/verify-code', { code, track }).then(r => r.data),
  paymentRequest: (body: { momo_name: string; momo_number: string; reference?: string }) =>
    api.post<{ status: string; request_id: number }>('/api/auth/payment-request', body).then(r => r.data),
  subscription: () =>
    api.get<{ has_access: boolean; subscription_status: string }>('/api/auth/subscription').then(r => r.data),
  adminLogin: (secret: string) =>
    api.post<AuthResponse>('/api/admin/login-secret', { secret }).then(r => r.data),
}

export const paymentsApi = {
  // Moolre (primary payment provider)
  moolreInitiate: (momo_number: string) =>
    api.post<MoolreInitiateResponse>('/api/payments/moolre/initiate', { momo_number }).then(r => r.data),
  moolreSubmitOtp: (external_ref: string, otp_code: string) =>
    api.post<{ status: string; message?: string }>('/api/payments/moolre/submit-otp', { external_ref, otp_code }).then(r => r.data),
  moolreStatus: (external_ref: string) =>
    api.get<MoolreStatusResponse>(`/api/payments/moolre/status/${encodeURIComponent(external_ref)}`).then(r => r.data),
  moolreHistory: () =>
    api.get<MoolreTransactionHistoryItem[]>('/api/payments/moolre/history').then(r => r.data),
  // Paystack (legacy / disabled by default)
  paystackInitialize: (body: { momo_number: string; callback_url?: string }) =>
    api.post<PaystackInitResponse>('/api/payments/paystack/initialize', body).then(r => r.data),
  paystackVerify: (reference: string) =>
    api.get<PaystackVerifyResponse>(`/api/payments/paystack/verify/${encodeURIComponent(reference)}`).then(r => r.data),
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
    api.post<{ job_id: string; status: string; message: string }>('/api/questions/generate', body).then(r => r.data),
  getJobStatus: (jobId: string) =>
    api.get<GenerationJob>('/api/questions/jobs/' + jobId).then(r => r.data),
  getUserJobs: () =>
    api.get<{ jobs: GenerationJob[] }>('/api/questions/jobs').then(r => r.data),
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
  gradeAnswers: (files: File[], questions: any, subject?: string) => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    formData.append('questions_json', JSON.stringify(questions))
    if (subject) formData.append('subject', subject)
    return api.post('/api/questions/grade-answers-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000,
    }).then(r => r.data)
  },
  gradeAnswersPDF: (file: File, questions: any, subject?: string) => {
    const formData = new FormData()
    formData.append('files', file)
    formData.append('questions_json', JSON.stringify(questions))
    if (subject) formData.append('subject', subject)
    return api.post('/api/questions/grade-answers-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000,
    }).then(r => r.data)
  },
  examHistory: () =>
    api.get<ExamHistoryEntry[]>('/api/questions/history/exams').then(r => r.data),
  saveExamHistory: (body: { exam_type: string; subject: string; score_obtained: number; total_questions: number; percentage: number; created_at?: string }) =>
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
export type TutorStreamEvent = {
  token?: string
  done?: boolean
  explanation?: string
  error?: string
}

export const tutorApi = {
  ask: (body: {
    question: string
    subject?: string
    is_main_concept_only?: boolean
    history?: Array<{ role: 'user' | 'ai'; content: string }>
  }) => api.post<TutorResponse>('/api/tutor/ask', body).then(r => r.data),

  askStream: async (
    body: {
      question: string
      subject?: string
      is_main_concept_only?: boolean
      history?: Array<{ role: 'user' | 'ai'; content: string }>
    },
    onEvent: (event: TutorStreamEvent) => void,
    signal?: AbortSignal,
  ) => {
    const token = getToken()
    const res = await fetch('/api/tutor/ask/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const data = await res.json()
        if (typeof data?.detail === 'string') detail = data.detail
      } catch { /* noop */ }
      throw new Error(detail)
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Streaming is not supported in this browser.')

    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        try {
          onEvent(JSON.parse(line.replace(/^data:\s*/, '')) as TutorStreamEvent)
        } catch { /* noop */ }
      }
    }
  },

  askWithFiles: (opts: {
    question: string
    files: File[]
    history?: Array<{ role: 'user' | 'ai'; content: string }>
    subject?: string
  }) => {
    const fd = new FormData()
    fd.append('question', opts.question)
    fd.append('history_json', JSON.stringify(opts.history ?? []))
    if (opts.subject) fd.append('subject', opts.subject)
    for (const f of opts.files) fd.append('files', f)
    return api.post<TutorResponse>('/api/tutor/ask-with-files', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000,
    }).then(r => r.data)
  },

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
  excerpt: (bookId: string) =>
    api.get<{ book_id: string; title: string; excerpt?: string; read_url?: string; source: string }>(
      `/api/books/${encodeURIComponent(bookId)}/excerpt`
    ).then(r => r.data),
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
  topics: (subject: string, year?: string) =>
    api.get<Record<string, any>>(`/api/analysis/topics/${encodeURIComponent(subject)}`, { params: { year } }).then(r => r.data),
}

/* ------------------------------ ADMIN ------------------------------ */
export const adminApi = {
  analytics: () =>
    api.get<AdminAnalytics>('/api/admin/analytics').then(r => r.data),

  pendingPayments: () =>
    api.get<PendingPayment[]>('/api/admin/payments/pending').then(r => r.data),
  confirmPayment: (id: number) =>
    api.post<PaymentConfirmResponse>(`/api/admin/payments/${id}/confirm`).then(r => r.data),
  rejectPayment: (id: number) =>
    api.post<{ status: string }>(`/api/admin/payments/${id}/reject`).then(r => r.data),
  sendCodeSms: (body: { phone: string; code: string; duration_months?: number }) =>
    api.post<{ status: string; message: string }>('/api/admin/codes/send-sms', body).then(r => r.data),
  smsLog: (limit = 100) =>
    api.get<SmsLogEntry[]>('/api/admin/sms-log', { params: { limit } }).then(r => r.data),

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

/* ------------------------------ NEWS ------------------------------ */
export const newsApi = {
  list: (category?: string) =>
    api.get<NewsArticle[]>('/api/admin/news', { params: category && category !== 'all' ? { category } : {} }).then(r => r.data),
  listAll: () =>
    api.get<NewsArticle[]>('/api/admin/news/all').then(r => r.data),
  create: (body: NewsArticleCreateBody) =>
    api.post<number>('/api/admin/news', body).then(r => r.data),
  update: (id: number, body: Partial<NewsArticleCreateBody> & { is_published?: boolean }) =>
    api.put<{ status: string }>(`/api/admin/news/${id}`, body).then(r => r.data),
  delete: (id: number) =>
    api.delete<{ status: string }>(`/api/admin/news/${id}`).then(r => r.data),
  uploadImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<{ status: string; image_url: string }>(
        `/api/admin/news/${id}/upload-image`,
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
