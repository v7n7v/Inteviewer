-- ============================================
-- Hirely.ai Talent Suite - Database Migration
-- This adds new tables WITHOUT touching existing ones
-- Safe to run multiple times
-- ============================================

-- Resume versions (Liquid Resume)
CREATE TABLE IF NOT EXISTS resume_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    version_name TEXT NOT NULL,
    content JSONB NOT NULL, -- Full resume data structure
    skill_graph JSONB, -- SVG/data for skill visualization
    mode TEXT DEFAULT 'technical' CHECK (mode IN ('technical', 'leadership')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock interview sessions (Shadow Interviewer)
CREATE TABLE IF NOT EXISTS mock_interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    persona TEXT NOT NULL, -- 'skeptical_lead', 'visionary_ceo', 'technical_expert'
    transcript TEXT,
    stress_level INT DEFAULT 0 CHECK (stress_level >= 0 AND stress_level <= 10),
    voice_analysis JSONB, -- Pitch, volume, pace metrics
    performance_score FLOAT,
    questions_asked JSONB,
    answers_given JSONB,
    ai_feedback JSONB,
    duration_seconds INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User skills and preferences (Market Oracle)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_years INT DEFAULT 0,
    target_salary_min INT,
    target_salary_max INT,
    preferred_locations TEXT[],
    current_title TEXT,
    bio TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market intelligence data (Market Oracle)
CREATE TABLE IF NOT EXISTS market_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_title TEXT NOT NULL,
    skills_required JSONB,
    salary_min INT,
    salary_max INT,
    location TEXT,
    company_size TEXT,
    industry TEXT,
    source TEXT, -- 'manual', 'api', 'scrape'
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Skill recommendations tracking
CREATE TABLE IF NOT EXISTS skill_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    skill_name TEXT NOT NULL,
    reason TEXT,
    potential_salary_increase INT,
    market_demand_score FLOAT,
    time_to_learn_months INT,
    status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'learning', 'completed', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JD templates (Persona-JD Engine) - using different name to avoid conflict
CREATE TABLE IF NOT EXISTS jd_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    talent_density_score FLOAT CHECK (talent_density_score >= 0 AND talent_density_score <= 10),
    first_90_days JSONB, -- Roadmap data
    culture_pulse JSONB, -- Culture insights
    bias_flags JSONB, -- Detected biases
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_resume_versions_user ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_user ON mock_interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_created ON mock_interviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_market_data_title ON market_data(job_title);
CREATE INDEX IF NOT EXISTS idx_skill_recommendations_user ON skill_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_jd_templates_user ON jd_templates(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Resume versions
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own resume versions" ON resume_versions;
CREATE POLICY "Users can view their own resume versions"
    ON resume_versions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own resume versions" ON resume_versions;
CREATE POLICY "Users can insert their own resume versions"
    ON resume_versions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own resume versions" ON resume_versions;
CREATE POLICY "Users can update their own resume versions"
    ON resume_versions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own resume versions" ON resume_versions;
CREATE POLICY "Users can delete their own resume versions"
    ON resume_versions FOR DELETE
    USING (auth.uid() = user_id);

-- Mock interviews
ALTER TABLE mock_interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mock interviews" ON mock_interviews;
CREATE POLICY "Users can view their own mock interviews"
    ON mock_interviews FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own mock interviews" ON mock_interviews;
CREATE POLICY "Users can insert their own mock interviews"
    ON mock_interviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own mock interviews" ON mock_interviews;
CREATE POLICY "Users can delete their own mock interviews"
    ON mock_interviews FOR DELETE
    USING (auth.uid() = user_id);

-- User profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Market data (public read for authenticated users)
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market data" ON market_data;
CREATE POLICY "Anyone can view market data"
    ON market_data FOR SELECT
    TO authenticated
    USING (true);

-- Skill recommendations
ALTER TABLE skill_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recommendations" ON skill_recommendations;
CREATE POLICY "Users can view their own recommendations"
    ON skill_recommendations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own recommendations" ON skill_recommendations;
CREATE POLICY "Users can update their own recommendations"
    ON skill_recommendations FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own recommendations" ON skill_recommendations;
CREATE POLICY "Users can insert their own recommendations"
    ON skill_recommendations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- JD Templates
ALTER TABLE jd_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own jd templates" ON jd_templates;
CREATE POLICY "Users can view their own jd templates"
    ON jd_templates FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own jd templates" ON jd_templates;
CREATE POLICY "Users can insert their own jd templates"
    ON jd_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own jd templates" ON jd_templates;
CREATE POLICY "Users can update their own jd templates"
    ON jd_templates FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own jd templates" ON jd_templates;
CREATE POLICY "Users can delete their own jd templates"
    ON jd_templates FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================

-- Reuse the existing update_updated_at_column function from the main schema

DROP TRIGGER IF EXISTS update_resume_versions_updated_at ON resume_versions;
CREATE TRIGGER update_resume_versions_updated_at
    BEFORE UPDATE ON resume_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jd_templates_updated_at ON jd_templates;
CREATE TRIGGER update_jd_templates_updated_at
    BEFORE UPDATE ON jd_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
    '✅ Talent Suite Migration Complete!' as status,
    COUNT(*) as new_tables_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'resume_versions',
    'mock_interviews',
    'user_profiles',
    'market_data',
    'skill_recommendations',
    'jd_templates'
);

-- List all tables in your database
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
