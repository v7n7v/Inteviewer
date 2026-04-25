/**
 * Database operations for Talent Suite features
 * Primary: Firestore (cloud, syncs across devices)
 * Fallback: localStorage (if Firestore times out)
 */

import { auth, db } from './firebase';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc,
} from 'firebase/firestore';
import type { Resume } from './ai/resume-morpher';

// ============================================
// HELPERS
// ============================================

function getUserId(): string {
  return auth.currentUser?.uid || 'dev-user';
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Race a Firestore promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), ms)
    ),
  ]);
}

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
    const userId = getUserId();
    const now = new Date().toISOString();
    const colRef = collection(db, 'users', userId, 'resume_versions');
    const docData = {
      user_id: userId,
      version_name: versionName,
      content,
      skill_graph: skillGraph,
      mode,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    const docRef = await withTimeout(addDoc(colRef, docData));
    return { success: true, data: { id: docRef.id, ...docData } as ResumeVersion };
  } catch (error: any) {
    console.error('saveResumeVersion error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getResumeVersions(): Promise<{
  success: boolean;
  data?: ResumeVersion[];
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'resume_versions');
    const snapshot = await withTimeout(getDocs(colRef));
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as ResumeVersion))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data };
  } catch (error: any) {
    console.error('getResumeVersions error:', error.message);
    return { success: false, data: [], error: error.message };
  }
}

export async function updateResumeVersion(
  id: string,
  updates: Partial<Omit<ResumeVersion, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; data?: ResumeVersion; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'resume_versions', id);
    await withTimeout(updateDoc(docRef, { ...updates, updated_at: new Date().toISOString() }));
    const snap = await withTimeout(getDoc(docRef));
    return { success: true, data: { id: snap.id, ...snap.data() } as ResumeVersion };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteResumeVersion(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    await withTimeout(deleteDoc(doc(db, 'users', userId, 'resume_versions', id)));
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
  full_name: string;
  email: string;
  linkedin_url?: string;
  skills: string[];
  preferences?: any;
  // Onboarding fields
  onboarding_completed?: boolean;
  career_fields?: string[];
  seniority_level?: 'junior' | 'mid' | 'senior' | 'lead' | 'director';
  job_search_status?: 'active' | 'passive' | 'employed_exploring' | 'student';
  base_resume_text?: string;
  base_resume_parsed?: any;
  target_roles?: string[];
  location_preference?: string;
  salary_range?: { min: number; max: number };
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(): Promise<{
  success: boolean;
  data?: UserProfile;
  error?: string;
}> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'profile', 'main');
    const snap = await withTimeout(getDoc(docRef));
    if (!snap.exists()) return { success: true, data: undefined };
    return { success: true, data: { id: snap.id, ...snap.data() } as UserProfile };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOnboardingStatus(): Promise<{
  completed: boolean;
  error?: string;
}> {
  try {
    const userId = getUserId();
    if (userId === 'dev-user') return { completed: false };
    const docRef = doc(db, 'users', userId, 'profile', 'main');
    const snap = await withTimeout(getDoc(docRef), 3000);
    if (!snap.exists()) return { completed: false };
    return { completed: !!snap.data()?.onboarding_completed };
  } catch {
    return { completed: false };
  }
}

export async function completeOnboarding(data: {
  career_fields: string[];
  seniority_level?: UserProfile['seniority_level'];
  job_search_status?: UserProfile['job_search_status'];
  target_roles?: string[];
  location_preference?: string;
  salary_range?: { min: number; max: number };
  base_resume_text?: string;
  base_resume_parsed?: any;
}): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'profile', 'main');
    const now = new Date().toISOString();
    const snap = await withTimeout(getDoc(docRef));
    const existing = snap.exists() ? snap.data() : {};
    const profileData = {
      ...existing,
      ...data,
      onboarding_completed: true,
      updated_at: now,
      created_at: existing?.created_at || now,
    };
    await withTimeout(setDoc(docRef, profileData, { merge: true }));
    return { success: true, data: { id: userId, ...profileData } as UserProfile };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUserProfile(
  updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'profile', 'main');
    const now = new Date().toISOString();
    const snap = await withTimeout(getDoc(docRef));
    const existing = snap.exists() ? snap.data() : {};
    const profileData = {
      ...existing,
      ...updates,
      updated_at: now,
      created_at: existing?.created_at || now,
    };
    await withTimeout(setDoc(docRef, profileData, { merge: true }));
    return { success: true, data: { id: userId, ...profileData } as UserProfile };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// PERSONA PROFILES
// ============================================

export interface PersonaProfile {
  id: string;
  user_id: string;
  persona_name: string;
  target_role: string;
  industry: string;
  key_skills: string[];
  tone: 'formal' | 'conversational' | 'technical';
  base_resume_id?: string;
  created_at: string;
  updated_at: string;
}

export async function getPersonas(): Promise<{
  success: boolean;
  data?: PersonaProfile[];
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'personas');
    const snapshot = await withTimeout(getDocs(colRef));
    return { success: true, data: snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PersonaProfile)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

export async function createPersona(
  data: Omit<PersonaProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; data?: PersonaProfile; error?: string }> {
  try {
    const userId = getUserId();
    const now = new Date().toISOString();
    const docData = { ...data, user_id: userId, created_at: now, updated_at: now };
    const colRef = collection(db, 'users', userId, 'personas');
    const docRef = await withTimeout(addDoc(colRef, docData));
    return { success: true, data: { id: docRef.id, ...docData } as PersonaProfile };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePersona(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    await withTimeout(deleteDoc(doc(db, 'users', userId, 'personas', id)));
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
    const userId = getUserId();
    const now = new Date().toISOString();
    const docData = {
      user_id: userId,
      company_name: data.companyName,
      job_title: data.jobTitle || null,
      job_description: data.jobDescription || null,
      resume_version_id: data.resumeVersionId || null,
      morphed_resume_name: data.morphedResumeName,
      talent_density_score: data.talentDensityScore || null,
      gap_analysis: data.gapAnalysis || null,
      application_link: data.applicationLink || null,
      status: 'not_applied' as const,
      morphed_at: now,
      last_updated: now,
      created_at: now,
    };
    const colRef = collection(db, 'users', userId, 'applications');
    const docRef = await withTimeout(addDoc(colRef, docData));
    return { success: true, data: { id: docRef.id, ...docData } as JobApplication };
  } catch (error: any) {
    console.error('createJobApplication error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getJobApplications(): Promise<{
  success: boolean;
  data?: JobApplication[];
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'applications');
    const snapshot = await withTimeout(getDocs(colRef));
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as JobApplication))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data };
  } catch (error: any) {
    console.error('getJobApplications error:', error.message);
    return { success: false, data: [], error: error.message };
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
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'applications', id);
    const updateData: any = {
      status,
      last_updated: new Date().toISOString(),
    };
    if (additionalData?.appliedAt) updateData.applied_at = additionalData.appliedAt.toISOString();
    if (additionalData?.interviewDate) updateData.interview_date = additionalData.interviewDate.toISOString();
    if (additionalData?.notes !== undefined) updateData.notes = additionalData.notes;

    await withTimeout(updateDoc(docRef, updateData));
    const snap = await withTimeout(getDoc(docRef));
    return { success: true, data: { id: snap.id, ...snap.data() } as JobApplication };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteJobApplication(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    await withTimeout(deleteDoc(doc(db, 'users', userId, 'applications', id)));
    return { success: true };
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
  content: any;
  talent_density_score?: number;
  first_90_days?: any;
  culture_pulse?: any;
  bias_flags?: any;
  created_at: string;
  updated_at: string;
}

export async function saveJDTemplate(
  title: string,
  content: any,
  metadata?: {
    talent_density_score?: number;
    first_90_days?: any;
    culture_pulse?: any;
    bias_flags?: any;
  }
): Promise<{ success: boolean; data?: JDTemplate; error?: string }> {
  try {
    const userId = getUserId();
    const now = new Date().toISOString();
    const docData = {
      user_id: userId,
      title,
      content,
      ...(metadata || {}),
      created_at: now,
      updated_at: now,
    };
    const colRef = collection(db, 'users', userId, 'jd_templates');
    const docRef = await withTimeout(addDoc(colRef, docData));
    return { success: true, data: { id: docRef.id, ...docData } as JDTemplate };
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
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'jd_templates');
    const snapshot = await withTimeout(getDocs(colRef));
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as JDTemplate))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

// ============================================
// COVER LETTERS
// ============================================

export interface CoverLetter {
  id: string;
  user_id: string;
  resume_version_id?: string;
  company: string;
  job_title: string;
  content: string;
  subject: string;
  tone: string;
  template: string;
  key_highlights: string[];
  word_count: number;
  tone_score: number;
  job_description?: string;
  created_at: string;
}

export async function saveCoverLetter(data: {
  resumeVersionId?: string;
  company: string;
  jobTitle: string;
  content: string;
  subject: string;
  tone: string;
  template: string;
  keyHighlights: string[];
  wordCount: number;
  toneScore: number;
  jobDescription?: string;
}): Promise<{ success: boolean; data?: CoverLetter; error?: string }> {
  try {
    const userId = getUserId();
    const now = new Date().toISOString();
    const docData = {
      user_id: userId,
      resume_version_id: data.resumeVersionId || null,
      company: data.company,
      job_title: data.jobTitle,
      content: data.content,
      subject: data.subject,
      tone: data.tone,
      template: data.template,
      key_highlights: data.keyHighlights,
      word_count: data.wordCount,
      tone_score: data.toneScore,
      job_description: data.jobDescription || null,
      created_at: now,
    };
    const colRef = collection(db, 'users', userId, 'cover_letters');
    const docRef = await withTimeout(addDoc(colRef, docData));
    return { success: true, data: { id: docRef.id, ...docData } as CoverLetter };
  } catch (error: any) {
    console.error('saveCoverLetter error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getCoverLetters(): Promise<{
  success: boolean;
  data?: CoverLetter[];
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'cover_letters');
    const snapshot = await withTimeout(getDocs(colRef));
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as CoverLetter))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data };
  } catch (error: any) {
    console.error('getCoverLetters error:', error.message);
    return { success: false, data: [], error: error.message };
  }
}

export async function deleteCoverLetter(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    await withTimeout(deleteDoc(doc(db, 'users', userId, 'cover_letters', id)));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// STUDY PROGRESS (Skill Bridge)
// ============================================

export interface StudyProgress {
  id: string;
  user_id: string;
  skill: string;
  skill_id: string;
  category: 'technical' | 'soft' | 'domain';
  total_days: number;
  completed_days: number[];
  plan_data?: any;
  email_reminders: boolean;
  application_ids?: string[];
  started_at: string;
  last_activity_at: string;
  completed_at?: string;
}

/** Generate a URL-safe skill ID */
function toSkillId(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function saveStudyProgress(
  skill: string,
  category: 'technical' | 'soft' | 'domain',
  planData?: any,
  applicationId?: string
): Promise<{ success: boolean; data?: StudyProgress; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const now = new Date().toISOString();
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);

    // Determine total_days from plan data if available
    const planDays = planData?.schedule?.length;

    // Check if progress already exists
    const existing = await withTimeout(getDoc(docRef));
    if (existing.exists()) {
      const data = existing.data() as StudyProgress;
      const updates: any = { last_activity_at: now };

      // Always update plan_data if a new AI plan was generated
      if (planData) {
        updates.plan_data = planData;
        if (planDays) updates.total_days = planDays;
      }

      let appIds = data.application_ids || [];
      if (applicationId && !appIds.includes(applicationId)) {
        appIds.push(applicationId);
        updates.application_ids = appIds;
      }

      if (Object.keys(updates).length > 1 || appIds !== (data.application_ids || [])) {
        await withTimeout(updateDoc(docRef, updates));
      }

      return {
        success: true,
        data: {
          ...data,
          id: existing.id,
          plan_data: planData || data.plan_data,
          total_days: planDays || data.total_days,
          application_ids: appIds,
        } as StudyProgress,
      };
    }

    const docData = {
      user_id: userId,
      skill,
      skill_id: skillId,
      category,
      total_days: planDays || 4, // default to 4 if no plan
      completed_days: [],
      plan_data: planData || null,
      email_reminders: false,
      application_ids: applicationId ? [applicationId] : [],
      started_at: now,
      last_activity_at: now,
    };
    await withTimeout(setDoc(docRef, docData));
    return { success: true, data: { id: skillId, ...docData } as StudyProgress };
  } catch (error: any) {
    console.error('saveStudyProgress error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getStudyProgress(
  skill: string
): Promise<{ success: boolean; data?: StudyProgress; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);
    const snap = await withTimeout(getDoc(docRef));
    if (!snap.exists()) return { success: true, data: undefined };
    return { success: true, data: { id: snap.id, ...snap.data() } as StudyProgress };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function markDayComplete(
  skill: string,
  day: number
): Promise<{ success: boolean; data?: StudyProgress; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);
    const snap = await withTimeout(getDoc(docRef));

    if (!snap.exists()) {
      return { success: false, error: 'No study progress found for this skill' };
    }

    const current = snap.data();
    const completedDays: number[] = current.completed_days || [];

    if (!completedDays.includes(day)) {
      completedDays.push(day);
      completedDays.sort((a, b) => a - b);
    }

    const now = new Date().toISOString();
    const updates: any = {
      completed_days: completedDays,
      last_activity_at: now,
    };

    // Mark as completed if all days done
    const totalDays = current.total_days || 7;
    if (completedDays.length >= totalDays) {
      updates.completed_at = now;
    }

    await withTimeout(updateDoc(docRef, updates));
    const updated = await withTimeout(getDoc(docRef));
    return { success: true, data: { id: updated.id, ...updated.data() } as StudyProgress };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAllStudyProgress(): Promise<{
  success: boolean;
  data?: StudyProgress[];
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'study_progress');
    const snapshot = await withTimeout(getDocs(colRef));
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as StudyProgress))
      .sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
    return { success: true, data };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

export async function toggleEmailReminders(
  skill: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);
    await withTimeout(updateDoc(docRef, { email_reminders: enabled }));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Remove a day from completed_days (toggle back to incomplete) */
export async function unmarkDayComplete(
  skill: string,
  day: number
): Promise<{ success: boolean; data?: StudyProgress; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);
    const snap = await withTimeout(getDoc(docRef));
    if (!snap.exists()) return { success: false, error: 'No study progress found' };

    const current = snap.data();
    const completedDays: number[] = (current.completed_days || []).filter((d: number) => d !== day);
    const now = new Date().toISOString();

    await withTimeout(updateDoc(docRef, {
      completed_days: completedDays,
      last_activity_at: now,
      completed_at: null, // un-complete the course if a day is removed
    }));
    const updated = await withTimeout(getDoc(docRef));
    return { success: true, data: { id: updated.id, ...updated.data() } as StudyProgress };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Mark all days as complete at once */
export async function markCourseComplete(
  skill: string,
  totalDays: number = 7
): Promise<{ success: boolean; data?: StudyProgress; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);
    const snap = await withTimeout(getDoc(docRef));
    if (!snap.exists()) return { success: false, error: 'No study progress found' };

    const now = new Date().toISOString();
    const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
    await withTimeout(updateDoc(docRef, {
      completed_days: allDays,
      total_days: totalDays,
      last_activity_at: now,
      completed_at: now,
    }));
    const updated = await withTimeout(getDoc(docRef));
    return { success: true, data: { id: updated.id, ...updated.data() } as StudyProgress };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Reset all progress (mark course as incomplete) */
export async function markCourseIncomplete(
  skill: string
): Promise<{ success: boolean; data?: StudyProgress; error?: string }> {
  try {
    const userId = getUserId();
    const skillId = toSkillId(skill);
    const docRef = doc(db, 'users', userId, 'study_progress', skillId);
    const snap = await withTimeout(getDoc(docRef));
    if (!snap.exists()) return { success: false, error: 'No study progress found' };

    const now = new Date().toISOString();
    await withTimeout(updateDoc(docRef, {
      completed_days: [],
      last_activity_at: now,
      completed_at: null,
    }));
    const updated = await withTimeout(getDoc(docRef));
    return { success: true, data: { id: updated.id, ...updated.data() } as StudyProgress };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
