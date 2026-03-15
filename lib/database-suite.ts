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

