-- ============================================================
-- PERSONALL - FULL RESTORE SCRIPT (Self-Hosted - Isolated Schema)
-- ============================================================

-- 1. SETUP SCHEMA
CREATE SCHEMA IF NOT EXISTS niume;
GRANT USAGE ON SCHEMA niume TO postgres, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA niume GRANT ALL ON TABLES TO postgres, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA niume GRANT SELECT ON TABLES TO anon;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- 3. AUTH USERS
-- (Os usuários continuam no schema central 'auth' compartilhado pela instância)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
VALUES
('95628f46-b8d2-430b-8045-28805c58ddc7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contato@synapx.cloud', '$2a$10$PZ/38jpARoL6Vn.86GQuZOSI05zUuY6MRK/g03IeE1hqLxxYlVdeO', '2026-02-24 23:23:31.978512+00', '{"provider":"email","providers":["email"]}', '{"sub":"95628f46-b8d2-430b-8045-28805c58ddc7","email":"contato@synapx.cloud","email_verified":true,"phone_verified":false}', '2026-02-24 23:23:31.895646+00', '2026-02-25 22:52:50.451376+00', false, false),
('6e845a88-c955-495e-8019-631abf46aafc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caovila.vivian@gmail.com', '$2a$10$vwkFF9a.FH4v2zf/vDtqhu9ZsLQjr30W0YdxE2dNeDf.2e.kLNYqG', '2026-02-22 15:56:39.405741+00', '{"provider":"email","providers":["email"]}', '{"sub":"6e845a88-c955-495e-8019-631abf46aafc","email":"caovila.vivian@gmail.com","email_verified":true,"phone_verified":false}', '2026-02-22 15:56:39.376892+00', '2026-02-26 13:04:55.978964+00', false, false),
('d7c961d0-1e68-4938-9515-2f65cdef62b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno.ferraz68@gmail.com', '$2a$10$.DXui2Pw7Zd/XvoGg3IOX.NTLVpfkuuDN6v0mJTr2Oqf5OA2tmzAK', '2026-02-22 03:38:19.139053+00', '{"provider":"email","providers":["email"]}', '{"sub":"d7c961d0-1e68-4938-9515-2f65cdef62b2","email":"bruno.ferraz68@gmail.com","email_verified":true,"phone_verified":false}', '2026-02-22 03:38:01.046514+00', '2026-02-26 13:58:10.297408+00', false, false)
ON CONFLICT (id) DO NOTHING;

-- 4. TABLES (DDL - Moved to schema 'niume')
-- Profiles
CREATE TABLE IF NOT EXISTS niume.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL, age INTEGER NOT NULL, weight DECIMAL(5,2) NOT NULL, height DECIMAL(5,2) NOT NULL,
    gender TEXT NOT NULL DEFAULT 'other', activity_level TEXT NOT NULL DEFAULT 'moderate',
    goal TEXT NOT NULL DEFAULT 'maintain', training_location TEXT NOT NULL DEFAULT 'gym',
    available_minutes INTEGER DEFAULT 45, photo_url TEXT, body_analysis TEXT,
    food_preferences TEXT[] DEFAULT '{}', foods_at_home TEXT[] DEFAULT '{}',
    daily_calorie_goal INTEGER DEFAULT 2000, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), theme TEXT DEFAULT 'light'
);

-- Modalities
CREATE TABLE IF NOT EXISTS niume.modalities (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL, icon TEXT, description TEXT, created_by UUID REFERENCES niume.profiles(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout Plans
CREATE TABLE IF NOT EXISTS niume.workout_plans (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES niume.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, description TEXT, estimated_weeks INTEGER DEFAULT 12,
    plan_data JSONB NOT NULL DEFAULT '{}', is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(), category TEXT, plan_type TEXT, modality_id UUID REFERENCES niume.modalities(id), split_type TEXT
);

-- Workout Sessions
CREATE TABLE IF NOT EXISTS niume.workout_sessions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES niume.profiles(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES niume.workout_plans(id) ON DELETE SET NULL,
    session_date DATE DEFAULT CURRENT_DATE, day_index INTEGER DEFAULT 0,
    exercises_completed JSONB DEFAULT '[]', duration_minutes INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0, completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(), total_load_kg DECIMAL(10,2) DEFAULT 0
);

-- Meals
CREATE TABLE IF NOT EXISTS niume.meals (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES niume.profiles(id) ON DELETE CASCADE NOT NULL,
    meal_date DATE DEFAULT CURRENT_DATE, meal_type TEXT, description TEXT NOT NULL,
    calories INTEGER, protein DECIMAL(6,2), carbs DECIMAL(6,2), fat DECIMAL(6,2),
    logged_at TIMESTAMPTZ DEFAULT NOW(), quantity DECIMAL(8,2), unit TEXT, unit_weight DECIMAL(8,2) DEFAULT 100
);

-- Gamification
CREATE TABLE IF NOT EXISTS niume.gamification (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES niume.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    points INTEGER DEFAULT 0, level INTEGER DEFAULT 1, xp_to_next INTEGER DEFAULT 200,
    streak_days INTEGER DEFAULT 0, last_activity_date DATE, total_workouts INTEGER DEFAULT 0,
    total_meals_logged INTEGER DEFAULT 0, rewards_available JSONB DEFAULT '[]',
    rewards_earned JSONB DEFAULT '[]', updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food Database
CREATE TABLE IF NOT EXISTS niume.food_database (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL,
    protein DECIMAL(6,2), carbs DECIMAL(6,2), fat DECIMAL(6,2),
    serving_size TEXT, source TEXT, barcode TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), unit_weight DECIMAL(8,2) DEFAULT 100
);

-- Content Blocklist
CREATE TABLE IF NOT EXISTS niume.content_blocklist (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY, word TEXT NOT NULL UNIQUE, category TEXT
);

-- AI Conversations
CREATE TABLE IF NOT EXISTS niume.ai_conversations (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY, user_id UUID REFERENCES niume.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INSERT DATA (Into schema 'niume')
-- DATA: PROFILES
INSERT INTO niume.profiles (id, name, age, weight, height, gender, activity_level, goal, training_location, available_minutes, food_preferences, foods_at_home, daily_calorie_goal, created_at, updated_at, theme) VALUES
('6e845a88-c955-495e-8019-631abf46aafc', 'Vivian Caovila', 42, 66.00, 163.00, 'female', 'moderate', 'lose_weight', 'home', 30, '{Pão,Bolo,"Bolacha recheada"}', '{Tomate,Abobrinha,Batata,Bolo}', 1527, '2026-02-22 16:09:09.993125+00', '2026-02-22 16:09:09.993125+00', 'light'),
('d7c961d0-1e68-4938-9515-2f65cdef62b2', 'Bruno Ferraz', 42, 96.00, 185.00, 'male', 'light', 'lose_weight', 'gym', 60, '{Frango,Arroz,Feijão,Ovo,Pizza}', '{Frango,Arroz,Feijão,Ovo}', 2128, '2026-02-22 14:20:47.511312+00', '2026-02-23 22:01:38.041+00', 'light');

-- DATA: GAMIFICATION
INSERT INTO niume.gamification (user_id, points, level, xp_to_next, streak_days, last_activity_date, total_workouts, total_meals_logged, rewards_available, rewards_earned, updated_at) VALUES
('6e845a88-c955-495e-8019-631abf46aafc', 250, 3, 200, 2, '2026-02-26', 0, 68, '[{"id":"choc","cost":500,"name":"Barra de Chocolate","emoji":"🍫","earned_at":"2026-02-25T22:17:42.217Z","description":"Coma uma barrinha de chocolate à vontade!"},{"id":"pizza","cost":1000,"name":"Fatia de Pizza","emoji":"🍕","earned_at":"2026-02-25T22:17:44.608Z","description":"Uma fatia de pizza sem culpa!"}]', '[]', '2026-02-26 13:08:37.222+00'),
('d7c961d0-1e68-4938-9515-2f65cdef62b2', 1075, 2, 200, 2, '2026-02-26', 0, 63, '[]', '[{"id":"choc","cost":500,"name":"Barra de Chocolate","emoji":"🍫","used_at":"2026-02-24T20:27:19.618Z","earned_at":"2026-02-24T20:25:12.521Z","description":"Coma uma barrinha de chocolate à vontade!"}]', '2026-02-26 11:32:19.411+00');

-- DATA: MODALITIES
INSERT INTO niume.modalities (id, name, icon, description, created_at) VALUES
('c92dac70-e835-42cd-b5f7-32a65e4c44dd', 'Pilates', '🧘', 'Controle corporal e flexibilidade', '2026-02-25 17:54:36.901892+00'),
('e49c4959-21f9-435b-93b7-e4263f50f2e1', 'Boxe', '🥊', 'Artes marciais e condicionamento', '2026-02-25 17:54:36.901892+00'),
('9dfef5ca-fea8-4c0c-87f9-a047efdac681', 'Jump', '🦘', 'Trampolim e cardio intenso', '2026-02-25 17:54:36.901892+00'),
('7b46f2da-fbd8-4fdf-9e6a-3ab43184f49b', 'Yoga', '🌿', 'Equilíbrio, força e respiração', '2026-02-25 17:54:36.901892+00'),
('3ef40a82-3d13-43ff-856c-c4a73f7d7ccb', 'Natação', '🏊', 'Cardio de baixo impacto', '2026-02-25 17:54:36.901892+00');

-- DATA: WORKOUT PLANS
INSERT INTO niume.workout_plans (id, user_id, name, description, estimated_weeks, plan_data, is_active, created_at, category, plan_type, split_type) VALUES
('79b3e80b-68af-4abe-a137-c315ad9d1d43', 'd7c961d0-1e68-4938-9515-2f65cdef62b2', 'Plano Inicial — 4 semanas', 'Plano básico para começar sua jornada fitness.', 4, '{"name": "Plano de Hipertrofia: Força e Volume (3 Dias/Semana)", "weeks": [{"days": [{"day": 1, "name": "Treino A: Peito, Ombro e Tríceps", "type": "strength", "exercises": [{"name": "Supino Reto com Halteres", "reps": "8-12", "sets": 3, "exercise_id": "0001", "instructions": "Desça controlando, suba com força.", "rest_seconds": 75}]}]}]}', true, '2026-02-22 14:20:47.832169+00', 'musculacao', 'ai', null);

-- DATA: BLOCKLIST
INSERT INTO niume.content_blocklist (word, category) VALUES
('merda', 'profanity'), ('porra', 'profanity'), ('caralho', 'profanity'), ('puta', 'profanity'), ('bosta', 'profanity'), ('foda', 'profanity'), ('buceta', 'profanity'), ('viado', 'profanity'), ('vagabunda', 'profanity');

-- 6. RLS POLICIES (Updated for schema 'niume')
ALTER TABLE niume.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON niume.profiles USING (id = auth.uid()) WITH CHECK (id = auth.uid());
ALTER TABLE niume.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meals" ON niume.meals USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. API PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA niume TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA niume TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA niume TO anon;
