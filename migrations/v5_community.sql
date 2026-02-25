-- v5_community.sql
-- Social/community features: follows, reactions
-- Run in Supabase SQL editor

-- ─── 1. Allow reading all profiles (needed for community explore) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Public profile read'
  ) THEN
    CREATE POLICY "Public profile read" ON profiles FOR SELECT USING (true);
  END IF;
END $$;

-- ─── 2. Allow reading workout_sessions of followed users ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_sessions' AND policyname = 'Read followed workout sessions'
  ) THEN
    CREATE POLICY "Read followed workout sessions" ON workout_sessions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM follows
          WHERE follows.follower_id = auth.uid()
            AND follows.following_id = workout_sessions.user_id
            AND follows.status = 'accepted'
        )
      );
  END IF;
END $$;

-- ─── 3. Allow reading cardio_sessions of followed users ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cardio_sessions' AND policyname = 'Read followed cardio sessions'
  ) THEN
    CREATE POLICY "Read followed cardio sessions" ON cardio_sessions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM follows
          WHERE follows.follower_id = auth.uid()
            AND follows.following_id = cardio_sessions.user_id
            AND follows.status = 'accepted'
        )
      );
  END IF;
END $$;

-- ─── 4. follows table ───
CREATE TABLE IF NOT EXISTS follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_status    ON follows(status);

-- ─── 5. community_reactions table ───
CREATE TABLE IF NOT EXISTS community_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL,
  target_type   text NOT NULL CHECK (target_type IN ('workout', 'cardio')),
  reaction_type text NOT NULL CHECK (reaction_type IN ('parabens', 'arrasou', 'nao_desista')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, target_id, target_type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_target ON community_reactions(target_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user   ON community_reactions(user_id);

-- ─── 6. RLS ───
ALTER TABLE follows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;

-- follows: users see follows they're part of; can only insert as follower; accept as target
CREATE POLICY "follows_select" ON follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "follows_insert" ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_update" ON follows FOR UPDATE
  USING (auth.uid() = following_id);

CREATE POLICY "follows_delete" ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- reactions: anyone can read; authenticated users manage their own
CREATE POLICY "reactions_select" ON community_reactions FOR SELECT USING (true);

CREATE POLICY "reactions_insert" ON community_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_update" ON community_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "reactions_delete" ON community_reactions FOR DELETE
  USING (auth.uid() = user_id);
