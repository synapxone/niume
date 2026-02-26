-- ============================================================
-- v2_workout_categories.sql
-- Adds: musculação/cardio/modalidade categories, community
-- exercise library, cardio sessions, and content moderation.
-- Run this migration in your Supabase SQL editor.
-- ============================================================

-- 1. MODALIDADES (community sport types, shared across users)
CREATE TABLE IF NOT EXISTS modalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text DEFAULT '🏃',
  description text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Seed initial modalities
INSERT INTO modalities (name, icon, description) VALUES
  ('Pilates', '🧘', 'Controle corporal e flexibilidade'),
  ('Boxe', '🥊', 'Artes marciais e condicionamento'),
  ('Jump', '🦘', 'Trampolim e cardio intenso'),
  ('Karatê', '🥋', 'Arte marcial japonesa'),
  ('Yoga', '🌿', 'Equilíbrio, força e respiração'),
  ('Natação', '🏊', 'Cardio de baixo impacto'),
  ('Ciclismo', '🚴', 'Endurance e pernas'),
  ('Corrida', '🏃', 'Cardio e resistência'),
  ('Jiu-Jitsu', '🥋', 'Arte marcial brasileira'),
  ('Dança', '💃', 'Expressão corporal e cardio'),
  ('Crossfit', '⚡', 'Treinamento funcional de alta intensidade'),
  ('Muay Thai', '🥊', 'Artes marciais tailandesas')
ON CONFLICT (name) DO NOTHING;

-- 2. COMMUNITY EXERCISE LIBRARY (shared across users)
CREATE TABLE IF NOT EXISTS community_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('musculacao', 'cardio')),
  modality_id uuid REFERENCES modalities(id),
  muscle_group text,
  equipment text DEFAULT 'livre',
  instructions text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_exercises_category ON community_exercises(category);
CREATE INDEX IF NOT EXISTS idx_community_exercises_modality ON community_exercises(modality_id);
CREATE INDEX IF NOT EXISTS idx_community_exercises_name ON community_exercises USING gin(to_tsvector('portuguese', name));

-- 3. ADD CATEGORY COLUMNS TO workout_plans
ALTER TABLE workout_plans
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'musculacao'
    CHECK (category IN ('musculacao', 'cardio', 'modalidade')),
  ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'ai'
    CHECK (plan_type IN ('ai', 'custom', 'template')),
  ADD COLUMN IF NOT EXISTS modality_id uuid REFERENCES modalities(id),
  ADD COLUMN IF NOT EXISTS split_type text;

-- 4. CARDIO SESSIONS (separate from workout_sessions)
CREATE TABLE IF NOT EXISTS cardio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES workout_plans(id),
  session_date text NOT NULL,
  cardio_type text,              -- 'corrida' | 'bike' | 'natacao' | etc.
  duration_minutes integer,
  distance_km numeric(6,2),
  calories_burned integer,
  resistance_level integer,
  notes text,
  points_earned integer DEFAULT 50,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cardio_sessions_user ON cardio_sessions(user_id, session_date DESC);

-- 5. CONTENT MODERATION BLOCKLIST
CREATE TABLE IF NOT EXISTS content_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  category text DEFAULT 'general' CHECK (category IN ('general', 'profanity', 'inappropriate'))
);

-- Seed with common inappropriate terms in PT-BR
INSERT INTO content_blocklist (word, category) VALUES
  ('merda', 'profanity'),
  ('porra', 'profanity'),
  ('caralho', 'profanity'),
  ('puta', 'profanity'),
  ('bosta', 'profanity'),
  ('foda', 'profanity'),
  ('buceta', 'profanity'),
  ('viado', 'profanity'),
  ('vagabunda', 'profanity'),
  ('idiota', 'inappropriate'),
  ('imbecil', 'inappropriate'),
  ('nazismo', 'inappropriate'),
  ('racismo', 'inappropriate'),
  ('droga', 'inappropriate'),
  ('cocaina', 'inappropriate'),
  ('maconha', 'inappropriate')
ON CONFLICT (word) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocklist ENABLE ROW LEVEL SECURITY;

-- Modalities: public read (community resource), authenticated insert
DROP POLICY IF EXISTS "Public read modalities" ON modalities;
CREATE POLICY "Public read modalities" ON modalities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert modalities" ON modalities;
CREATE POLICY "Auth insert modalities" ON modalities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Community exercises: public read, authenticated insert
DROP POLICY IF EXISTS "Public read community exercises" ON community_exercises;
CREATE POLICY "Public read community exercises" ON community_exercises FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert community exercises" ON community_exercises;
CREATE POLICY "Auth insert community exercises" ON community_exercises FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Cardio sessions: owner only
DROP POLICY IF EXISTS "Owner cardio sessions" ON cardio_sessions;
CREATE POLICY "Owner cardio sessions" ON cardio_sessions
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Content blocklist: public read (needed for client-side check)
DROP POLICY IF EXISTS "Public read blocklist" ON content_blocklist;
CREATE POLICY "Public read blocklist" ON content_blocklist FOR SELECT USING (true);
