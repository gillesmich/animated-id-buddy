-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Modify existing profiles table to add avatar chat fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- Update RLS policies for profiles to make them viewable by everyone
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Create messages table for chat history
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create presence table for online status and typing indicators
CREATE TABLE IF NOT EXISTS public.presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_online BOOLEAN DEFAULT false,
  is_typing BOOLEAN DEFAULT false,
  last_activity TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Messages are viewable by everyone"
  ON public.messages FOR SELECT
  USING (true);

CREATE POLICY "Users can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- RLS Policies for presence
CREATE POLICY "Presence is viewable by everyone"
  ON public.presence FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own presence"
  ON public.presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presence"
  ON public.presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for chat avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars-chat', 'avatars-chat', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat avatars
CREATE POLICY "Chat avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars-chat');

CREATE POLICY "Users can upload their own chat avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars-chat' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own chat avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars-chat' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own chat avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars-chat' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger for presence updated_at
CREATE TRIGGER update_presence_updated_at
  BEFORE UPDATE ON public.presence
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for all tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.presence REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;