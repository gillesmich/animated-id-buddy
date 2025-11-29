-- Create table for WebRTC signaling sessions
CREATE TABLE IF NOT EXISTS public.webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  offer JSONB,
  answer JSONB,
  ice_candidates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_session_id ON public.webrtc_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_expires_at ON public.webrtc_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.webrtc_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create and read sessions (signaling is public)
CREATE POLICY "Anyone can create webrtc sessions"
  ON public.webrtc_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read webrtc sessions"
  ON public.webrtc_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update webrtc sessions"
  ON public.webrtc_sessions
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete webrtc sessions"
  ON public.webrtc_sessions
  FOR DELETE
  USING (true);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION clean_expired_webrtc_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webrtc_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;