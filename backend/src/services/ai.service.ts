import { query, queryOne } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { getTodayScore } from './health-score.service';
import { getSummary as getNutritionSummary } from './nutrition.service';
import { getSleepLogs } from './sleep.service';

const SAFETY_DISCLAIMER =
  "\n\nI'm an AI wellness coach, not a medical professional. This isn't medical advice — please consult a doctor for diagnosis, medication, or treatment decisions.";

const BLOCKED_PATTERNS = [
  /diagnos(e|is|ing)/i,
  /prescri(be|ption)/i,
  /you have (cancer|diabetes|covid)/i,
  /stop taking your medication/i,
  /you don't need (a doctor|medical)/i,
];

function applySafetyFilter(response: string): string {
  const containsRisky = BLOCKED_PATTERNS.some((pattern) => pattern.test(response));
  if (containsRisky) {
    return (
      "I can't provide medical diagnoses or medication advice. For symptoms or medical concerns, please consult a healthcare professional." +
      SAFETY_DISCLAIMER
    );
  }
  return response + SAFETY_DISCLAIMER;
}

async function callOllama(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const res = await fetch(`${env.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.ollamaModel,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama responded with status ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    return data.response?.trim() ?? "I couldn't generate a response right now. Please try again.";
  } catch (err) {
    logger.error({ err }, 'Ollama request failed');
    return "The AI coach is currently unavailable. Please make sure Ollama is running and try again shortly.";
  }
}

const SYSTEM_PROMPT = `You are a supportive personal health coach inside a health tracking app.
You help with nutrition, fitness, sleep, and general wellbeing based on the user's own tracked data.
You are NOT a doctor. Never diagnose conditions, never prescribe or recommend stopping medication,
and always suggest consulting a healthcare professional for medical concerns.
Keep responses concise, practical, and encouraging.`;

export async function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = await queryOne('SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2', [
      conversationId,
      userId,
    ]);
    if (!existing) throw AppError.notFound('Conversation not found');
    return existing;
  }

  return queryOne(
    `INSERT INTO ai_conversations (user_id, title) VALUES ($1, 'New Conversation') RETURNING *`,
    [userId]
  );
}

export async function chat(userId: string, message: string, conversationId?: string) {
  const conversation = await getOrCreateConversation(userId, conversationId);
  const convId = (conversation as any).id;

  await query(`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`, [convId, message]);

  const history = await query<{ role: string; content: string }>(
    'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20',
    [convId]
  );

  const contextPrompt = history.map((m) => `${m.role}: ${m.content}`).join('\n');
  const rawResponse = await callOllama(SYSTEM_PROMPT, `${contextPrompt}\nassistant:`);
  const safeResponse = applySafetyFilter(rawResponse);

  await query(`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`, [
    convId,
    safeResponse,
  ]);
  await query('UPDATE ai_conversations SET updated_at = now() WHERE id = $1', [convId]);

  return { conversationId: convId, response: safeResponse };
}

export async function getDailyBrief(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [score, nutrition, sleep] = await Promise.all([
    getTodayScore(userId),
    getNutritionSummary(userId, today),
    getSleepLogs(userId, 1),
  ]);

  const prompt = `Give the user a short, motivating daily brief (3-4 sentences) based on:
- Overall health score: ${score.overall_score}/100 (trend: ${score.trend})
- Sleep score: ${score.sleep_score}/100
- Nutrition today: ${(nutrition as any).total_calories ?? 0} calories, ${(nutrition as any).total_protein_g ?? 0}g protein
- Last night's sleep: ${sleep[0] ? `${Math.round(sleep[0].duration_minutes / 60)}h` : 'not logged'}
Focus on one encouraging insight and one actionable suggestion for today.`;

  const rawResponse = await callOllama(SYSTEM_PROMPT, prompt);
  return { brief: applySafetyFilter(rawResponse), score, nutrition, sleep: sleep[0] ?? null };
}

export async function generateMealPlan(userId: string, days = 3) {
  const prompt = `Create a simple, healthy ${days}-day meal plan (breakfast, lunch, dinner, one snack per day).
Keep it practical with common ingredients. Format as a clear day-by-day list.`;
  const rawResponse = await callOllama(SYSTEM_PROMPT, prompt);
  return { plan: applySafetyFilter(rawResponse), days };
}

export async function generateWorkoutPlan(userId: string, equipment: string, durationMinutes: number) {
  const prompt = `Create a single ${durationMinutes}-minute workout using only: ${equipment || 'bodyweight'}.
Include a brief warm-up, the main exercises with sets/reps, and a cool-down. Keep it beginner-friendly unless stated otherwise.`;
  const rawResponse = await callOllama(SYSTEM_PROMPT, prompt);
  return { plan: applySafetyFilter(rawResponse), equipment, durationMinutes };
}

export async function getConversations(userId: string) {
  return query('SELECT * FROM ai_conversations WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
}

export async function getConversationById(userId: string, id: string) {
  const conversation = await queryOne('SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!conversation) throw AppError.notFound('Conversation not found');

  const messages = await query('SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC', [id]);
  return { ...(conversation as object), messages };
}
