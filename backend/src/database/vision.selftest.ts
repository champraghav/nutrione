/**
 * Exercises the photo-analysis pipeline end to end against the real database,
 * stubbing only the outbound vision API call (this sandbox blocks arbitrary
 * outbound HTTPS, and we want a deterministic model response anyway).
 *
 * Everything downstream of the HTTP call is the real code path: JSON parsing,
 * food matching, piece-vs-gram portion handling, nutrient scaling, and totals.
 *
 * Run: npx tsx src/database/vision.selftest.ts
 */
import { pool } from '../config/database';
import { env } from '../config/env';

const MODEL_REPLY = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        foods: [
          { name: 'Masala Dosa', estimated_grams: 160, confidence: 0.94 },
          { name: 'Sambar', estimated_grams: 150, confidence: 0.88 },
          { name: 'Coconut Chutney', estimated_grams: 40, confidence: 0.81 },
          { name: 'Filter Kaapi Special', estimated_grams: 120, confidence: 0.4 },
        ],
      }),
    },
  ],
};

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

async function main() {
  env.anthropicApiKey = 'test-key-for-selftest';

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes('api.anthropic.com')) {
      return new Response(JSON.stringify(MODEL_REPLY), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(url as never);
  }) as typeof fetch;

  const { analyzePhoto } = await import('../services/vision.service');
  // A user id that owns no imported foods, so this exercises the shared
  // reference database exactly as a new account would see it.
  const { queryOne } = await import('../config/database');
  const anyUser = await queryOne<{ id: string }>('SELECT id FROM users LIMIT 1');
  const result = await analyzePhoto(anyUser?.id ?? NIL_UUID, 'ZmFrZS1pbWFnZS1ieXRlcw==', 'image/jpeg');

  console.log('\n=== DETECTED ITEMS ===');
  for (const item of result.items) {
    if (item.nutrients) {
      console.log(
        `  ${item.detectedName} -> matched "${item.match?.name}" | ${item.quantity}${item.unit} | ` +
          `${item.nutrients.calories} kcal, ${item.nutrients.protein_g}g protein, ` +
          `${item.nutrients.carbs_g}g carbs, ${item.nutrients.fat_g}g fat, ${item.nutrients.fiber_g}g fiber`
      );
    } else {
      console.log(`  ${item.detectedName} -> NO MATCH (reported to user as unmatched)`);
    }
  }

  console.log('\n=== PLATE TOTALS ===');
  console.log(JSON.stringify(result.totals, null, 2));
  console.log('\n=== UNMATCHED ===');
  console.log(result.unmatched.length ? result.unmatched.join(', ') : '(none)');

  await pool.end();
}

main().catch((err) => {
  console.error('SELFTEST FAILED:', err);
  process.exit(1);
});
