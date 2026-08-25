# Health OS API Reference

Base URL: `http://localhost:3000/api/v1`

All responses are JSON in the shape `{ "success": boolean, "data": ... }` or
`{ "success": false, "error": { "code": string, "message": string } }`.

Authenticated routes require `Authorization: Bearer <accessToken>`.

## Dates

A day means a calendar day **in the user's own timezone**, never in UTC. Every
endpoint that takes a `date` accepts `YYYY-MM-DD` and the web client always
sends its own local date; where one is omitted the server falls back to the
`timezone` on the profile, and only then to UTC. A malformed date is treated as
absent rather than passed to Postgres.

Anything being *logged* — meals, water, steps, sleep, workouts, habit ticks —
is refused more than one day past the UTC date. Diary entries record what
happened, and a date years out is junk that shows up on every history chart.
The one-day allowance exists because UTC+14 is a real place, and someone there
logging their genuine today is a calendar day ahead of the server.

Errors worth handling specifically:

| code | meaning |
| --- | --- |
| `VALIDATION_ERROR` | the request body failed its schema; the message names the field |
| `VALUE_OUT_OF_RANGE` | a number too large for its column, or unparseable |
| `RATE_LIMITED` | carries `retryAfterSeconds` so the wait can be stated |
| `IMPLAUSIBLE_SLEEP` | the two times work out at more than 16 hours |
| `FOOD_IN_USE` / `FOOD_IN_RECIPE` | the food is referenced by logged meals or a recipe |
| `RECIPE_CYCLE` / `RECIPE_SELF_REFERENCE` | the ingredient would make a recipe contain itself |

Optional string fields accept `""`. That is how a form says "leave this
blank", and it is stored as NULL rather than as an empty string.

## Logging offline

A diary is used where the signal is worst, so the four logging endpoints accept
a `clientToken` — a key the client generates — and treat a second arrival
bearing the same one as a no-op:

- `POST /nutrition/meals` and `POST /hydration` store it and skip the insert on
  a repeat, because both *add* a row.
- `POST /steps` and `POST /habits/:id/check` ignore it: both set a value rather
  than adding to one, so a replay was already harmless.

The web client queues a write only when the request provably never arrived —
a network failure with no response at all. Anything the server answered,
including a rejection, is left alone: retrying a 4xx would fail identically,
and retrying a 5xx risks doubling a write the server may already have applied.
The token doubles as the queue id, so the one case a queue cannot otherwise
survive — the request landed but its reply was lost — resolves to a no-op
rather than a second helping.

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
- `PUT /users/me` — body: `firstName, lastName, dateOfBirth, sex, heightCm, weightKg,
  activityLevel, timezone, goal, goalWeightKg, rateKgPerWeek, onboarded`
- `DELETE /users/me` — deactivates the account

`goal` is `lose`, `maintain` or `gain` and `rateKgPerWeek` is a magnitude in
0-1 — the goal supplies the direction. Together they decide whether the
calorie target sits above or below maintenance. `onboarded: true` stamps
`onboarded_at` once and never clears it.

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
### Fast logging

- `GET /nutrition/recent-foods` — distinct foods logged most recently, each
  remembering the quantity, unit and meal you last used
- `GET /nutrition/frequent-foods` — foods logged on the most separate *days*,
  so one heavy snacking day cannot dominate the list forever
- `GET /nutrition/logged-dates` — days with meals, for the "copy from" picker
- `POST /nutrition/quick-add` — body: `{ date, mealType, label?, calories, proteinG?, carbsG?, fatG? }`.
  Records calories without naming a food. Stored with no `food_id`, so it
  never adds junk rows to the shared food database.
- `POST /nutrition/copy-day` — body: `{ fromDate, toDate, mealTypes? }`.
  Items already on the target date are skipped, so repeating it is harmless.

### My foods and recipes

Both are ordinary rows in `foods` owned by their creator, which makes them
searchable, loggable, plan-able and photo-matchable with no special cases —
and private, via the same ownership scoping as imported foods.

- `GET /nutrition/my-foods`
- `POST /nutrition/my-foods` — a custom food with its own per-serving nutrition
- `DELETE /nutrition/my-foods/:id` — refused with `FOOD_IN_USE` if it already
  appears in logged meals, rather than rewriting your history, and with
  `FOOD_IN_RECIPE` if a recipe is built from it. The ingredient row would
  cascade away while the recipe kept its per-serving numbers, leaving a recipe
  that reports calories it no longer contains.
- `POST /nutrition/recipes` — body: `{ name, servings }`
- `GET /nutrition/recipes/:id` — the recipe plus its ingredients
- `POST /nutrition/recipes/:id/ingredients` — body: `{ foodId, quantity, unit }`.
  A recipe may contain another recipe — a curry that uses your own spice mix —
  but not one that (directly or through any chain) contains it back: each
  one's nutrition would then derive from the other's, and no order of
  recalculation converges. Refused with `RECIPE_CYCLE`.
- `DELETE /nutrition/recipes/:id/ingredients/:ingredientId`
- `PUT /nutrition/recipes/:id/servings` — body: `{ servings }`

Per-serving nutrition is recomputed from the ingredients on every change, so
the stored numbers cannot drift from what the recipe contains.

### Targets and the plan behind them

- `GET /nutrition/plan` — the daily targets plus the reasoning: maintenance
  calories, the goal, the pace it buys, and when the goal weight arrives at
  that pace.

Calories come from Mifflin-St Jeor scaled by activity level, then shifted by
the goal at 7,700 kcal per kilogram — so 0.5 kg a week is a 550 kcal daily
gap. Two safety rails apply:

- **Pace** is capped at 1 kg/week losing and 0.5 kg/week gaining. Faster loss
  costs lean mass; faster gain is mostly fat.
- **Intake** never goes below 1,500 kcal (male) or 1,200 kcal (other). When
  that floor cuts the deficit short, `floored` is true and
  `actualRateKgPerWeek` reports the slower pace the target really delivers,
  rather than printing a number that will not produce the promised result.

Protein is set per kilogram of body weight, not as a share of calories, and
goes *up* on a deficit (2.0 g/kg, against 1.6 at maintenance) because eating
less risks losing muscle with the fat.

A profile missing weight, height or date of birth falls back to a flat 2,000
kcal with `personalised: false`, and no deficit is applied to a guess.

### Daily totals

- `GET /nutrition/logs?date=2026-08-13` — meal items logged for a date
- `GET /nutrition/summary?date=2026-08-13` — daily totals, targets, remaining,
  and a `budget` of `target - eaten + exercise`. Exercise credits the budget
  back, capped at the target so a long ride cannot licence an unbounded binge.
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

### Messages

Either side of a live coaching link may read and post; access is resolved from
the link, so ending the relationship closes the conversation at the same
moment it closes the data.

- `GET /coach/unread` — unread counts per conversation, for badges
- `GET /coach/clients/:id/messages` — the thread; reading it marks the other
  side's messages read, so an unread badge cannot get stuck
- `POST /coach/clients/:id/messages` — body: `{ body }`

Clients call these with their own token and get their own conversation.

### Weekly report

- `GET /coach/clients/:id/report?date=` (coach) and `GET /my-plan/report?date=`
  (client) — the seven days ending on `date`: diet and training adherence,
  days logged, average calories/protein/steps, workouts and minutes, habits,
  and weight change. Averages skip days with no data rather than counting them
  as zero.

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

**Training** is scored more loosely on purpose. A workout is one session with a
duration, not a list of matched items, so the honest question is "did they
train on the days they were meant to?" rather than "did they hit every
prescribed rep?", which the app cannot observe. Hand-ticked exercises are used
when present; otherwise it compares minutes trained against minutes prescribed,
capped at 100; a plan with no durations scores full marks for training at all
on a scheduled day.

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

## Steps

- `GET /steps?date=` — `{ steps, target, calories, percent }`. The target comes
  from an active `steps` goal if one is set, otherwise 10,000.
- `POST /steps` — body: `{ date, steps }`. **Replaces** the day's count rather
  than adding to it: a phone or band already knows the running total, so
  incrementing would double-count on every sync.
- `GET /steps/history?days=14`

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

Bedtime and wake time may cross midnight — 23:00 to 07:00 is eight hours, not
minus sixteen. Spans that work out at more than 16 hours are refused with
`IMPLAUSIBLE_SLEEP`: almost always the two times were entered the wrong way
round, and recording a 24-hour night drags the sleep score, the trend and every
average with it.

- `GET /sleep?days=30`
- `GET /sleep/:date`
- `GET /sleep/analysis/:date`
- `GET /sleep/trend/:period` — `period` is `week` or `month`
- `POST /sleep` — body: `{ date, bedtime, wakeTime, quality, notes }`
- `PUT /sleep/:id`
- `DELETE /sleep/:id`

## Health

- `GET /health/score` — today's 8-dimension score, calculated on demand

**A score only covers what it can see.** Every dimension reports whether it had
anything to look at, and the overall is a weighted average over just those,
renormalised by their own weight. A day with nothing logged returns
`overall_score: null` — unscored, not scored badly — and writes no row, so an
untouched day leaves no phantom point on the history chart.

- `coverage` (0-1) is the share of the scoring weight that had data behind it
- `missing` lists the dimensions with nothing logged, heaviest first
- `deferred` lists dimensions that *were* logged but cannot be judged yet:
  calories and water accumulate through the day, and half a day's food at two
  in the afternoon is an unfinished day rather than a bad one. Going over
  target is final, so that is scored immediately.
- `next_best` is the single most worthwhile thing to log next. It is drawn from
  `missing` only, so it can never tell someone to log food they already logged.

Fetching today's score also re-scores yesterday. Its stored row would otherwise
keep whatever it was given while the day was still in progress, with the
accumulating dimensions deferred, leaving every day in the history permanently
flattering.

Nutrition is scored against the user's own targets rather than a flat 2,000
kcal — measuring everyone against the same number marked a 1,500 kcal plan
followed exactly as a 75. Activity counts steps as well as workouts, so a
12,000-step day with no gym session is no longer a zero.
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
- `POST /import/commit` — same body; writes the rows in a single transaction,
  so a file that fails partway leaves nothing behind rather than a half-applied
  history nobody can audit. Re-running the same export is safe: identical
  entries on the same date are skipped rather than duplicated.

Rows carrying impossible figures are dropped during parsing and listed in the
preview's `skipped` with a reason, alongside the ones missing a date or a
name — so they are visible before anything is written.

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
