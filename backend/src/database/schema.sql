-- Health OS Database Schema
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- USERS & PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  height_cm NUMERIC(5,2),
  weight_kg NUMERIC(5,2),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')) DEFAULT 'moderate',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- weight_loss, muscle_gain, sleep, steps, etc.
  target_value NUMERIC(10,2),
  current_value NUMERIC(10,2),
  unit TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  status TEXT NOT NULL DEFAULT 'active',
  renews_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
-- HEALTH TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- heart_rate, weight, blood_pressure_systolic, steps, etc.
  value NUMERIC(10,2) NOT NULL,
  unit TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_type ON health_metrics(user_id, metric_type, recorded_at DESC);

CREATE TABLE IF NOT EXISTS health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  sleep_score NUMERIC(5,2),
  activity_score NUMERIC(5,2),
  nutrition_score NUMERIC(5,2),
  recovery_score NUMERIC(5,2),
  hydration_score NUMERIC(5,2),
  wellbeing_score NUMERIC(5,2),
  vitals_score NUMERIC(5,2),
  goal_progress_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);
CREATE INDEX IF NOT EXISTS idx_health_scores_user_date ON health_scores(user_id, score_date DESC);

CREATE TABLE IF NOT EXISTS health_timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- meal_logged, workout_completed, sleep_logged, score_calculated, etc.
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_user_date ON health_timeline_events(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS health_graph_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  related_node_type TEXT NOT NULL,
  correlation NUMERIC(4,3),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NUTRITION
-- ============================================================

CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_hi TEXT, -- Hindi name
  brand TEXT,
  region TEXT DEFAULT 'generic',
  serving_size NUMERIC(8,2) NOT NULL DEFAULT 100,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  calories NUMERIC(8,2) NOT NULL DEFAULT 0,
  protein_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  fiber_g NUMERIC(8,2) DEFAULT 0,
  sugar_g NUMERIC(8,2) DEFAULT 0,
  sodium_mg NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE foods ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS saturated_fat_g NUMERIC(8,2) DEFAULT 0;

-- Weight of one serving in grams. Without this, converting a photo's gram
-- estimate into pieces has to guess an average piece weight, which is wrong
-- by 2x for anything as light as an idli or as heavy as a masala dosa.
ALTER TABLE foods ADD COLUMN IF NOT EXISTS serving_grams NUMERIC(8,2);

-- Foods created by importing someone's CSV export belong to that person.
-- NULL means a shared reference food that everyone can search.
ALTER TABLE foods ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_foods_owner ON foods(owner_user_id);

-- Imported foods created before ownership existed are unowned, which would
-- leave them visible to everyone. Attribute each to whoever actually logged
-- meals against it. Idempotent: it only ever touches still-unowned rows.
UPDATE foods f
SET owner_user_id = m.user_id
FROM (SELECT DISTINCT ON (food_id) food_id, user_id FROM meal_items ORDER BY food_id, id) m
WHERE f.id = m.food_id
  AND f.region = 'imported'
  AND f.owner_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON foods USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  total_calories NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_protein_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_carbs_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_fat_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS total_fiber_g NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS total_sugar_g NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS total_sodium_mg NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS total_saturated_fat_g NUMERIC(8,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS meal_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id),
  log_date DATE NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'snack' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity NUMERIC(8,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  calories NUMERIC(8,2) NOT NULL,
  protein_g NUMERIC(8,2) NOT NULL,
  carbs_g NUMERIC(8,2) NOT NULL,
  fat_g NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS fiber_g NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS sugar_g NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS saturated_fat_g NUMERIC(8,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_meal_items_user_date ON meal_items(user_id, log_date DESC);

-- ============================================================
-- FITNESS
-- ============================================================

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'strength', -- strength, cardio, flexibility, sports
  muscle_group TEXT,
  equipment TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  workout_type TEXT NOT NULL DEFAULT 'strength',
  intensity TEXT DEFAULT 'moderate' CHECK (intensity IN ('light', 'moderate', 'intense')),
  calories_burned NUMERIC(8,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, workout_date DESC);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INT NOT NULL DEFAULT 1,
  reps INT,
  weight_kg NUMERIC(6,2),
  duration_seconds INT,
  rpe NUMERIC(3,1), -- rate of perceived exertion 1-10
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_session ON workout_exercises(workout_session_id);

CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  record_type TEXT NOT NULL DEFAULT 'max_weight' CHECK (record_type IN ('max_weight', 'max_reps', 'best_time')),
  value NUMERIC(10,2) NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise_id, record_type)
);

-- ============================================================
-- SLEEP & HYDRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS sleep_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sleep_date DATE NOT NULL,
  bedtime TIMESTAMPTZ NOT NULL,
  wake_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  quality INT CHECK (quality BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, sleep_date)
);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_date ON sleep_sessions(user_id, sleep_date DESC);

CREATE TABLE IF NOT EXISTS hydration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  total_ml INT NOT NULL DEFAULT 0,
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS hydration_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  amount_ml INT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hydration_entries_user_date ON hydration_entries(user_id, log_date DESC);

-- ============================================================
-- DEVICES & MEDICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL,
  provider TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- AI COACH
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);

-- ============================================================
-- ADMIN / SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HABITS
-- ============================================================

CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✅',
  cadence TEXT NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly')),
  target_per_day INTEGER NOT NULL DEFAULT 1 CHECK (target_per_day BETWEEN 1 AND 50),
  days_of_week INTEGER[],
  reminder_time TIME,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived_at, sort_order);

CREATE TABLE IF NOT EXISTS habit_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit ON habit_entries(habit_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_date ON habit_entries(user_id, log_date DESC);

-- ============================================================
-- COACHING: practitioners, their clients, and the plans they write
-- ============================================================

-- A coach's roster. The row exists from the moment the coach adds someone,
-- but client_user_id stays NULL — and no health data is readable — until that
-- person accepts the invite from their own account. A coach can never see a
-- client's data merely by typing their email address.
CREATE TABLE IF NOT EXISTS coach_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coach_clients_coach ON coach_clients(coach_user_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_clients_client ON coach_clients(client_user_id, status);
-- One live link per coach/client pair; ended ones may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_clients_pair
  ON coach_clients(coach_user_id, client_user_id)
  WHERE client_user_id IS NOT NULL AND status <> 'ended';

-- A plan is a repeating cycle of days: a 7-day week, or a 1-day "every day
-- the same". Written once by a coach, then assigned to any number of clients.
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('diet', 'training')),
  cycle_days INTEGER NOT NULL DEFAULT 7 CHECK (cycle_days BETWEEN 1 AND 28),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_coach ON plans(coach_user_id, kind, archived_at);

CREATE TABLE IF NOT EXISTS plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  -- 1-based position in the cycle: day 1 of 7, day 2 of 7, ...
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- diet items
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  -- Free text for anything not in the food database, so a coach is never
  -- blocked from writing the plan they actually mean.
  custom_name TEXT,
  quantity NUMERIC(8,2),
  unit TEXT,

  -- training items
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  sets INTEGER,
  reps INTEGER,
  duration_minutes INTEGER,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, day_number, sort_order);

-- Assigning a plan to a client. start_date anchors the cycle, so day 1 of a
-- 7-day plan always lands on the same weekday the coach intended.
CREATE TABLE IF NOT EXISTS plan_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  coach_client_id UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_client ON plan_assignments(coach_client_id, active);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_plan ON plan_assignments(plan_id);

-- A client ticking off a plan line by hand. Needed because a plan legitimately
-- contains things the food database cannot match — "handful of roasted chana",
-- "green tea", "10k steps" — and without this those lines could never be
-- satisfied, quietly dragging every adherence score down forever.
CREATE TABLE IF NOT EXISTS plan_item_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_item_id UUID NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_item_id, user_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_plan_checkins_user_date ON plan_item_checkins(user_id, log_date);

-- ============================================================
-- FAST LOGGING, RECIPES, STEPS
-- ============================================================

-- Quick-add entries record calories without naming a food ("450 kcal, lunch
-- out"). They need no food row, so food_id becomes optional and a label
-- carries what the user typed. Creating throwaway foods instead would fill
-- the database with junk that then shows up in everyone's search.
ALTER TABLE meal_items ALTER COLUMN food_id DROP NOT NULL;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS label TEXT;

-- A recipe is an ordinary owned food row (region = 'recipe') whose nutrition
-- is computed from its ingredients. Modelling it as a food means it is
-- searchable and loggable everywhere without any special cases.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity NUMERIC(8,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients ON recipe_ingredients(recipe_food_id, sort_order);

-- How many servings the whole recipe makes, so per-serving nutrition can be
-- derived from the ingredient totals.
ALTER TABLE foods ADD COLUMN IF NOT EXISTS recipe_servings NUMERIC(6,2);

CREATE TABLE IF NOT EXISTS step_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  steps INTEGER NOT NULL CHECK (steps >= 0),
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_step_logs_user_date ON step_logs(user_id, log_date DESC);

-- Messages between a coach and one client. Scoped to the coach_clients link
-- rather than to a pair of user ids, so ending the relationship ends access to
-- the conversation with it — the same boundary that governs the health data.
CREATE TABLE IF NOT EXISTS coach_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_client_id UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_messages_thread ON coach_messages(coach_client_id, created_at ASC);

-- What the user is actually trying to do with their weight. Without this the
-- calorie target can only ever be maintenance, which is the wrong number for
-- most people who open a food diary in the first place.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal TEXT
  CHECK (goal IN ('lose', 'maintain', 'gain')) DEFAULT 'maintain';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rate_kg_per_week NUMERIC(3,2);
-- Set once the onboarding wizard has been through, so it is offered exactly
-- once and never again on a returning login.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Idempotency keys for the writes that *add* a row.
--
-- Anything logged while offline is replayed when the connection returns, and a
-- reply lost in transit would otherwise log the meal twice. Steps and habit
-- ticks set a value rather than adding to one, so they are already safe to
-- repeat; these two are not. The client sends a token it generated, and a
-- second arrival with the same token does nothing.
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS client_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_items_client_token
  ON meal_items(user_id, client_token) WHERE client_token IS NOT NULL;

ALTER TABLE hydration_entries ADD COLUMN IF NOT EXISTS client_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hydration_client_token
  ON hydration_entries(user_id, client_token) WHERE client_token IS NOT NULL;
