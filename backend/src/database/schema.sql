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
