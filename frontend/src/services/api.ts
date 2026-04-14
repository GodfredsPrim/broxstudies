import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken = '';

export function setAuthToken(token: string | null) {
  authToken = token || '';
}

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export interface UploadResponse {
  filename: string;
  file_type: string;
  subject: string;
  pages: number;
  chunks: number;
  status: string;
}

export interface Question {
  id?: string;
  subject: string;
  question_type: string;
  question_text: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty_level: string;
  year_generated: number;
  pattern_confidence: number;
}

export interface GeneratedQuestions {
  questions: Question[];
  generation_time: number;
  model_used: string;
  source_used?: string;
  source_details?: {
    has_site_past?: boolean;
    has_legacy_past?: boolean;
    has_site_textbook?: boolean;
    has_site_teacher?: boolean;
    fetch_summary?: {
      downloaded?: number;
      existing?: number;
      failed?: number;
      status_by_type?: Record<string, string>;
    };
  };
}

export interface MockExamCreateResponse extends GeneratedQuestions {
  session_id: string;
}

export interface PracticeMarkResult {
  index: number;
  score: number;
  is_correct: boolean;
  feedback: string;
  expected_answer: string;
  student_answer: string;
}

export interface PracticeMarkResponse {
  total_questions: number;
  score_obtained: number;
  percentage: number;
  results: PracticeMarkResult[];
}

export interface StudentMasteryResponse {
  streak: number;
  subjects: Record<string, { attempts: number; avg_score: number; latest_score: number }>;
}

export interface TeacherInsightsResponse {
  subject: string;
  students_with_attempts: number;
  average_latest_score: number;
  at_risk_students: number;
  recommended_intervention: string;
}

export interface ReliabilityResponse {
  event_count: number;
  recent_events: Array<{ event_type: string; timestamp: number; payload: Record<string, unknown> }>;
  status: string;
}

export interface ResourceStatusResponse {
  year: string;
  subject_slug: string;
  status: Record<string, { cached: boolean; path: string }>;
}

export interface LiveQuizStateResponse {
  code: string;
  host: string;
  time_limit: number;
  created_at: number;
  questions: Array<{
    question_text: string;
    question_type: string;
    options?: string[];
  }>;
  leaderboard: Array<{
    player: string;
    submitted: boolean;
    score: number;
    percentage: number;
  }>;
}

export const uploadAPI = {
  uploadPDF: async (file: File, fileType: string, subject: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);
    formData.append('subject', subject);
    
    const response = await apiClient.post('/uploads/pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getStatus: async () => {
    const response = await apiClient.get('/uploads/status');
    return response.data;
  },
};

export const questionsAPI = {
  generateQuestions: async (
    subject: string,
    year: string,
    questionType: string,
    numQuestions: number,
    difficultyLevel?: string,
    topics?: string[]
  ): Promise<GeneratedQuestions> => {
    const response = await apiClient.post('/questions/generate', {
      subject,
      year,
      question_type: questionType,
      num_questions: numQuestions,
      difficulty_level: difficultyLevel,
      topics,
    });
    return response.data;
  },

  markPractice: async (
    items: Array<{
    question_text: string;
    question_type: string;
    correct_answer: string;
    explanation?: string;
    options?: string[];
    student_answer: string;
  }>,
    studentId?: string,
    subject?: string
  ): Promise<PracticeMarkResponse> => {
    const response = await apiClient.post('/questions/mark-practice', {
      items,
      student_id: studentId,
      subject,
    });
    return response.data;
  },

  createLiveQuiz: async (payload: {
    player_name: string;
    subject: string;
    year: string;
    question_type: string;
    num_questions: number;
    difficulty_level: string;
    time_limit: number;
  }) => {
    const response = await apiClient.post('/questions/quiz/create', payload);
    return response.data as { code: string; host_player: string; total_questions: number };
  },

  joinLiveQuiz: async (code: string, playerName: string) => {
    const response = await apiClient.post('/questions/quiz/join', {
      code,
      player_name: playerName,
    });
    return response.data;
  },

  getLiveQuizState: async (code: string): Promise<LiveQuizStateResponse> => {
    const response = await apiClient.get(`/questions/quiz/${code}/state`);
    return response.data;
  },

  submitLiveQuiz: async (code: string, playerName: string, answers: string[]) => {
    const response = await apiClient.post(`/questions/quiz/${code}/submit`, {
      player_name: playerName,
      answers,
    });
    return response.data as { status: string; result: PracticeMarkResponse };
  },

  getSubjects: async () => {
    const response = await apiClient.get('/questions/subjects');
    return response.data;
  },

  getQuestionTypes: async () => {
    const response = await apiClient.get('/questions/question-types');
    return response.data;
  },

  saveExamHistory: async (payload: { exam_type: string; subject: string; score_obtained: number; total_questions: number; percentage: number; details_json: string }) => {
    const response = await apiClient.post('/questions/history/exams', payload);
    return response.data;
  },

  getExamHistory: async () => {
    const response = await apiClient.get('/questions/history/exams');
    return response.data;
  },

  getResourceStatus: async (year: string, subject: string): Promise<ResourceStatusResponse> => {
    const response = await apiClient.get('/questions/resource-status', {
      params: { year, subject },
    });
    return response.data;
  },

  getStudentMastery: async (studentId: string): Promise<StudentMasteryResponse> => {
    const response = await apiClient.get(`/questions/students/${studentId}/mastery`);
    return response.data;
  },

  getTeacherInsights: async (subject: string): Promise<TeacherInsightsResponse> => {
    const response = await apiClient.get('/questions/teacher/insights', { params: { subject } });
    return response.data;
  },

  getReliability: async (): Promise<ReliabilityResponse> => {
    const response = await apiClient.get('/questions/system/reliability');
    return response.data;
  },

  getLoadingProgress: async () => {
    const response = await apiClient.get('/questions/loading-progress');
    return response.data;
  },

  loadContents: async () => {
    const response = await apiClient.post('/questions/load-remaining');
    return response.data;
  },

  loadDeferred: async () => {
    const response = await apiClient.post('/uploads/load-deferred');
    return response.data;
  },
};

export const analysisAPI = {
  analyzePatterns: async (subject: string) => {
    const response = await apiClient.get(`/analysis/patterns/${subject}`);
    return response.data;
  },

  getTopics: async (subject: string) => {
    const response = await apiClient.get(`/analysis/topics/${subject}`);
    return response.data;
  },

  rebuildIndex: async () => {
    const response = await apiClient.post('/analysis/index');
    return response.data;
  },
};


export interface TutorResponse {
  explanation: string;
  related_questions?: string[];
  mode?: string;
  extracted_text?: string;
  study_tips?: string[];
  steps?: string[];
  confidence_note?: string;
}

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  provider: string;
  subscription_status: 'inactive' | 'active' | 'expired';
  subscription_expires_at: string | null;
  is_admin: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthConfigResponse {
  google_client_id: string;
  google_enabled: boolean;
  facebook_enabled: boolean;
  tiktok_enabled: boolean;
  passkey_enabled: boolean;
}

export const tutorAPI = {
  ask: async (question: string, subject?: string, context?: string): Promise<TutorResponse> => {
    const response = await apiClient.post('/tutor/ask', {
      question,
      subject,
      context,
    });
    return response.data;
  },

  interpretImage: async (
    imageBase64: string,
    question?: string,
    subject?: string,
    context?: string,
    filename?: string,
    contentType?: string,
  ): Promise<TutorResponse> => {
    const response = await apiClient.post('/tutor/interpret-image', {
      image_base64: imageBase64,
      question: question || 'Interpret this image and help me solve it.',
      subject,
      context,
      filename,
      content_type: contentType,
    });
    return response.data;
  },

  getHistory: async (limit = 60) => {
    const response = await apiClient.get('/tutor/history', { params: { limit } });
    return response.data as {
      messages: Array<{ id: number; role: string; content: string; subject: string | null; created_at: string }>;
    };
  },
};

export const authAPI = {
  getConfig: async (): Promise<AuthConfigResponse> => {
    const response = await apiClient.get('/auth/config');
    return response.data;
  },

  signup: async (fullName: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/signup', {
      full_name: fullName,
      email,
      password,
    });
    return response.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  google: async (credential: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/google', { credential });
    return response.data;
  },

  me: async (): Promise<AuthUser> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  verifyCode: async (code: string): Promise<AuthUser> => {
    const response = await apiClient.post('/auth/verify-code', { code });
    return response.data;
  },

  getSubscription: async () => {
    const response = await apiClient.get('/auth/subscription');
    return response.data as {
      status: string;
      expires_at: string | null;
      days_remaining: number | null;
      price_ghs: string;
      subscription_months: number;
    };
  },

  generateAdminCodes: async (
    adminSecret: string,
    quantity = 1,
    durationMonths?: number
  ) => {
    const response = await apiClient.post('/auth/admin/generate-codes', {
      admin_secret: adminSecret,
      quantity,
      duration_months: durationMonths,
    });
    return response.data as { codes: string[]; duration_months: number; price_ghs: string };
  },

  requestManualPayment: async (payload: { momo_name: string; momo_number: string; reference: string }) => {
    const response = await apiClient.post('/auth/payment-request', payload);
    return response.data;
  },
};

export const resourcesAPI = {
  fetchCurriculumResources: async (years?: string[], subjects?: string[], resourceTypes?: string[], autoProcess?: boolean) => {
    const response = await apiClient.post('/resources/fetch-curriculum-resources', {
      years,
      subjects,
      resource_types: resourceTypes,
      auto_process: autoProcess ?? true,
    });
    return response.data;
  },

  getFetchStatus: async () => {
    const response = await apiClient.get('/resources/fetch-curriculum-resources/status');
    return response.data;
  },

  cancelFetch: async () => {
    const response = await apiClient.post('/resources/fetch-curriculum-resources/cancel');
    return response.data;
  },

  getAvailableResources: async () => {
    const response = await apiClient.get('/resources/available-resources');
    return response.data;
  },
};

export interface AdminAnalytics {
  total_users: number;
  active_subscriptions: number;
  expiring_subscriptions: number;
  total_revenue_ghs: number;
  total_codes_generated: number;
  total_codes_used: number;
  recent_activity: Array<{ full_name: string; activity_at: string; type: string }>;
}

export interface CouponGenerateResponse {
  codes: string[];
  duration_months: number;
}

export interface Competition {
  id: number;
  title: string;
  description: string;
  prize: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  pdf_url?: string;
  image_url?: string;
  quiz_json?: string;
}

export interface LeaderboardEntry {
  player_name: string;
  total_points: number;
  rank: number;
  is_online: boolean;
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  momo_name: string;
  momo_number: string;
  reference: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

export const adminAPI = {
  loginWithSecret: async (secret: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/admin/login-secret', null, { params: { secret } });
    return response.data;
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/admin/login', null, { params: { username, password } });
    return response.data;
  },

  getAnalytics: async (): Promise<AdminAnalytics> => {
    const response = await apiClient.get('/admin/analytics');
    return response.data;
  },

  createCompetition: async (payload: { title: string; description: string; prize: string; start_date: string; end_date: string; quiz_json?: string; pdf_url?: string }) => {
    const response = await apiClient.post('/admin/competitions', payload);
    return response.data as number;
  },

  uploadCompetitionPDF: async (compId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/admin/competitions/${compId}/upload-pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { status: string; pdf_url: string };
  },

  uploadCompetitionImage: async (compId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/admin/competitions/${compId}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { status: string; image_url: string };
  },

  getCouponInventory: async () => {
    const response = await apiClient.get('/admin/coupons/inventory');
    return response.data as Array<{ code: string; duration_months: number; created_at: string }>;
  },

  generateCoupons: async (payload: { quantity: number; duration_months?: number }) => {
    const response = await apiClient.post('/admin/coupons/generate', payload);
    return response.data as CouponGenerateResponse;
  },

  listCompetitions: async (): Promise<Competition[]> => {
    const response = await apiClient.get('/admin/competitions');
    return response.data;
  },

  registerForCompetition: async (compId: number) => {
    const response = await apiClient.post(`/admin/competitions/${compId}/register`);
    return response.data;
  },

  getLeaderboard: async (): Promise<LeaderboardEntry[]> => {
    const response = await apiClient.get('/admin/leaderboard');
    return response.data;
  },

  // setupAdmin removed

  getPendingPayments: async (): Promise<PaymentRequest[]> => {
    const response = await apiClient.get('/admin/payments/pending');
    return response.data;
  },

  confirmPayment: async (requestId: number) => {
    const response = await apiClient.post(`/admin/payments/${requestId}/confirm`);
    return response.data;
  },

  rejectPayment: async (requestId: number) => {
    const response = await apiClient.post(`/admin/payments/${requestId}/reject`);
    return response.data;
  },
};

export default apiClient;
