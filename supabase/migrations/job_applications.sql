-- Job Applications Tracker Table
-- This table tracks resume morphing sessions and application status

create table if not exists public.job_applications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Company & Job Info
  company_name text not null,
  job_title text,
  job_description text,
  
  -- Resume Info
  resume_version_id uuid references resume_versions(id) on delete set null,
  morphed_resume_name text not null,
  
  -- Application Status
  status text default 'not_applied' check (status in (
    'not_applied',
    'applied',
    'screening',
    'interview_scheduled',
    'interviewed',
    'offer',
    'rejected',
    'accepted',
    'withdrawn'
  )),
  
  -- Important Dates
  morphed_at timestamp with time zone default now(),
  applied_at timestamp with time zone,
  last_updated timestamp with time zone default now(),
  interview_date timestamp with time zone,
  
  -- Analysis Results
  talent_density_score integer,
  gap_analysis jsonb,
  
  -- Notes & Links
  notes text,
  application_link text,
  
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.job_applications enable row level security;

-- Policies: Users can only access their own applications
create policy "Users can view own applications"
  on public.job_applications for select
  using (auth.uid() = user_id);

create policy "Users can create own applications"
  on public.job_applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own applications"
  on public.job_applications for update
  using (auth.uid() = user_id);

create policy "Users can delete own applications"
  on public.job_applications for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists job_applications_user_id_idx on public.job_applications(user_id);
create index if not exists job_applications_status_idx on public.job_applications(status);
create index if not exists job_applications_company_idx on public.job_applications(company_name);
create index if not exists job_applications_created_at_idx on public.job_applications(created_at desc);

-- Comments for documentation
comment on table public.job_applications is 'Tracks job applications and morphed resumes for each company';
comment on column public.job_applications.morphed_resume_name is 'Auto-generated name like Resume_Google_SeniorDev_2024';
comment on column public.job_applications.talent_density_score is 'AI-calculated match score (0-100)';
comment on column public.job_applications.gap_analysis is 'JSON containing skill gaps from AI analysis';
