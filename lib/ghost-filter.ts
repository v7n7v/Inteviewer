/**
 * Ghost Job Filter — heuristic-based ghost/stale job detection.
 * No LLM calls. Pure pattern matching and age checks.
 * Scores each listing for ghost risk and returns human-readable reasons.
 */

export type GhostRisk = 'low' | 'medium' | 'high';

export interface GhostAssessment {
  risk: GhostRisk;
  score: number;        // 0-100, higher = more likely ghost
  reasons: string[];
  fresh: boolean;       // true if posted < 7 days
}

interface JobForGhostCheck {
  title: string;
  company: string;
  postedDate?: string | null;
  description: string;
  salary?: { min: number | null; max: number | null } | null;
  url?: string;
  location?: string;
}

// Staffing/recruiting agency patterns
const STAFFING_AGENCIES = [
  'randstad', 'manpower', 'robert half', 'adecco', 'kelly services',
  'insight global', 'tek systems', 'teksystems', 'aerotek', 'hays',
  'kforce', 'apex systems', 'modis', 'collabera', 'cybercoders',
  'staffing', 'recruiting', 'talent solutions', 'consulting group',
];

// Impossibly stacked requirements
const IMPOSSIBLE_COMBOS = [
  { skill: /\b(\d{2,})\+?\s*years?\b/i, extract: (m: RegExpMatchArray) => parseInt(m[1]) },
];

// Generic/vague titles that often indicate ghost listings
const VAGUE_TITLES = [
  /^(entry level|senior|junior|mid)?\s*(developer|engineer|analyst|specialist|associate|coordinator)\s*$/i,
  /multiple\s*(positions|openings|roles)/i,
  /various\s*(locations|positions)/i,
];

// Competitive compensation clichés (no actual number)
const SALARY_CLICHES = [
  /competitive\s*(salary|compensation|pay|package)/i,
  /commensurate\s*with\s*experience/i,
  /excellent\s*(benefits|compensation)\s*package/i,
  /attractive\s*remuneration/i,
];

export function scoreGhostRisk(
  job: JobForGhostCheck,
  allJobs?: JobForGhostCheck[]
): GhostAssessment {
  let score = 0;
  const reasons: string[] = [];

  // ─── Age check ───
  if (job.postedDate) {
    const posted = new Date(job.postedDate);
    const now = new Date();
    const daysOld = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOld > 60) {
      score += 35;
      reasons.push(`Posted ${daysOld} days ago — likely filled or evergreen`);
    } else if (daysOld > 30) {
      score += 20;
      reasons.push(`Posted ${daysOld} days ago — getting stale`);
    } else if (daysOld > 14) {
      score += 5;
    }
  } else {
    score += 8;
    reasons.push('No posting date available');
  }

  // ─── Duplicate detection ───
  if (allJobs && allJobs.length > 1) {
    const companyLower = job.company.toLowerCase().trim();
    const titleLower = job.title.toLowerCase().trim();
    const sameCompanyJobs = allJobs.filter(
      j => j.company.toLowerCase().trim() === companyLower
    );
    const sameTitleJobs = sameCompanyJobs.filter(
      j => j.title.toLowerCase().trim() === titleLower
    );

    if (sameTitleJobs.length >= 5) {
      score += 25;
      reasons.push(`${sameTitleJobs.length} identical roles posted by ${job.company}`);
    } else if (sameTitleJobs.length >= 3) {
      score += 12;
      reasons.push(`${sameTitleJobs.length} similar roles at ${job.company}`);
    }

    if (sameCompanyJobs.length >= 10) {
      score += 10;
      reasons.push(`${sameCompanyJobs.length} total openings — possible mass listing`);
    }
  }

  // ─── Staffing agency check ───
  const companyLower = job.company.toLowerCase();
  if (STAFFING_AGENCIES.some(agency => companyLower.includes(agency))) {
    score += 15;
    reasons.push('Posted by staffing/recruiting agency');
  }

  // ─── Vague title check ───
  if (VAGUE_TITLES.some(pattern => pattern.test(job.title))) {
    score += 10;
    reasons.push('Generic/vague job title');
  }

  // ─── Salary cliché check (no actual number) ───
  const hasSalaryData = job.salary && (job.salary.min || job.salary.max);
  if (!hasSalaryData) {
    const desc = job.description.toLowerCase();
    if (SALARY_CLICHES.some(pattern => pattern.test(desc))) {
      score += 8;
      reasons.push('"Competitive compensation" without actual numbers');
    }
  }

  // ─── Impossible requirements ───
  const desc = job.description;
  const yearsMatches = desc.matchAll(/(\d{2,})\+?\s*years?\s*(of\s*)?(experience|expertise)/gi);
  for (const match of yearsMatches) {
    const years = parseInt(match[1]);
    if (years >= 15) {
      score += 15;
      reasons.push(`Requires ${years}+ years — likely evergreen/aspirational listing`);
      break;
    } else if (years >= 10) {
      score += 5;
    }
  }

  // ─── Description too short ───
  if (job.description.length < 100) {
    score += 12;
    reasons.push('Extremely short job description');
  } else if (job.description.length < 200) {
    score += 5;
    reasons.push('Very brief job description');
  }

  // ─── Clamp and classify ───
  score = Math.min(100, Math.max(0, score));

  const risk: GhostRisk =
    score >= 40 ? 'high' :
    score >= 20 ? 'medium' :
    'low';

  const fresh = job.postedDate
    ? (new Date().getTime() - new Date(job.postedDate).getTime()) < (7 * 24 * 60 * 60 * 1000)
    : false;

  return { risk, score, reasons, fresh };
}

/** Batch score all jobs, passing the full array for duplicate detection */
export function scoreAllGhostRisks(jobs: JobForGhostCheck[]): GhostAssessment[] {
  return jobs.map(job => scoreGhostRisk(job, jobs));
}
