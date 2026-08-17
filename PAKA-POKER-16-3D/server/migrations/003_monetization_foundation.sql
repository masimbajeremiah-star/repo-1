CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan VARCHAR(16) NOT NULL CHECK (plan IN ('free', 'plus')),
  status VARCHAR(16) NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  provider VARCHAR(32) NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_period_idx ON public.subscriptions(user_id, current_period_end DESC);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_id_idx ON public.subscriptions(provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cosmetic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('card_back','avatar','outfit','table_theme','environment','deal_animation','profile_effect','emote','collection')),
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'KES',
  premium_only BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetic_items(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(24) NOT NULL CHECK (source IN ('purchase','plus','season','achievement','promotion','admin')),
  UNIQUE(user_id, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS user_cosmetics_user_idx ON public.user_cosmetics(user_id);

CREATE TABLE IF NOT EXISTS public.user_equipped_cosmetics (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetic_items(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, category)
);

CREATE TABLE IF NOT EXISTS public.player_progression (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  league VARCHAR(16) NOT NULL DEFAULT 'Bronze' CHECK (league IN ('Bronze','Silver','Gold','Platinum','Diamond','Master','Legend')),
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  table_id TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  result VARCHAR(24),
  winner_id UUID REFERENCES public.users(id),
  round_count INTEGER NOT NULL DEFAULT 1,
  duration_seconds INTEGER,
  replay_available BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);
CREATE INDEX IF NOT EXISTS match_history_user_ended_idx ON public.match_history(user_id, ended_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name VARCHAR(80) NOT NULL,
  bio VARCHAR(500) NOT NULL DEFAULT '',
  games_viewed BIGINT NOT NULL DEFAULT 0,
  content_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'none' CHECK (status IN ('none','applicant','approved','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followed_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(follower_id, followed_user_id),
  CHECK (follower_id <> followed_user_id)
);
CREATE INDEX IF NOT EXISTS user_follows_followed_idx ON public.user_follows(followed_user_id);

CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL DEFAULT '',
  privacy VARCHAR(16) NOT NULL DEFAULT 'public' CHECK (privacy IN ('public','private','invite_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.club_members (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','moderator','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(club_id, user_id)
);

INSERT INTO public.cosmetic_items(slug,name,category,description,price,currency,premium_only) VALUES
  ('classic-black','Classic Black','card_back','The standard black PAKA card back.',0,'KES',FALSE),
  ('royal-gold-back','Royal Gold','card_back','A gold-detailed premium card back.',50,'KES',TRUE),
  ('standard-player','Standard Player','avatar','The standard seated PAKA player.',0,'KES',FALSE),
  ('royal-avatar','Royal Avatar','avatar','Premium formal casino styling.',300,'KES',TRUE),
  ('royal-red-table','Royal Red Table','table_theme','Deep red felt with polished gold trim.',500,'KES',TRUE),
  ('luxury-penthouse','Luxury Penthouse','environment','A panoramic high-rise casino environment.',500,'KES',TRUE),
  ('gold-deal','Gold Deal','deal_animation','A subtle golden dealing trail.',150,'KES',TRUE),
  ('founders-collection','Founders Collection','collection','A curated premium cosmetic collection.',1000,'KES',TRUE)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.achievements(slug,name,description,xp_reward) VALUES
  ('first-win','First Win','Win your first PAKA match.',100),
  ('ten-games','10 Games Played','Complete ten PAKA matches.',150),
  ('ten-wins','10 Wins','Win ten PAKA matches.',300),
  ('hundred-games','Veteran Player','Complete one hundred PAKA matches.',750),
  ('perfect-kadi','Perfect KADI','Call KADI and finish legally.',250)
ON CONFLICT(slug) DO NOTHING;
