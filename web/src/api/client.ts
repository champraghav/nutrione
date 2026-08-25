import axios, { AxiosError, AxiosInstance } from 'axios';
import { dropWrite, isRetryable, loadQueue, newToken, queueWrite } from '@utils/offlineQueue';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  /** Accepted into the offline backlog rather than sent. Not yet on the server. */
  queued?: boolean;
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

/**
 * A write that should survive being made with no signal.
 *
 * Tries the network first — being offline is usually brief and a real response
 * is always better. If the request never got a reply, it is kept and reported
 * as queued rather than failed, so the UI can say "saved, waiting to sync"
 * instead of throwing away what the user typed.
 *
 * The token doubles as the queue id and the server's idempotency key, so the
 * replay of a request whose reply was merely lost is a no-op rather than a
 * second helping.
 */
async function queueableWrite<T>(
  url: string,
  body: Record<string, unknown>,
  label: string
): Promise<ApiResponse<T>> {
  const token = newToken();
  const payload = { ...body, clientToken: token };

  try {
    const res = await http.post<ApiResponse<T>>(url, payload);
    return res.data;
  } catch (err) {
    const axiosErr = err as AxiosError<ApiResponse<T>>;
    if (axiosErr.response?.data) return axiosErr.response.data;

    if (isRetryable(axiosErr.response?.status)) {
      queueWrite({ id: token, url, body: payload, label });
      notifyQueueChanged();
      return { success: true, queued: true } as ApiResponse<T>;
    }
    return { success: false, error: { code: 'NETWORK_ERROR', message: axiosErr.message } };
  }
}

type QueueListener = () => void;
const queueListeners = new Set<QueueListener>();

/** Lets the UI re-read the backlog whenever it changes. */
export function onQueueChanged(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

function notifyQueueChanged(): void {
  queueListeners.forEach((l) => l());
}

let syncing = false;

/**
 * Replays the backlog oldest-first, stopping at the first one that fails.
 *
 * Order matters — these are diary entries — and pressing on after a failure
 * would apply them out of sequence. A rejected write is dropped rather than
 * retried for ever: the server has considered it and will keep saying no.
 */
export async function syncQueue(): Promise<{ sent: number; remaining: number }> {
  if (syncing) return { sent: 0, remaining: loadQueue().length };
  syncing = true;
  let sent = 0;

  try {
    for (const write of loadQueue()) {
      try {
        const res = await http.post<ApiResponse<unknown>>(write.url, write.body);
        if (res.data.success) {
          dropWrite(write.id);
          sent += 1;
        } else {
          dropWrite(write.id);
        }
      } catch (err) {
        const axiosErr = err as AxiosError;
        if (isRetryable(axiosErr.response?.status)) break;
        dropWrite(write.id);
      }
    }
  } finally {
    syncing = false;
    notifyQueueChanged();
  }

  return { sent, remaining: loadQueue().length };
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
  // Sends the browser's own calendar date: the server clock is UTC and the
  // user is not, so it cannot work out which day this is on its own.
  getHealthScore: (date?: string) => request(http.get('/health/score', { params: { date } })),
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
  getTargetPlan: () => request(http.get('/nutrition/plan')),

  // Hydration
  getHydration: (date?: string) => request(http.get('/hydration', { params: { date } })),
  addWater: (amountMl: number, date?: string) => queueableWrite('/hydration', { amountMl, date }, 'Water'),
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
  // Same: sets the count rather than incrementing it.
  checkHabit: (id: string, date: string, count: number) =>
    queueableWrite(`/habits/${id}/check`, { date, count }, 'Habit'),

  // Fast logging
  getRecentFoods: () => request(http.get('/nutrition/recent-foods')),
  getFrequentFoods: () => request(http.get('/nutrition/frequent-foods')),
  getLoggedDates: () => request(http.get('/nutrition/logged-dates')),
  quickAdd: (data: Record<string, unknown>) => request(http.post('/nutrition/quick-add', data)),
  copyDay: (fromDate: string, toDate: string, mealTypes?: string[]) =>
    request(http.post('/nutrition/copy-day', { fromDate, toDate, mealTypes })),

  // Custom foods and recipes
  getMyFoods: () => request(http.get('/nutrition/my-foods')),
  createCustomFood: (data: Record<string, unknown>) => request(http.post('/nutrition/my-foods', data)),
  deleteMyFood: (id: string) => request(http.delete(`/nutrition/my-foods/${id}`)),
  createRecipe: (name: string, servings: number) => request(http.post('/nutrition/recipes', { name, servings })),
  getRecipe: (id: string) => request(http.get(`/nutrition/recipes/${id}`)),
  addRecipeIngredient: (id: string, foodId: string, quantity: number, unit: string) =>
    request(http.post(`/nutrition/recipes/${id}/ingredients`, { foodId, quantity, unit })),
  removeRecipeIngredient: (id: string, ingredientId: string) =>
    request(http.delete(`/nutrition/recipes/${id}/ingredients/${ingredientId}`)),
  setRecipeServings: (id: string, servings: number) =>
    request(http.put(`/nutrition/recipes/${id}/servings`, { servings })),

  // Steps
  getSteps: (date: string) => request(http.get('/steps', { params: { date } })),
  // Steps replace the day's count rather than adding to it, so a replay is
  // already harmless without a token.
  setSteps: (date: string, steps: number) => queueableWrite('/steps', { date, steps }, 'Steps'),
  getStepHistory: (days = 14) => request(http.get('/steps/history', { params: { days } })),

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

  getUnreadCounts: () => request(http.get('/coach/unread')),
  getMessages: (coachClientId: string) => request(http.get(`/coach/clients/${coachClientId}/messages`)),
  sendMessage: (coachClientId: string, body: string) =>
    request(http.post(`/coach/clients/${coachClientId}/messages`, { body })),
  getClientReport: (coachClientId: string, date: string) =>
    request(http.get(`/coach/clients/${coachClientId}/report`, { params: { date } })),

  // Coaching - client side
  getMyReport: (date: string) => request(http.get('/my-plan/report', { params: { date } })),
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
    queueableWrite('/nutrition/meals', { foodId, quantity, unit, date, mealType }, 'Meal'),
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
