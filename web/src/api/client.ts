import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

const TOKEN_KEY = 'health_os_tokens';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function getStoredTokens(): StoredTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

function setStoredTokens(tokens: StoredTokens | null): void {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

const http: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const tokens = getStoredTokens();
  if (tokens?.accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<StoredTokens | null> | null = null;

async function refreshTokens(): Promise<StoredTokens | null> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return null;

  try {
    const res = await axios.post<ApiResponse<StoredTokens>>(`${API_URL}/api/v1/auth/refresh`, {
      refreshToken: tokens.refreshToken,
    });
    const newTokens = res.data.data ?? null;
    setStoredTokens(newTokens);
    return newTokens;
  } catch {
    setStoredTokens(null);
    return null;
  }
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !(original as { _retry?: boolean })._retry) {
      (original as { _retry?: boolean })._retry = true;
      refreshPromise = refreshPromise ?? refreshTokens();
      const newTokens = await refreshPromise;
      refreshPromise = null;

      if (newTokens) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return http.request(original);
      }
    }
    return Promise.reject(error);
  }
);

async function request<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<ApiResponse<T>> {
  try {
    const res = await promise;
    return res.data;
  } catch (err) {
    const axiosErr = err as AxiosError<ApiResponse<T>>;
    if (axiosErr.response?.data) return axiosErr.response.data;
    return { success: false, error: { code: 'NETWORK_ERROR', message: axiosErr.message } };
  }
}

export const api = {
  // Auth
  signup: (email: string, password: string, firstName?: string, lastName?: string) =>
    request<{ user: unknown; accessToken: string; refreshToken: string }>(
      http.post('/auth/signup', { email, password, firstName, lastName })
    ).then((res) => {
      if (res.success && res.data) setStoredTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
      return res;
    }),

  signin: (email: string, password: string) =>
    request<{ user: unknown; accessToken: string; refreshToken: string }>(http.post('/auth/signin', { email, password })).then(
      (res) => {
        if (res.success && res.data) setStoredTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
        return res;
      }
    ),

  logout: async () => {
    const tokens = getStoredTokens();
    if (tokens?.refreshToken) {
      await request(http.post('/auth/logout', { refreshToken: tokens.refreshToken }));
    }
    setStoredTokens(null);
  },

  isAuthenticated: () => !!getStoredTokens()?.accessToken,

  // Users
  getMe: () => request(http.get('/users/me')),
  updateMe: (data: Record<string, unknown>) => request(http.put('/users/me', data)),
  deleteMe: () => request(http.delete('/users/me')),

  // Health
  getHealthScore: () => request(http.get('/health/score')),
  getHealthScoreHistory: (days = 30) => request(http.get('/health/score/history', { params: { days } })),
  getHealthMetrics: (type?: string, days = 30) => request(http.get('/health/metrics', { params: { type, days } })),
  logHealthMetric: (type: string, value: number, unit?: string) =>
    request(http.post('/health/metrics', { type, value, unit })),
  getHealthTimeline: (limit = 50) => request(http.get('/health/timeline', { params: { limit } })),
  getHealthProfile: () => request(http.get('/health/profile')),
  updateHealthProfile: (data: Record<string, unknown>) => request(http.put('/health/profile', data)),

  // Nutrition
  searchFoods: (q: string, limit = 20) => request(http.get('/nutrition/foods', { params: { q, limit } })),
  getFood: (id: string) => request(http.get(`/nutrition/foods/${id}`)),
  getFoodByBarcode: (barcode: string) => request(http.get(`/nutrition/foods/barcode/${encodeURIComponent(barcode)}`)),
  analyzePhoto: (image: string, mediaType?: string) =>
    request(http.post('/nutrition/analyze-photo', { image, mediaType })),
  bulkLogMeals: (date: string, items: Array<{ foodId: string; quantity: number; unit: string }>, mealType?: string) =>
    request(http.post('/nutrition/meals/bulk', { date, items, mealType })),
  getNutrientGaps: (date: string) => request(http.get('/nutrition/gaps', { params: { date } })),

  // Hydration
  getHydration: (date?: string) => request(http.get('/hydration', { params: { date } })),
  addWater: (amountMl: number, date?: string) => request(http.post('/hydration', { amountMl, date })),
  removeWaterEntry: (id: string) => request(http.delete(`/hydration/${id}`)),
  getHydrationHistory: (days = 14) => request(http.get('/hydration/history', { params: { days } })),

  // Goals
  getGoals: (status?: string) => request(http.get('/goals', { params: { status } })),
  createGoal: (data: Record<string, unknown>) => request(http.post('/goals', data)),
  updateGoal: (id: string, data: Record<string, unknown>) => request(http.put(`/goals/${id}`, data)),
  deleteGoal: (id: string) => request(http.delete(`/goals/${id}`)),

  // Habits
  getHabits: (date: string) => request(http.get('/habits', { params: { date } })),
  getHabitsSummary: (date: string) => request(http.get('/habits/summary', { params: { date } })),
  getHabitSuggestions: () => request(http.get('/habits/suggestions')),
  createHabit: (data: Record<string, unknown>) => request(http.post('/habits', data)),
  updateHabit: (id: string, data: Record<string, unknown>) => request(http.put(`/habits/${id}`, data)),
  archiveHabit: (id: string) => request(http.delete(`/habits/${id}`)),
  checkHabit: (id: string, date: string, count: number) =>
    request(http.post(`/habits/${id}/check`, { date, count })),

  // Coaching - coach side
  getClients: (date: string) => request(http.get('/coach/clients', { params: { date } })),
  addClient: (data: Record<string, unknown>) => request(http.post('/coach/clients', data)),
  getClientDetail: (id: string, date: string) => request(http.get(`/coach/clients/${id}`, { params: { date } })),
  updateClientNotes: (id: string, notes: string) => request(http.put(`/coach/clients/${id}/notes`, { notes })),
  endClient: (id: string) => request(http.delete(`/coach/clients/${id}`)),

  getPlans: (kind?: string) => request(http.get('/coach/plans', { params: { kind } })),
  getPlan: (id: string) => request(http.get(`/coach/plans/${id}`)),
  createPlan: (data: Record<string, unknown>) => request(http.post('/coach/plans', data)),
  updatePlan: (id: string, data: Record<string, unknown>) => request(http.put(`/coach/plans/${id}`, data)),
  archivePlan: (id: string) => request(http.delete(`/coach/plans/${id}`)),
  addPlanItem: (planId: string, data: Record<string, unknown>) =>
    request(http.post(`/coach/plans/${planId}/items`, data)),
  deletePlanItem: (planId: string, itemId: string) =>
    request(http.delete(`/coach/plans/${planId}/items/${itemId}`)),
  copyPlanDay: (planId: string, fromDay: number, toDay: number) =>
    request(http.post(`/coach/plans/${planId}/copy-day`, { fromDay, toDay })),
  assignPlan: (data: Record<string, unknown>) => request(http.post('/coach/assignments', data)),
  endAssignment: (id: string) => request(http.delete(`/coach/assignments/${id}`)),

  // Coaching - client side
  getMyPlan: (date: string) => request(http.get('/my-plan', { params: { date } })),
  checkPlanItem: (itemId: string, date: string, done: boolean) =>
    request(http.post(`/my-plan/items/${itemId}/check`, { date, done })),
  getMyCoaches: () => request(http.get('/my-plan/coaches')),
  acceptInvite: (code: string) => request(http.post('/my-plan/accept-invite', { code })),
  leaveCoach: (id: string) => request(http.delete(`/my-plan/coaches/${id}`)),

  // Import from other apps
  previewImport: (csv: string, dayFirst: boolean) => request(http.post('/import/preview', { csv, dayFirst })),
  commitImport: (csv: string, dayFirst: boolean) => request(http.post('/import/commit', { csv, dayFirst })),
  getNutritionLog: (date: string) => request(http.get('/nutrition/logs', { params: { date } })),
  getNutritionSummary: (date: string) => request(http.get('/nutrition/summary', { params: { date } })),
  getNutritionHistory: (days = 30) => request(http.get('/nutrition/history', { params: { days } })),
  addMealItem: (foodId: string, quantity: number, unit: string, date: string, mealType?: string) =>
    request(http.post('/nutrition/meals', { foodId, quantity, unit, date, mealType })),
  removeMealItem: (itemId: string) => request(http.delete(`/nutrition/meals/${itemId}`)),

  // Fitness
  getExercises: (category?: string, limit = 100) => request(http.get('/fitness/exercises', { params: { category, limit } })),
  getExercise: (id: string) => request(http.get(`/fitness/exercises/${id}`)),
  getWorkouts: (days = 30) => request(http.get('/fitness/workouts', { params: { days } })),
  getWorkout: (id: string) => request(http.get(`/fitness/workouts/${id}`)),
  createWorkout: (
    date: string,
    durationMinutes: number,
    workoutType: string,
    intensity?: string,
    caloriesBurned?: number
  ) => request(http.post('/fitness/workouts', { date, durationMinutes, workoutType, intensity, caloriesBurned })),
  addWorkoutExercise: (workoutId: string, data: Record<string, unknown>) =>
    request(http.post(`/fitness/workouts/${workoutId}/exercises`, data)),
  deleteWorkout: (id: string) => request(http.delete(`/fitness/workouts/${id}`)),
  getPersonalRecords: () => request(http.get('/fitness/records')),
  getFitnessSummary: (days = 7) => request(http.get('/fitness/summary', { params: { days } })),

  // Sleep
  logSleep: (date: string, bedtime: string, wakeTime: string, quality?: number, notes?: string) =>
    request(http.post('/sleep', { date, bedtime, wakeTime, quality, notes })),
  getSleepLogs: (days = 30) => request(http.get('/sleep', { params: { days } })),
  getSleepByDate: (date: string) => request(http.get(`/sleep/${date}`)),
  getSleepAnalysis: (date: string) => request(http.get(`/sleep/analysis/${date}`)),
  getSleepTrend: (period: 'week' | 'month') => request(http.get(`/sleep/trend/${period}`)),
  updateSleep: (id: string, data: Record<string, unknown>) => request(http.put(`/sleep/${id}`, data)),
  deleteSleep: (id: string) => request(http.delete(`/sleep/${id}`)),

  // AI
  chatWithAI: (message: string, conversationId?: string) => request(http.post('/ai/chat', { message, conversationId })),
  getDailyBrief: () => request(http.get('/ai/daily-brief')),
  generateMealPlan: (days = 3) => request(http.post('/ai/meal-plan', { days })),
  generateWorkoutPlan: (equipment?: string, durationMinutes?: number) =>
    request(http.post('/ai/workout-plan', { equipment, durationMinutes })),
  getConversations: () => request(http.get('/ai/conversations')),
  getConversation: (id: string) => request(http.get(`/ai/conversations/${id}`)),
};
