'use client';

/**
 * Resume Data Normalizer
 * Single source of truth for resume data shape.
 * Every AI response (morph, auto-fix, parse, build) runs through this
 * BEFORE touching React state or template rendering.
 */

// ============================================================
// CANONICAL RESUME SCHEMA
// ============================================================
export interface CanonicalExperience {
  company: string;
  role: string;
  duration: string;
  achievements: string[];
}

export interface CanonicalEducation {
  degree: string;
  institution: string;
  year: string;
  details?: string;
}

export interface CanonicalSkillGroup {
  category: string;
  items: string[];
}

export interface CanonicalResume {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  summary: string;
  experience: CanonicalExperience[];
  education: CanonicalEducation[];
  skills: CanonicalSkillGroup[];
  certifications: string[];
}

// ============================================================
// SKILL NORMALIZER
// Handles every format the AI might return:
//  - ["Python", "Java"]           → [{category: "Skills", items: [...]}]
//  - "Python, Java, React"        → [{category: "Skills", items: [...]}]
//  - [{category, items}]          → passthrough
//  - [{name: "Python", level: 5}] → [{category: "Skills", items: [...]}]
// ============================================================
function normalizeSkills(raw: any, fallback?: any[]): CanonicalSkillGroup[] {
  if (!raw || (Array.isArray(raw) && raw.length === 0)) {
    return fallback ? normalizeSkills(fallback) : [];
  }

  // String → split into items
  if (typeof raw === 'string') {
    const items = raw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
    return items.length > 0 ? [{ category: 'Skills', items }] : [];
  }

  if (!Array.isArray(raw)) return [];

  const first = raw[0];

  // Already structured: [{category: "Technical", items: ["Python"]}]
  if (typeof first === 'object' && first !== null && Array.isArray(first.items)) {
    return raw.map((s: any) => ({
      category: String(s.category || s.name || 'Skills'),
      items: (s.items || []).map((i: any) => String(i)).filter(Boolean),
    })).filter((s: CanonicalSkillGroup) => s.items.length > 0);
  }

  // Flat strings: ["Python", "Java"]
  if (typeof first === 'string') {
    const items = raw.map((s: any) => String(s).trim()).filter(Boolean);
    return items.length > 0 ? [{ category: 'Skills', items }] : [];
  }

  // Object with name/level: [{name: "Python", level: 5}]
  if (typeof first === 'object' && first !== null && (first.name || first.skill)) {
    const items = raw.map((s: any) => String(s.name || s.skill || '')).filter(Boolean);
    return items.length > 0 ? [{ category: 'Skills', items }] : [];
  }

  return [];
}

// ============================================================
// EXPERIENCE NORMALIZER
// Handles: role vs title, missing achievements, etc.
// ============================================================
function normalizeExperience(raw: any): CanonicalExperience[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((exp: any) => ({
    company: String(exp.company || exp.organization || ''),
    role: String(exp.role || exp.title || exp.position || ''),
    duration: String(exp.duration || exp.dates || exp.period || ''),
    achievements: normalizeStringArray(exp.achievements || exp.bullets || exp.highlights || []),
  })).filter((e: CanonicalExperience) => e.company || e.role);
}

// ============================================================
// EDUCATION NORMALIZER
// Handles: institution vs school, missing year, etc.
// ============================================================
function normalizeEducation(raw: any): CanonicalEducation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((edu: any) => ({
    degree: String(edu.degree || edu.program || ''),
    institution: String(edu.institution || edu.school || edu.university || ''),
    year: String(edu.year || edu.graduation || edu.date || ''),
    details: edu.details ? String(edu.details) : undefined,
  })).filter((e: CanonicalEducation) => e.degree || e.institution);
}

// ============================================================
// CERTIFICATIONS NORMALIZER
// ============================================================
function normalizeCertifications(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) {
    return raw.map((c: any) => {
      if (typeof c === 'string') return c;
      if (typeof c === 'object' && c !== null) return String(c.name || c.title || c.cert || '');
      return '';
    }).filter(Boolean);
  }
  return [];
}

// ============================================================
// UTILITY
// ============================================================
function normalizeStringArray(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.map((s: any) => String(s)).filter(Boolean);
  return [];
}

// ============================================================
// MAIN NORMALIZER
// ============================================================
export function normalizeResume(raw: any, original?: any): CanonicalResume {
  if (!raw) {
    return {
      name: '', title: '', email: '', phone: '', location: '',
      summary: '', experience: [], education: [], skills: [], certifications: [],
    };
  }

  return {
    name: String(raw.name || ''),
    title: String(raw.title || raw.role || raw.position || ''),
    email: String(raw.email || ''),
    phone: String(raw.phone || raw.tel || ''),
    location: String(raw.location || raw.address || raw.city || ''),
    linkedin: raw.linkedin ? String(raw.linkedin) : undefined,
    website: raw.website ? String(raw.website) : undefined,
    summary: String(raw.summary || raw.objective || raw.about || ''),
    experience: normalizeExperience(raw.experience),
    education: normalizeEducation(raw.education),
    skills: normalizeSkills(raw.skills, original?.skills),
    certifications: normalizeCertifications(raw.certifications),
  };
}

// ============================================================
// SERIALIZER (for sending to AI APIs)
// Handles both formats safely — replaces inline serializeSkills()
// ============================================================
export function serializeResumeToText(resume: CanonicalResume): string {
  const sections: string[] = [];

  if (resume.name) sections.push(resume.name);
  if (resume.title) sections.push(resume.title);
  if (resume.email) sections.push(resume.email);
  if (resume.phone) sections.push(resume.phone);
  if (resume.location) sections.push(resume.location);
  if (resume.summary) sections.push(resume.summary);

  for (const exp of resume.experience) {
    const line = `${exp.role} at ${exp.company}${exp.duration ? ` (${exp.duration})` : ''}: ${exp.achievements.join('. ')}`;
    sections.push(line);
  }

  for (const edu of resume.education) {
    sections.push(`${edu.degree} from ${edu.institution}${edu.year ? ` (${edu.year})` : ''}`);
  }

  const skillText = resume.skills
    .map(s => s.category ? `${s.category}: ${s.items.join(', ')}` : s.items.join(', '))
    .join('; ');
  if (skillText) sections.push(`Skills: ${skillText}`);

  if (resume.certifications.length > 0) {
    sections.push(`Certifications: ${resume.certifications.join(', ')}`);
  }

  return sections.filter(Boolean).join('\n');
}
