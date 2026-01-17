-- ============================================
-- Hirely.ai Database Schema
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    cv_text TEXT,
    jd_text TEXT,
    questions JSONB DEFAULT '[]'::jsonb,
    trap_questions JSONB DEFAULT '[]'::jsonb,
    risk_factors JSONB DEFAULT '[]'::jsonb,
    transcript TEXT DEFAULT '',
    human_grades JSONB DEFAULT '{
        "communication": 5,
        "technical": 5,
        "problemSolving": 5,
        "cultureFit": 5,
        "leadership": 5,
        "energy": 5
    }'::jsonb,
    ai_grades JSONB DEFAULT '{
        "communication": 5,
        "technical": 5,
        "problemSolving": 5,
        "cultureFit": 5,
        "leadership": 5,
        "energy": 5
    }'::jsonb,
    notes TEXT DEFAULT '',
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Users can view their own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can insert their own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can update their own candidates" ON candidates;
DROP POLICY IF EXISTS "Users can delete their own candidates" ON candidates;

-- Create policies for RLS
-- Users can only see their own candidates
CREATE POLICY "Users can view their own candidates"
    ON candidates
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert their own candidates
CREATE POLICY "Users can insert their own candidates"
    ON candidates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own candidates
CREATE POLICY "Users can update their own candidates"
    ON candidates
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can only delete their own candidates
CREATE POLICY "Users can delete their own candidates"
    ON candidates
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify setup
SELECT 
    'Setup Complete!' as status,
    COUNT(*) as candidate_count 
FROM candidates;
