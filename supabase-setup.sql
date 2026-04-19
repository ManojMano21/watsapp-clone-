-- ============================================================
-- WhatsApp Clone — Supabase Database Setup
-- ============================================================
-- Run this ENTIRE script in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Paste → Run)
-- ============================================================

-- ===== 1. USERS TABLE =====
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  photo_url TEXT DEFAULT '',
  about TEXT DEFAULT 'Hey there! I am using WhatsApp.',
  email_verified BOOLEAN DEFAULT FALSE,
  verification_code TEXT,
  code_expiry TIMESTAMPTZ,
  online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. CHATS TABLE =====
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  last_message_text TEXT,
  last_message_sender UUID,
  last_message_type TEXT DEFAULT 'text',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. CHAT PARTICIPANTS =====
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

-- ===== 4. MESSAGES TABLE =====
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT,
  type TEXT DEFAULT 'text',
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 5. INDEXES =====
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON public.chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON public.chats(updated_at DESC);

-- ===== 6. ENABLE ROW LEVEL SECURITY =====
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ===== 7. RLS POLICIES — USERS =====
-- Anyone logged in can read all users (needed for "New Chat" user list)
CREATE POLICY "Users are viewable by authenticated users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ===== 8. RLS POLICIES — CHATS =====
-- Users can see chats they participate in
CREATE POLICY "Users can view own chats"
  ON public.chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Any authenticated user can create a chat
CREATE POLICY "Users can create chats"
  ON public.chats FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Participants can update their chats
CREATE POLICY "Participants can update chats"
  ON public.chats FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- ===== 9. RLS POLICIES — CHAT PARTICIPANTS =====
-- Users can see participants of their chats
CREATE POLICY "Users can view chat participants"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can add participants
CREATE POLICY "Users can add participants"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===== 10. RLS POLICIES — MESSAGES =====
-- Users can read messages in their chats
CREATE POLICY "Users can read messages in own chats"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = messages.chat_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Users can send messages to chats they participate in
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = messages.chat_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Users can update messages (for read receipts)
CREATE POLICY "Users can update messages in own chats"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = messages.chat_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- ===== 11. ENABLE REALTIME =====
-- Enable realtime for messages (live chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- ===== 12. STORAGE BUCKETS =====
-- Run these separately if the SQL above completes first
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Authenticated users can view chat files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-files');

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
