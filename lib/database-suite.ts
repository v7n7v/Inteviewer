/**
 * Database operations for Talent Suite features
 */

import { supabase } from './supabase';
import type { Resume } from './ai/resume-morpher';

// ============================================
// RESUME VERSIONS
// ============================================

export interface ResumeVersion {
  id: string;
  user_id: string;
  version_name: string;
  content: Resume;
  skill_graph: any;
  mode: 'technical' | 'leadership';
  is_active: boolean;
  matchScore?: number;
  created_at: string;
  updated_at: string;
}

export async function saveResumeVersion(
  versionName: string,
  content: Resume,
  skillGraph: any,
  mode: 'technical' | 'leadership' = 'technical'
): Promise<{ success: boolean; data?: ResumeVersion; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('resume_versions')
      .insert({
        user_id: user.id,
        version_name: versionName,
        content,
        skill_graph: skillGraph,
        mode,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getResumeVersions(): Promise<{
  success: boolean;
  data?: ResumeVersion[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('resume_versions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateResumeVersion(
  id: string,
  updates: Partial<Omit<ResumeVersion, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; data?: ResumeVersion; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('resume_versions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteResumeVersion(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('resume_versions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// USER PROFILES
// ============================================

export interface UserProfile {
  id: string;
  user_id: string;
  skills: string[];
  experience_years: number;
  target_salary_min?: number;
  target_salary_max?: number;
  preferred_locations?: string[];
  current_title?: string;
  bio?: string;
  updated_at: string;
}

export async function getUserProfile(): Promise<{
  success: boolean;
  data?: UserProfile;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return { success: true, data: data || undefined };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function upsertUserProfile(
  profile: Partial<Omit<UserProfile, 'id' | 'user_id' | 'updated_at'>>
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        ...profile,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// JD TEMPLATES
// ============================================

export interface JDTemplate {
  id: string;
  user_id: string;
  title: string;
  content: string;
  talent_density_score?: number;
  first_90_days?: any;
  culture_pulse?: any;
  bias_flags?: any;
  created_at: string;
  updated_at: string;
}

export async function saveJDTemplate(
  title: string,
  content: string,
  metadata?: {
    talent_density_score?: number;
    first_90_days?: any;
    culture_pulse?: any;
    bias_flags?: any;
  }
): Promise<{ success: boolean; data?: JDTemplate; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('jd_templates')
      .insert({
        user_id: user.id,
        title,
        content,
        ...metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getJDTemplates(): Promise<{
  success: boolean;
  data?: JDTemplate[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('jd_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// MOCK INTERVIEWS
// ============================================

export interface MockInterview {
  id: string;
  user_id: string;
  persona: string;
  transcript?: string;
  stress_level: number;
  voice_analysis?: any;
  performance_score?: number;
  questions_asked?: any;
  answers_given?: any;
  ai_feedback?: any;
  duration_seconds?: number;
  created_at: string;
}

export async function saveMockInterview(
  interview: Omit<MockInterview, 'id' | 'user_id' | 'created_at'>
): Promise<{ success: boolean; data?: MockInterview; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('mock_interviews')
      .insert({
        user_id: user.id,
        ...interview,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMockInterviews(): Promise<{
  success: boolean;
  data?: MockInterview[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('mock_interviews')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// SKILL RECOMMENDATIONS
// ============================================

export interface SkillRecommendation {
  id: string;
  user_id: string;
  skill_name: string;
  reason?: string;
  potential_salary_increase?: number;
  market_demand_score?: number;
  time_to_learn_months?: number;
  status: 'suggested' | 'learning' | 'completed' | 'dismissed';
  created_at: string;
}

export async function getSkillRecommendations(): Promise<{
  success: boolean;
  data?: SkillRecommendation[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('skill_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .order('market_demand_score', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateSkillRecommendationStatus(
  id: string,
  status: SkillRecommendation['status']
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('skill_recommendations')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// JOB APPLICATIONS TRACKER
// ============================================

export interface JobApplication {
  id: string;
  user_id: string;
  company_name: string;
  job_title?: string;
  job_description?: string;
  resume_version_id?: string;
  morphed_resume_name: string;
  status: 'not_applied' | 'applied' | 'screening' | 'interview_scheduled' | 'interviewed' | 'offer' | 'rejected' | 'accepted' | 'withdrawn';
  morphed_at: string;
  applied_at?: string;
  last_updated: string;
  interview_date?: string;
  talent_density_score?: number;
  gap_analysis?: any;
  notes?: string;
  application_link?: string;
  created_at: string;
}

export async function createJobApplication(data: {
  companyName: string;
  jobTitle?: string;
  jobDescription?: string;
  resumeVersionId?: string;
  morphedResumeName: string;
  talentDensityScore?: number;
  gapAnalysis?: any;
  applicationLink?: string;
}): Promise<{ success: boolean; data?: JobApplication; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: application, error } = await supabase
      .from('job_applications')
      .insert({
        user_id: user.id,
        company_name: data.companyName,
        job_title: data.jobTitle,
        job_description: data.jobDescription,
        resume_version_id: data.resumeVersionId,
        morphed_resume_name: data.morphedResumeName,
        talent_density_score: data.talentDensityScore,
        gap_analysis: data.gapAnalysis,
        application_link: data.applicationLink,
        status: 'not_applied',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: application };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getJobApplications(): Promise<{
  success: boolean;
  data?: JobApplication[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateApplicationStatus(
  id: string,
  status: JobApplication['status'],
  additionalData?: {
    appliedAt?: Date;
    interviewDate?: Date;
    notes?: string;
  }
): Promise<{ success: boolean; data?: JobApplication; error?: string }> {
  try {
    const updateData: any = {
      status,
      last_updated: new Date().toISOString(),
    };

    if (additionalData?.appliedAt) {
      updateData.applied_at = additionalData.appliedAt.toISOString();
    }
    if (additionalData?.interviewDate) {
      updateData.interview_date = additionalData.interviewDate.toISOString();
    }
    if (additionalData?.notes !== undefined) {
      updateData.notes = additionalData.notes;
    }

    const { data, error } = await supabase
      .from('job_applications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteJobApplication(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('job_applications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

