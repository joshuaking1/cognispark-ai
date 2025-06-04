-- Create voice_chat_sessions table for tracking voice chat interactions
CREATE TABLE IF NOT EXISTS voice_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies to secure the voice_chat_sessions table
ALTER TABLE voice_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view only their own voice chat sessions
CREATE POLICY "Users can view their own voice chat sessions"
  ON voice_chat_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy to allow users to create their own voice chat sessions
CREATE POLICY "Users can create their own voice chat sessions"
  ON voice_chat_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update only their own voice chat sessions
CREATE POLICY "Users can update their own voice chat sessions"
  ON voice_chat_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_voice_chat_sessions_user_id ON voice_chat_sessions(user_id);
CREATE INDEX idx_voice_chat_sessions_status ON voice_chat_sessions(status);
CREATE INDEX idx_voice_chat_sessions_started_at ON voice_chat_sessions(started_at);
