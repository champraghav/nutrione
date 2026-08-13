import { query } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { Food } from './nutrition.service';

interface DetectedFoodRaw {
  name: string;
  estimated_grams: number;
  confidence?: number;
}

export interface DetectedFood {
  /** What the vision model called it, e.g. "Masala Dosa". */
  detectedName: string;
  /** Model's portion estimate, in grams or pieces depending on the match. */
  quantity: number;
  unit: string;
  confidence: number;
  /** The food row we matched it to, or null if nothing in our DB looked close. */
  match: Food | null;
  /** Nutrients for this portion, scaled from the matched food. Null when unmatched. */
  nutrients: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
    saturated_fat_g: number;
  } | null;
}

export interface PhotoAnalysis {
  items: DetectedFood[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
    saturated_fat_g: number;
  };
  /** Foods the model saw but we have no nutrition data for. */
  unmatched: string[];
}

const VISION_PROMPT = `You are a nutrition assistant looking at a photo of a meal.

Identify every distinct food item you can see and estimate the portion of each in grams.
Use common, searchable food names (e.g. "Masala Dosa", "Sambar", "Coconut Chutney", "Basmati Rice",
"Chicken Curry", "Roti", "Boiled Egg"). Prefer the specific dish name over a generic category.

Respond with ONLY a JSON object, no prose and no markdown fences, in exactly this shape:
{"foods":[{"name":"Masala Dosa","estimated_grams":120,"confidence":0.9}]}

confidence is 0-1, how sure you are the item is what you named.
If the image contains no food at all, return {"foods":[]}.`;

/**
 * Finds the closest food in our database for a name the vision model produced.
 * Uses exact match first, then trigram similarity, so "Dosa" still finds
 * "Plain Dosa" and "curd" finds "Curd / Dahi".
 */
async function matchFood(name: string): Promise<Food | null> {
  const rows = await query<Food>(
    `SELECT *, similarity(name, $1) AS score
     FROM foods
     WHERE name ILIKE $1
        OR name_hi ILIKE $1
        OR similarity(name, $1) > 0.25
     ORDER BY
       CASE WHEN lower(name) = lower($1) THEN 0 ELSE 1 END,
       similarity(name, $1) DESC
     LIMIT 1`,
    [name]
  );
  return rows[0] ?? null;
}

function extractJson(text: string): { foods: DetectedFoodRaw[] } {
  // Models sometimes wrap JSON in prose or ```json fences despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callVisionModel(imageBase64: string, mediaType: string): Promise<DetectedFoodRaw[]> {
  if (!env.anthropicApiKey) {
    throw AppError.badRequest(
      'Photo recognition is not configured on this server. Set ANTHROPIC_API_KEY to enable it, or log the food by search or barcode instead.',
      'VISION_NOT_CONFIGURED'
    );
  }

  let res: Response;
  try {
    res = await fetch(env.anthropicApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.visionModel,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: VISION_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    logger.error({ err }, 'Vision API request failed');
    throw AppError.badRequest(
      'Could not reach the photo recognition service. Please try again in a moment.',
      'VISION_UNREACHABLE'
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error({ status: res.status, body: body.slice(0, 500) }, 'Vision API returned an error');
    throw AppError.badRequest(
      res.status === 401
        ? 'The photo recognition API key was rejected. Check ANTHROPIC_API_KEY on the server.'
        : 'The photo recognition service returned an error. Please try again.',
      'VISION_ERROR'
    );
  }

  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((c) => c.type === 'text')?.text ?? '';

  try {
    const parsed = extractJson(text);
    return Array.isArray(parsed.foods) ? parsed.foods : [];
  } catch (err) {
    logger.error({ err, text: text.slice(0, 500) }, 'Could not parse vision model response');
    throw AppError.badRequest(
      'Could not understand the photo. Try a clearer, well-lit picture of the plate.',
      'VISION_PARSE_FAILED'
    );
  }
}

/**
 * Analyses a meal photo: identifies the foods on the plate, estimates portions,
 * matches each against our food database, and returns per-item plus total
 * nutrition. Nothing is logged here — the user confirms first.
 */
export async function analyzePhoto(imageBase64: string, mediaType: string): Promise<PhotoAnalysis> {
  const detected = await callVisionModel(imageBase64, mediaType);

  const items: DetectedFood[] = [];
  const unmatched: string[] = [];

  for (const raw of detected) {
    if (!raw?.name) continue;
    const grams = Number(raw.estimated_grams) > 0 ? Number(raw.estimated_grams) : 100;
    const match = await matchFood(raw.name);

    if (!match) {
      unmatched.push(raw.name);
      items.push({
        detectedName: raw.name,
        quantity: grams,
        unit: 'g',
        confidence: Number(raw.confidence ?? 0.5),
        match: null,
        nutrients: null,
      });
      continue;
    }

    // Foods measured in pieces (1 dosa, 1 roti) need the gram estimate turned
    // into a count, otherwise "120 g of dosa" would log as 120 dosas.
    const servingSize = Number(match.serving_size) || 1;
    const isPiece = match.serving_unit !== 'g' && match.serving_unit !== 'ml';
    const APPROX_GRAMS_PER_PIECE = 80;
    const quantity = isPiece ? Math.max(1, Math.round(grams / APPROX_GRAMS_PER_PIECE)) : grams;
    const ratio = quantity / servingSize;

    items.push({
      detectedName: raw.name,
      quantity,
      unit: match.serving_unit,
      confidence: Number(raw.confidence ?? 0.5),
      match,
      nutrients: {
        calories: Math.round(Number(match.calories) * ratio * 10) / 10,
        protein_g: Math.round(Number(match.protein_g) * ratio * 10) / 10,
        carbs_g: Math.round(Number(match.carbs_g) * ratio * 10) / 10,
        fat_g: Math.round(Number(match.fat_g) * ratio * 10) / 10,
        fiber_g: Math.round(Number(match.fiber_g ?? 0) * ratio * 10) / 10,
        sugar_g: Math.round(Number(match.sugar_g ?? 0) * ratio * 10) / 10,
        sodium_mg: Math.round(Number(match.sodium_mg ?? 0) * ratio * 10) / 10,
        saturated_fat_g: Math.round(Number(match.saturated_fat_g ?? 0) * ratio * 10) / 10,
      },
    });
  }

  const totals = items.reduce(
    (acc, item) => {
      if (!item.nutrients) return acc;
      acc.calories += item.nutrients.calories;
      acc.protein_g += item.nutrients.protein_g;
      acc.carbs_g += item.nutrients.carbs_g;
      acc.fat_g += item.nutrients.fat_g;
      acc.fiber_g += item.nutrients.fiber_g;
      acc.sugar_g += item.nutrients.sugar_g;
      acc.sodium_mg += item.nutrients.sodium_mg;
      acc.saturated_fat_g += item.nutrients.saturated_fat_g;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, saturated_fat_g: 0 }
  );

  for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
    totals[key] = Math.round(totals[key] * 10) / 10;
  }

  return { items, totals, unmatched };
}
