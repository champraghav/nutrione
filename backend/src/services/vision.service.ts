import { query } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { Food } from './nutrition.service';
import { extractJsonObject, portionFromGrams } from './nutrition.calc';

interface DetectedFoodRaw {
  name: string;
  estimated_grams: number;
  confidence?: number;
  /** Plain-language portion, e.g. "1 medium dosa" — shown so the user can check it. */
  portion_note?: string;
}

export interface DetectedFood {
  /** What the vision model called it, e.g. "Masala Dosa". */
  detectedName: string;
  /** Model's portion estimate, in grams or pieces depending on the match. */
  quantity: number;
  unit: string;
  confidence: number;
  /** How the model described the portion, e.g. "1 medium dosa". */
  portionNote: string | null;
  /** The food row we matched it to, or null if nothing in our DB looked close. */
  match: Food | null;
  /**
   * 0-1 name similarity between what the model saw and the food row we picked.
   * 1 is an exact name match. Surfaced so a loose match can be flagged in the
   * UI rather than silently logged as something else.
   */
  matchScore: number | null;
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

function buildPrompt(vocabulary: string[]): string {
  return `You are a nutrition assistant looking at a photo of a meal.

Identify every distinct food item you can see and estimate the portion of each in grams.
Estimate portions from visual cues — plate and bowl size, the diameter of a roti or dosa,
the height of a rice mound. Be realistic: a restaurant masala dosa is roughly 120-180 g,
a home chapati about 40 g, a katori of dal about 150 g.

Name each item using the CLOSEST match from this list wherever one fits, copying the name
exactly as written here:
${vocabulary.join(', ')}

If an item genuinely is not in that list, use its common specific name anyway (for example
"Thai Green Curry"), never a vague category like "curry" or "vegetables".

Respond with ONLY a JSON object, no prose and no markdown fences, in exactly this shape:
{"foods":[{"name":"Masala Dosa","estimated_grams":150,"confidence":0.9,"portion_note":"1 large dosa"}]}

confidence is 0-1, how sure you are the item is what you named. Use a low confidence rather
than guessing at something you cannot really see — a flagged uncertain item is far more
useful than a wrong number logged silently.
portion_note is a short plain-language portion, e.g. "1 medium bowl", "2 rotis".
If the image contains no food at all, return {"foods":[]}.`;
}

/**
 * The food names we can actually attach nutrition to. Handing these to the
 * model means it names things we can match, instead of us fuzzy-matching
 * whatever it invented after the fact — the single biggest source of wrong
 * numbers in a photo scan.
 *
 * Cached because the list changes only when the food database does, and
 * re-reading it on every scan would add a query to the slowest path.
 */
let vocabularyCache: { names: string[]; loadedAt: number } | null = null;
const VOCABULARY_TTL_MS = 10 * 60 * 1000;

async function getVocabulary(): Promise<string[]> {
  if (vocabularyCache && Date.now() - vocabularyCache.loadedAt < VOCABULARY_TTL_MS) {
    return vocabularyCache.names;
  }

  // Only the shared reference foods. A user's imported rows are private and
  // would pollute the vocabulary without helping anyone else.
  const rows = await query<{ name: string }>(
    `SELECT name FROM foods
     WHERE owner_user_id IS NULL
     ORDER BY name
     LIMIT 400`
  );
  const names = rows.map((r) => r.name);
  vocabularyCache = { names, loadedAt: Date.now() };
  return names;
}

interface MatchResult {
  food: Food | null;
  score: number | null;
}

/**
 * Finds the closest food in our database for a name the vision model produced.
 * Uses exact match first, then trigram similarity, so "Dosa" still finds
 * "Plain Dosa" and "curd" finds "Curd / Dahi".
 */
async function matchFood(userId: string, name: string): Promise<MatchResult> {
  const rows = await query<Food & { score: number }>(
    `SELECT *, similarity(name, $1) AS score
     FROM foods
     WHERE (owner_user_id IS NULL OR owner_user_id = $2)
       AND (name ILIKE $1
            OR name_hi ILIKE $1
            OR similarity(name, $1) > 0.25)
     ORDER BY
       CASE WHEN lower(name) = lower($1) THEN 0 ELSE 1 END,
       similarity(name, $1) DESC
     LIMIT 1`,
    [name, userId]
  );

  const row = rows[0];
  if (!row) return { food: null, score: null };

  // An ILIKE hit can come back with a low trigram score; treat an exact
  // case-insensitive name match as a perfect one.
  const exact = row.name.toLowerCase() === name.toLowerCase();
  return { food: row, score: exact ? 1 : Math.round(Number(row.score ?? 0) * 100) / 100 };
}

function extractJson(text: string): { foods: DetectedFoodRaw[] } {
  return extractJsonObject(text) as { foods: DetectedFoodRaw[] };
}

async function callVisionModel(
  imageBase64: string,
  mediaType: string,
  vocabulary: string[]
): Promise<DetectedFoodRaw[]> {
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
              { type: 'text', text: buildPrompt(vocabulary) },
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
export async function analyzePhoto(userId: string, imageBase64: string, mediaType: string): Promise<PhotoAnalysis> {
  // The vocabulary read overlaps with the model call on a cold cache instead
  // of adding to the wait.
  const vocabularyPromise = getVocabulary();
  const detected = await callVisionModel(imageBase64, mediaType, await vocabularyPromise);

  const named = detected.filter((raw) => raw?.name);
  // One round trip per item, but all in flight at once — a five-item plate
  // used to cost five sequential queries.
  const matches = await Promise.all(named.map((raw) => matchFood(userId, raw.name)));

  const items: DetectedFood[] = [];
  const unmatched: string[] = [];

  for (let i = 0; i < named.length; i += 1) {
    const raw = named[i];
    const grams = Number(raw.estimated_grams) > 0 ? Number(raw.estimated_grams) : 100;
    const { food: match, score } = matches[i];
    const portionNote = typeof raw.portion_note === 'string' ? raw.portion_note : null;

    if (!match) {
      unmatched.push(raw.name);
      items.push({
        detectedName: raw.name,
        quantity: grams,
        unit: 'g',
        confidence: Number(raw.confidence ?? 0.5),
        portionNote,
        match: null,
        matchScore: null,
        nutrients: null,
      });
      continue;
    }

    // Foods measured in pieces (1 dosa, 1 roti) need the gram estimate turned
    // into a count, otherwise "120 g of dosa" would log as 120 dosas.
    const servingSize = Number(match.serving_size) || 1;
    const quantity = portionFromGrams(grams, match.serving_unit, servingSize, match.serving_grams);
    const ratio = quantity / servingSize;

    items.push({
      detectedName: raw.name,
      quantity,
      unit: match.serving_unit,
      confidence: Number(raw.confidence ?? 0.5),
      portionNote,
      match,
      matchScore: score,
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
