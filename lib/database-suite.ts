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
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
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
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function saveResumeVersion(
  versionName: string,
  content: Resume,
  skillGraph: any,
  mode: 'technical' | 'leadership' = 'technical',
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: ResumeVersion; error?: string }> {
  try {
    const userId = getUserId();
    const now = new Date().toISOString();
    const colRef = collection(db, 'users', userId, 'resume_versions');
    const docData = {
      user_id: userId,
      version_name: versionName,
      content: stripUndefined(content),
      skill_graph: stripUndefined(skillGraph),
      mode,
      is_active: true,
      metadata: stripUndefined(metadata),
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

/** Recursively replace `undefined` with `null` — Firestore rejects undefined. */
function stripUndefined(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = v === undefined ? null : stripUndefined(v);
  }
  return clean;
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
  // Outcome tracking
  outcome_response?: 'callback' | 'interview' | 'offer' | 'rejection' | 'ghosted' | null;
  outcome_reported_at?: string;
  outcome_days_to_response?: number;
  outcome_source?: 'user_prompt' | 'email_nudge' | 'manual';
  callback_count?: number;
  interview_rounds?: number;
  offer_amount?: number;
  offer_details?: OfferDetails | null;
  negotiation_brief?: NegotiationBrief | null;
  negotiation_status?: 'not_started' | 'drafted' | 'counter_sent' | 'accepted' | 'declined';
  negotiation_generated_at?: string;
}

export interface OfferDetails {
  base?: number | null;
  total?: number | null;
  bonus?: number | null;
  signOn?: number | null;
  desiredBase?: number | null;
  desiredTotal?: number | null;
  equity?: string | null;
  benefits?: string | null;
  deadline?: string | null;
  competingOffer?: boolean;
  context?: string | null;
}

export interface NegotiationBrief {
  marketRange?: { low: number; mid: number; high: number };
  verdict?: 'below_market' | 'at_market' | 'above_market';
  verdictMessage?: string;
  counterStrategy?: string;
  emailScript?: string;
  phoneScript?: string;
  batna?: string;
  leveragePoints?: string[];
  nonSalaryAsks?: string[];
  redFlags?: string[];
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

export async function updateApplicationOffer(
  id: string,
  updates: {
    offerDetails?: OfferDetails | null;
    negotiationBrief?: NegotiationBrief | null;
    negotiationStatus?: JobApplication['negotiation_status'];
  }
): Promise<{ success: boolean; data?: JobApplication; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'applications', id);
    const updateData: any = { last_updated: new Date().toISOString() };

    if (updates.offerDetails !== undefined) {
      updateData.offer_details = stripUndefined(updates.offerDetails);
      const amount = updates.offerDetails?.base || updates.offerDetails?.total;
      if (amount) updateData.offer_amount = amount;
    }
    if (updates.negotiationBrief !== undefined) {
      updateData.negotiation_brief = stripUndefined(updates.negotiationBrief);
      updateData.negotiation_generated_at = updates.negotiationBrief ? new Date().toISOString() : null;
    }
    if (updates.negotiationStatus) {
      updateData.negotiation_status = updates.negotiationStatus;
    }

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

// Outcome tracking
export async function reportApplicationOutcome(
  id: string,
  outcome: NonNullable<JobApplication['outcome_response']>,
  metadata?: { interviewRounds?: number; offerAmount?: number; source?: JobApplication['outcome_source'] }
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'applications', id);
    const snap = await withTimeout(getDoc(docRef));
    if (!snap.exists()) return { success: false, error: 'Application not found' };

    const appData = snap.data();
    const appliedAt = appData.applied_at || appData.created_at;
    const daysToResponse = Math.floor((Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24));

    // Auto-sync status if needed
    const statusMap: Record<string, JobApplication['status']> = {
      callback: 'screening', interview: 'interview_scheduled', offer: 'offer', rejection: 'rejected',
    };

    const updateData: any = {
      outcome_response: outcome,
      outcome_reported_at: new Date().toISOString(),
      outcome_days_to_response: daysToResponse,
      outcome_source: metadata?.source || 'manual',
      last_updated: new Date().toISOString(),
    };
    if (metadata?.interviewRounds) updateData.interview_rounds = metadata.interviewRounds;
    if (metadata?.offerAmount) updateData.offer_amount = metadata.offerAmount;
    if (statusMap[outcome] && appData.status === 'applied') updateData.status = statusMap[outcome];

    await withTimeout(updateDoc(docRef, updateData));

    // Save one analytics record per application so changing an outcome does not double-count.
    await withTimeout(setDoc(doc(db, 'users', userId, 'outcomes', id), {
      application_id: id,
      company: appData.company_name,
      job_title: appData.job_title || '',
      outcome,
      days_to_response: daysToResponse,
      match_score: appData.talent_density_score || null,
      reported_at: new Date().toISOString(),
    }, { merge: true }));

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPendingOutcomeChecks(): Promise<{ success: boolean; data?: JobApplication[]; error?: string }> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'applications');
    const snapshot = await withTimeout(getDocs(colRef));
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const pending = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as JobApplication))
      .filter(app => {
        if (app.outcome_response) return false;
        if (app.status !== 'applied') return false;
        const appliedAt = app.applied_at || app.created_at;
        return new Date(appliedAt).getTime() < sevenDaysAgo;
      })
      .sort((a, b) => new Date(a.applied_at || a.created_at).getTime() - new Date(b.applied_at || b.created_at).getTime());

    return { success: true, data: pending };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

export async function getOutcomeStats(): Promise<{
  success: boolean;
  data?: {
    total: number; responded: number; ghosted: number;
    responseRate: number; avgDaysToResponse: number;
    interviewRate: number; offerRate: number; ghostRate: number;
  };
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'outcomes');
    const snapshot = await withTimeout(getDocs(colRef));
    const outcomes = snapshot.docs.map(d => d.data());

    const appsColRef = collection(db, 'users', userId, 'applications');
    const appsSnap = await withTimeout(getDocs(appsColRef));
    const appliedCount = appsSnap.docs.filter(d => d.data().status !== 'not_applied').length;

    const responded = outcomes.filter(o => o.outcome !== 'ghosted').length;
    const interviews = outcomes.filter(o => ['interview', 'offer'].includes(o.outcome)).length;
    const offers = outcomes.filter(o => o.outcome === 'offer').length;
    const ghosts = outcomes.filter(o => o.outcome === 'ghosted').length;
    const daysArr = outcomes.filter(o => o.days_to_response).map(o => o.days_to_response);
    const avgDays = daysArr.length > 0 ? Math.round(daysArr.reduce((a: number, b: number) => a + b, 0) / daysArr.length) : 0;

    return {
      success: true,
      data: {
        total: appliedCount,
        responded,
        ghosted: ghosts,
        responseRate: appliedCount > 0 ? Math.round((responded / appliedCount) * 100) : 0,
        avgDaysToResponse: avgDays,
        interviewRate: appliedCount > 0 ? Math.round((interviews / appliedCount) * 100) : 0,
        offerRate: appliedCount > 0 ? Math.round((offers / appliedCount) * 100) : 0,
        ghostRate: appliedCount > 0 ? Math.round((ghosts / appliedCount) * 100) : 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// AGENT QUEUE
// ============================================

export interface AgentQueueItem {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  location: string;
  job_url: string;
  job_description: string;
  salary: { min: number | null; max: number | null };
  employment_type: string;
  posted_date: string;
  match_score: number;
  match_reason: string;
  morphed_resume: any;
  cover_letter: string;
  resume_version_id?: string;
  status: 'pending' | 'approved' | 'dismissed' | 'applied' | 'expired';
  source?: 'nightly_agent' | 'sona_chat' | 'manual' | 'job_search' | 'legacy_sona';
  packetStatus?: 'prepared' | 'needs_review' | 'approved' | 'applied' | 'dismissed' | 'expired' | 'assist_apply';
  fitSignals?: string[];
  riskSignals?: string[];
  nextAction?: string;
  feedbackTags?: string[];
  agentRunId?: string;
  created_at: string;
  expires_at: string;
  reviewed_at?: string;
  applied_at?: string;
  assisted_at?: string;
  last_action_at?: string;
  application_id?: string;
  batch_id: string;
  batch_date: string;
}

function normalizeLegacySonaQueueItem(id: string, data: any): AgentQueueItem {
  const createdAt = data.createdAt || data.created_at || new Date().toISOString();
  return {
    id,
    user_id: data.user_id || '',
    job_title: data.role || data.job_title || 'Queued role',
    company: data.company || 'Unknown company',
    location: data.location || 'Not specified',
    job_url: data.url || data.job_url || '',
    job_description: data.jobDescription || data.job_description || '',
    salary: data.salary || { min: null, max: null },
    employment_type: data.employment_type || data.employmentType || 'Not specified',
    posted_date: data.posted_date || createdAt,
    match_score: Number(data.fitScore || data.match_score || 0),
    match_reason: data.resumeSummary || data.match_reason || 'Queued by Sona for your review.',
    morphed_resume: data.morphed_resume || null,
    cover_letter: data.coverLetterPreview || data.cover_letter || '',
    status: data.status === 'queued' ? 'pending' : (data.status || 'pending'),
    source: 'legacy_sona',
    packetStatus: 'needs_review',
    fitSignals: data.fitSignals || [],
    riskSignals: data.riskSignals || ['Legacy Sona packet may need a fresh resume or cover letter pass.'],
    nextAction: 'Review the packet and ask Sona to refine it before applying.',
    feedbackTags: data.feedbackTags || [],
    created_at: createdAt,
    expires_at: data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    batch_id: data.batch_id || 'legacy_sona',
    batch_date: data.batch_date || createdAt.split('T')[0],
  };
}

export async function getAgentQueue(
  statusFilter?: AgentQueueItem['status']
): Promise<{ success: boolean; data?: AgentQueueItem[]; error?: string }> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'agent_queue');
    const legacyRef = collection(db, 'users', userId, 'applicationQueue');
    const [snapshot, legacySnapshot] = await Promise.all([
      withTimeout(getDocs(colRef)),
      withTimeout(getDocs(legacyRef)).catch(() => ({ docs: [] as any[] })),
    ]);

    const canonicalItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AgentQueueItem));
    const canonicalKeys = new Set(canonicalItems.map(i => `${i.company?.toLowerCase()?.trim()}|${i.job_title?.toLowerCase()?.trim()}`));
    const legacyItems = legacySnapshot.docs
      .map((d: any) => normalizeLegacySonaQueueItem(d.id, d.data()))
      .filter((item: AgentQueueItem) => !canonicalKeys.has(`${item.company?.toLowerCase()?.trim()}|${item.job_title?.toLowerCase()?.trim()}`));

    let items = [...canonicalItems, ...legacyItems]
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

    // Auto-expire old items
    const now = new Date().toISOString();
    for (const item of items) {
      if (item.status === 'pending' && item.expires_at < now) {
        if (item.source !== 'legacy_sona') {
          await updateDoc(doc(db, 'users', userId, 'agent_queue', item.id), { status: 'expired', packetStatus: 'expired' });
        }
        item.status = 'expired';
        item.packetStatus = 'expired';
      }
    }

    if (statusFilter) {
      items = items.filter(i => i.status === statusFilter);
    }
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

export async function updateQueueItem(
  id: string,
  action: 'approve' | 'dismiss'
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'agent_queue', id);
    const now = new Date().toISOString();
    await withTimeout(updateDoc(docRef, {
      status: action === 'approve' ? 'approved' : 'dismissed',
      packetStatus: action === 'approve' ? 'approved' : 'dismissed',
      reviewed_at: now,
      last_action_at: now,
    }));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function applyFromQueue(id: string): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    const userId = getUserId();
    const queueRef = doc(db, 'users', userId, 'agent_queue', id);
    const snap = await withTimeout(getDoc(queueRef));
    if (!snap.exists()) return { success: false, error: 'Queue item not found' };

    const item = snap.data() as AgentQueueItem;
    const now = new Date().toISOString();

    // Create application from queue item
    const appData = {
      user_id: userId,
      company_name: item.company,
      job_title: item.job_title,
      job_description: item.job_description,
      resume_version_id: item.resume_version_id || null,
      morphed_resume_name: `${item.company} — ${item.job_title}`,
      talent_density_score: item.match_score,
      application_link: item.job_url,
      status: 'not_applied' as const,
      morphed_at: item.created_at,
      applied_at: null,
      last_updated: now,
      created_at: now,
      source: 'agent_queue',
    };

    const appRef = await addDoc(collection(db, 'users', userId, 'applications'), appData);

    // Update queue item
    await updateDoc(queueRef, {
      status: item.status === 'pending' ? 'approved' : item.status,
      packetStatus: 'assist_apply',
      assisted_at: now,
      last_action_at: now,
      application_id: appRef.id,
    });

    return { success: true, applicationId: appRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateQueueFeedback(
  id: string,
  feedbackTags: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'agent_queue', id);
    await withTimeout(updateDoc(docRef, {
      feedbackTags: feedbackTags.slice(0, 12),
      last_action_at: new Date().toISOString(),
    }));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAgentStats(): Promise<{
  success: boolean;
  data?: { pending: number; approved: number; applied: number; dismissed: number; total: number };
  error?: string;
}> {
  try {
    const userId = getUserId();
    const queueRes = await getAgentQueue();
    const items = queueRes.data || [];

    return {
      success: true,
      data: {
        pending: items.filter(i => i.status === 'pending').length,
        approved: items.filter(i => i.status === 'approved').length,
        applied: items.filter(i => i.status === 'applied').length,
        dismissed: items.filter(i => i.status === 'dismissed').length,
        total: items.length,
      },
    };
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
      metadata: stripUndefined(data.metadata || {}),
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
// WRITING TRUST SESSIONS
// ============================================

export interface WritingSession {
  id: string;
  user_id: string;
  title: string;
  source_file_name?: string | null;
  input_text?: string;
  final_text?: string;
  domain: string;
  tone: string;
  length_mode: string;
  mode?: string | null;
  step: string;
  original_score?: number | null;
  final_score?: number | null;
  uniqueness_score?: number | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function saveWritingSession(data: {
  title: string;
  sourceFileName?: string | null;
  inputText?: string;
  finalText?: string;
  domain: string;
  tone: string;
  lengthMode: string;
  mode?: string | null;
  step: string;
  originalScore?: number | null;
  finalScore?: number | null;
  uniquenessScore?: number | null;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; data?: WritingSession; error?: string }> {
  try {
    const userId = getUserId();
    const now = new Date().toISOString();
    const docData = stripUndefined({
      user_id: userId,
      title: data.title,
      source_file_name: data.sourceFileName || null,
      input_text: data.inputText || '',
      final_text: data.finalText || '',
      domain: data.domain,
      tone: data.tone,
      length_mode: data.lengthMode,
      mode: data.mode || null,
      step: data.step,
      original_score: data.originalScore ?? null,
      final_score: data.finalScore ?? null,
      uniqueness_score: data.uniquenessScore ?? null,
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now,
    });
    const docRef = await withTimeout(addDoc(collection(db, 'users', userId, 'writing_sessions'), docData));
    return { success: true, data: { id: docRef.id, ...docData } as WritingSession };
  } catch (error: any) {
    console.error('saveWritingSession error:', error.message);
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
  job_title?: string;
  company_name?: string;
  readiness_status?: 'learning' | 'ready_to_verify' | 'verified' | 'review_due';
  readiness_score?: number;
  proof_level?: 'none' | 'quick_check' | 'applied_challenge' | 'interview_drill';
  last_verified_at?: string;
  next_review_at?: string;
  verification_attempt_ids?: string[];
  source_context?: 'resume' | 'application' | 'pasted_jd' | 'manual';
  started_at: string;
  last_activity_at: string;
  completed_at?: string;
}

export interface SkillVerification {
  id: string;
  user_id: string;
  skill: string;
  skill_id: string;
  category: 'technical' | 'soft' | 'domain';
  applicationId?: string | null;
  sourceContext?: 'resume' | 'application' | 'pasted_jd' | 'manual';
  challengeType: 'quick_check' | 'applied_challenge' | 'interview_drill';
  prompt: string;
  response: string;
  score: number;
  verdict: 'needs_work' | 'building' | 'ready' | 'verified';
  rubric?: { label: string; score: number; note: string }[];
  strengths?: string[];
  gaps?: string[];
  recommendations?: string[];
  createdAt: string;
}

/** Generate a URL-safe skill ID */
function toSkillId(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function saveStudyProgress(
  skill: string,
  category: 'technical' | 'soft' | 'domain',
  planData?: any,
  applicationId?: string,
  jobContext?: { jobTitle?: string; companyName?: string }
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
      // Update job context if provided and not already set
      if (jobContext?.jobTitle && !data.job_title) updates.job_title = jobContext.jobTitle;
      if (jobContext?.companyName && !data.company_name) updates.company_name = jobContext.companyName;

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
      total_days: planDays || 4,
      completed_days: [],
      plan_data: planData || null,
      email_reminders: false,
      application_ids: applicationId ? [applicationId] : [],
      job_title: jobContext?.jobTitle || null,
      company_name: jobContext?.companyName || null,
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

export async function getSkillVerifications(): Promise<{
  success: boolean;
  data?: SkillVerification[];
  error?: string;
}> {
  try {
    const userId = getUserId();
    const colRef = collection(db, 'users', userId, 'skill_verifications');
    const snapshot = await withTimeout(getDocs(colRef));
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as SkillVerification))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
