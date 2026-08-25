# Health OS API Reference

Base URL: `http://localhost:3000/api/v1`

All responses are JSON in the shape `{ "success": boolean, "data": ... }` or
`{ "success": false, "error": { "code": string, "message": string } }`.

Authenticated routes require `Authorization: Bearer <accessToken>`.

## Auth

### POST /auth/signup
```bash
curl -X POST $BASE/auth/signup -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"password123","firstName":"Ada"}'
```
Returns `{ user, accessToken, refreshToken }`.

### POST /auth/signin
```bash
curl -X POST $BASE/auth/signin -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"password123"}'
```

### POST /auth/refresh
```bash
curl -X POST $BASE/auth/refresh -H "Content-Type: application/json" \
  -d '{"refreshToken":"..."}'
```

### POST /auth/logout
```bash
curl -X POST $BASE/auth/logout -H "Content-Type: application/json" \
  -d '{"refreshToken":"..."}'
```

## Users

- `GET /users/me`
- `PUT /users/me` — body: `firstName, lastName, dateOfBirth, sex, heightCm, weightKg, activityLevel, timezone`
- `DELETE /users/me` — deactivates the account

## Nutrition

- `GET /nutrition/foods?q=chicken&limit=20` — search the food database (~130
  common Indian + global foods). Returns the shared reference foods plus any
  the caller's own CSV import created; foods imported by other people are
  never visible.
- `GET /nutrition/foods/:id`
- `GET /nutrition/foods/barcode/:barcode` — look up a packaged food by barcode.
  Checks the local DB first, then Open Food Facts, caching the result.
- `POST /nutrition/analyze-photo` — body: `{ image, mediaType? }` where `image`
  is base64 (a `data:` URL is also accepted). Identifies the foods on a plate,
  estimates portions, and returns per-item + total nutrition. Nothing is logged
  until you confirm. Each item carries a `matchScore` (0-1 name similarity to
  the food row it was matched to) and a `portionNote`, so a loose match is
  shown to the user rather than logged silently. The web client downscales the
  photo to ~1024px before uploading, which is most of the scan's speed. Requires `ANTHROPIC_API_KEY`; without it the endpoint
  returns a clear `VISION_NOT_CONFIGURED` error and the rest of the app is
  unaffected.
- `POST /nutrition/meals/bulk` — body: `{ date, mealType?, items: [{ foodId, quantity, unit }] }`.
  Logs a whole plate at once (used after confirming a photo scan).
- `GET /nutrition/logs?date=2026-08-13` — meal items logged for a date
- `GET /nutrition/summary?date=2026-08-13` — daily totals
- `GET /nutrition/history?days=30`
- `POST /nutrition/meals` — body: `{ foodId, quantity, unit, date, mealType }`
- `DELETE /nutrition/meals/:id`

## Coaching

A user becomes a coach simply by adding their first client — there is no
separate account type.

**Consent is the whole design.** A coach adding someone gets a `pending` row
and an invite code, and nothing else. No health data is readable until that
person enters the code from their own account. The client can revoke at any
time from their side, and the coach cannot undo that.

### Coach side

- `GET /coach/clients?date=` — roster with today's calories, latest weight,
  last-logged date and active plan count for each client
- `POST /coach/clients` — body: `{ name, email?, notes? }`. Returns the row
  including `invite_code` to send to the client.
- `GET /coach/clients/:id?date=` — one client in full: plans in force, the
  day's plan-vs-actual breakdown, 14-day adherence trend, habits summary,
  weight history and 30 days of nutrition totals. Requires an accepted link.
- `PUT /coach/clients/:id/notes` — private notes, never shown to the client
- `DELETE /coach/clients/:id` — ends the relationship and its assignments

- `GET /coach/plans?kind=diet|training`
- `POST /coach/plans` — body: `{ name, description?, kind, cycleDays? }`.
  A plan is a repeating cycle: 1 day (same every day), 7 days, up to 28.
- `GET /coach/plans/:id` — the plan plus its items, with food nutrition joined
- `PUT /coach/plans/:id`, `DELETE /coach/plans/:id` (archives)
- `POST /coach/plans/:id/items` — a diet line (`mealType`, `foodId` or
  `customName`, `quantity`, `unit`) or a training line (`exerciseId` or
  `customName`, `sets`, `reps`, `durationMinutes`)
- `DELETE /coach/plans/:id/items/:itemId`
- `POST /coach/plans/:id/copy-day` — body: `{ fromDay, toDay }`. Replaces the
  target day with a copy, because most days of a week are near-identical.

- `POST /coach/assignments` — body: `{ planId, coachClientId, startDate, endDate? }`.
  `startDate` anchors the cycle, so day 1 lands on the weekday you intended.
- `DELETE /coach/assignments/:id`

### Client side

- `GET /my-plan?date=` — the plans in force for that date, which day of each
  cycle it is, and the adherence breakdown
- `POST /my-plan/items/:itemId/check` — body: `{ date, done }`. Ticks a plan
  line off by hand. Required for free-text lines ("handful of chana"), which
  have no food behind them to match against.
- `GET /my-plan/coaches` — who can currently see your data
- `POST /my-plan/accept-invite` — body: `{ code }`
- `DELETE /my-plan/coaches/:id` — stop sharing, immediately

### How adherence is scored

Logged meals are matched to plan lines by food, preferring the same meal slot
but still crediting the planned food eaten at another time. Each logged entry
can satisfy at most one plan line.

- **followed** — right food, portion within 25% of the plan
- **partial** — right food, portion well outside that band (counts as half)
- **missed** — planned but never logged or ticked

Food eaten off-plan is reported separately as extras and does not reduce the
score; the coach sees both numbers. Days the plan does not cover are excluded
from averages rather than counted as zero.

## Habits

- `GET /habits?date=2026-08-14` — every active habit with, for that date:
  whether it is scheduled (`due_today`), how many times it has been ticked
  (`count_today`), the current and longest streak, the 30-day completion
  rate, and a 14-day history for the dot row.
- `GET /habits/summary?date=2026-08-14` — `{ due, done, percent, best_streak }`
- `GET /habits/suggestions` — a starter set for an empty habits page
- `POST /habits` — body: `{ name, icon?, cadence?, targetPerDay?, daysOfWeek? }`.
  `cadence` is `daily` or `weekly`; `daysOfWeek` is `[0-6]` with 0 = Sunday and
  applies to weekly habits only.
- `PUT /habits/:id` — same body
- `DELETE /habits/:id` — archives it, keeping the history and streaks
- `POST /habits/:id/check` — body: `{ date, count }`. Sets the count for that
  date rather than incrementing, so a double tap cannot log twice. `count: 0`
  un-ticks it.

Streaks count only the days a habit is *scheduled*, so skipping a Tuesday
never breaks a Mon/Wed/Fri habit, and an unfinished today does not break a
streak — the day is not over yet.

## Fitness

- `GET /fitness/exercises?category=strength&limit=100`
- `GET /fitness/exercises/:id`
- `GET /fitness/workouts?days=30`
- `GET /fitness/workouts/:id` — includes logged exercises
- `POST /fitness/workouts` — body: `{ date, durationMinutes, workoutType, intensity, caloriesBurned, notes }`
- `POST /fitness/workouts/:id/exercises` — body: `{ exerciseId, setNumber, reps, weightKg, durationSeconds, rpe }`
- `DELETE /fitness/workouts/:id`
- `GET /fitness/records` — personal records
- `GET /fitness/summary?days=7`

## Sleep

- `GET /sleep?days=30`
- `GET /sleep/:date`
- `GET /sleep/analysis/:date`
- `GET /sleep/trend/:period` — `period` is `week` or `month`
- `POST /sleep` — body: `{ date, bedtime, wakeTime, quality, notes }`
- `PUT /sleep/:id`
- `DELETE /sleep/:id`

## Health

- `GET /health/score` — today's 8-dimension score, calculated on demand
- `GET /health/score/history?days=30`
- `GET /health/metrics?type=heart_rate&days=30`
- `POST /health/metrics` — body: `{ type, value, unit }`
- `GET /health/timeline?limit=50`
- `GET /health/profile`
- `PUT /health/profile` — body: `{ dateOfBirth, sex, heightCm, weightKg, activityLevel }`

## Import (from MyFitnessPal / HealthifyMe / GoQii etc.)

These apps have no public consumer API, so migration is via their CSV export.

- `POST /import/preview` — body: `{ csv, dayFirst? }`. Detects whether the
  file is a food diary, weight history or exercise log from its headers,
  maps the columns, and returns the parsed rows plus anything skipped and
  why. Writes nothing.
- `POST /import/commit` — same body; writes the rows. Re-running the same
  export is safe: identical entries on the same date are skipped rather
  than duplicated.

## AI Coach

Requires Ollama running with `OLLAMA_MODEL` pulled. If Ollama is unreachable,
these endpoints return a graceful "AI coach unavailable" message rather than
erroring, so the rest of the app keeps working.

- `POST /ai/chat` — body: `{ message, conversationId? }`
- `GET /ai/daily-brief`
- `POST /ai/meal-plan` — body: `{ days? }`
- `POST /ai/workout-plan` — body: `{ equipment?, durationMinutes? }`
- `GET /ai/conversations`
- `GET /ai/conversations/:id`

Every AI response carries a disclaimer and is filtered against a safety
pattern list that blocks diagnostic or medication-related claims.
