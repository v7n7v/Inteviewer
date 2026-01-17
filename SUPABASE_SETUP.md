# 🔧 Supabase Setup Guide for Hirely.ai

This guide will help you set up your Supabase database for Hirely.ai.

## 📋 Prerequisites

1. Create a free account at [Supabase](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned (~2 minutes)

## 🗄️ Database Schema

### Step 1: Create the Candidates Table

Go to your Supabase project → SQL Editor → New Query, and run this SQL:

```sql
-- Create candidates table
CREATE TABLE candidates (
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

-- Create index for faster queries
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_candidates_created_at ON candidates(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Configure Authentication

1. Go to **Authentication** → **Settings** → **Email Auth**
2. Configure email settings:
   - **Enable Email Confirmations**: Toggle ON or OFF based on your preference
     - **OFF**: Users can login immediately after signup (faster for testing)
     - **ON**: Users must verify email before login (more secure)
3. Optional: Set up **Email Templates** with your branding

### Step 3: Get Your Credentials

1. Go to **Project Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (the long JWT token under "Project API keys")

### Step 4: Configure Hirely.ai

1. Open `neuralhire.html` in your browser
2. Click the **⚙️ Settings** button
3. Enter:
   - **Supabase URL**: Your project URL
   - **Supabase Anon Key**: Your anon/public key
   - **Gemini API Key**: Your [Gemini API key](https://aistudio.google.com/app/apikey)
4. Click **Save Configuration**

### Step 5: Create an Account & Test

1. Click **Sign Up**
2. Create your account
3. If email confirmation is enabled, check your email and verify
4. Login to Hirely.ai
5. Test by creating a candidate profile

## 🔒 Security Features

### Row Level Security (RLS)
- Each user can only access their own candidate data
- Database-level security ensures data isolation
- No user can see or modify another user's candidates

### Data Privacy
- User passwords are hashed by Supabase Auth
- API keys stored in browser localStorage
- Supabase handles all authentication securely
- HTTPS encrypted communication

## 📊 Data Structure

### Candidates Table Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| user_id | UUID | Reference to auth.users (owner) |
| name | TEXT | Candidate's full name |
| cv_text | TEXT | Extracted CV content |
| jd_text | TEXT | Job description text |
| questions | JSONB | Array of core interview questions |
| trap_questions | JSONB | Array of expert validation questions |
| risk_factors | JSONB | Array of identified risks |
| transcript | TEXT | Live interview transcript |
| human_grades | JSONB | Human assessment scores (1-10) |
| ai_grades | JSONB | AI-generated scores (1-10) |
| notes | TEXT | Interview notes |
| timestamp | TIMESTAMPTZ | Interview date/time |
| created_at | TIMESTAMPTZ | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### Grade Structure (JSONB)

Both `human_grades` and `ai_grades` use this structure:

```json
{
  "communication": 5,
  "technical": 5,
  "problemSolving": 5,
  "cultureFit": 5,
  "leadership": 5,
  "energy": 5
}
```

## 🧪 Testing Your Setup

Run these queries in SQL Editor to verify:

```sql
-- Check if table exists
SELECT * FROM candidates LIMIT 1;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'candidates';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'candidates';
```

## 🆘 Troubleshooting

### "Failed to fetch" errors
- Check that your Supabase URL and Anon Key are correct
- Verify your Supabase project is active
- Check browser console for CORS errors

### "Row Level Security" errors
- Ensure you're logged in
- Verify RLS policies are created correctly
- Check that `user_id` matches `auth.uid()`

### Email confirmation not working
- Check **Authentication** → **Email Templates**
- Verify SMTP settings if using custom email
- Check spam folder for confirmation emails

### Can't see saved candidates
- Ensure you're logged in with the same account
- Check that candidates were saved (no console errors)
- Verify `user_id` is set correctly in the database

## 🔄 Backup & Migration

### Export Data
```sql
-- Export all your candidates as JSON
SELECT json_agg(candidates.*) 
FROM candidates 
WHERE user_id = auth.uid();
```

### Clear All Data (Development Only)
```sql
-- ⚠️ WARNING: This deletes ALL candidates for current user
DELETE FROM candidates WHERE user_id = auth.uid();
```

## 📈 Scaling Considerations

### Free Tier Limits
- 500 MB database storage
- 2 GB bandwidth per month
- 50 MB file storage
- Unlimited API requests

### When to Upgrade
- If you exceed 500 candidates (~1MB each with full transcripts)
- High traffic (multiple interviewers using simultaneously)
- Need for custom domains or advanced features

## 🔗 Useful Links

- [Supabase Dashboard](https://app.supabase.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client Docs](https://supabase.com/docs/reference/javascript/introduction)

---

**Need Help?** Check the [Supabase Discord](https://discord.supabase.com) for community support.
