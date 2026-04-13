import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

export default apiClient;
