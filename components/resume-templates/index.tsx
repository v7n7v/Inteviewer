'use client';

/**
 * Resume Templates — 18 ATS-Safe Single-Column Designs
 * Every template is deterministic: same data → same output.
 * All single-column for maximum ATS compatibility.
 */

import type { CanonicalResume, CanonicalSkillGroup, CanonicalExperience, CanonicalEducation } from '@/lib/resume-normalizer';

interface TemplateProps {
  resume: CanonicalResume;
  colors: { primary: string; accent: string; text: string };
}

// ============================================================
// SHARED SECTION RENDERERS
// ============================================================

function ContactBar({ resume, separator = '|', className = '' }: { resume: CanonicalResume; separator?: string; className?: string }) {
  const items = [resume.email, resume.phone, resume.location, resume.linkedin, resume.website].filter(Boolean);
  return (
    <div className={`flex flex-wrap gap-2 text-sm text-gray-500 ${className}`}>
      {items.map((item, i) => (
        <span key={i}>{i > 0 && <span className="mr-2">{separator}</span>}{item}</span>
      ))}
    </div>
  );
}

function SkillsGrid({ skills, colors, layout = 'category' }: { skills: CanonicalSkillGroup[]; colors: TemplateProps['colors']; layout?: 'category' | 'pills' | 'inline' | 'compact' }) {
  if (!skills?.length) return null;

  if (layout === 'pills') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {skills.flatMap(s => s.items).map((skill, i) => (
          <span key={i} className="px-2 py-0.5 rounded text-xs border" style={{ borderColor: `${colors.primary}30`, color: colors.primary }}>{skill}</span>
        ))}
      </div>
    );
  }

  if (layout === 'inline') {
    return (
      <div>
        {skills.map((cat, i) => (
          <div key={i} className="flex gap-2 mb-1 text-sm">
            <span className="font-bold text-gray-700 min-w-[120px]">{cat.category}:</span>
            <span className="text-gray-600">{cat.items.join(', ')}</span>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <div className="flex flex-wrap gap-2">
        {skills.flatMap(s => s.items).map((skill, i, arr) => (
          <span key={i} className="text-sm text-gray-600">{skill}{i < arr.length - 1 ? ',' : ''}</span>
        ))}
      </div>
    );
  }

  // Default: category grid
  return (
    <div className="space-y-2">
      {skills.map((cat, i) => (
        <div key={i}>
          <p className="text-sm font-semibold text-gray-700">{cat.category}</p>
          <p className="text-sm text-gray-600">{cat.items.join(' • ')}</p>
        </div>
      ))}
    </div>
  );
}

function ExperienceList({ experience, colors, style = 'default', companyFirst = false }: {
  experience: CanonicalExperience[];
  colors: TemplateProps['colors'];
  style?: 'default' | 'timeline' | 'boxed' | 'minimal' | 'compact';
  companyFirst?: boolean;
}) {
  if (!experience?.length) return null;

  return (
    <div>
      {experience.map((exp, i) => (
        <div key={i} className={`mb-4 ${style === 'timeline' ? 'pl-4 border-l-2' : ''} ${style === 'boxed' ? 'p-4 bg-gray-50 rounded-xl' : ''}`} style={style === 'timeline' ? { borderColor: colors.accent } : {}}>
          <div className="flex justify-between items-baseline">
            <div>
              {companyFirst ? (
                <><span className="font-bold text-gray-900">{exp.company}</span><span className="text-gray-500">, </span><span className="italic text-gray-700">{exp.role}</span></>
              ) : (
                <h3 className="font-bold text-gray-900">{exp.role}</h3>
              )}
            </div>
            <span className={`text-sm text-gray-500 ml-2 whitespace-nowrap ${style === 'boxed' ? 'px-3 py-1 rounded-full bg-white' : ''}`}>{exp.duration}</span>
          </div>
          {!companyFirst && <p className="text-sm text-gray-600" style={{ color: colors.accent }}>{exp.company}</p>}
          <ul className={`mt-2 space-y-1 ${style === 'compact' ? 'columns-1' : ''}`}>
            {exp.achievements.map((a, j) => (
              <li key={j} className="text-sm text-gray-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400">{a}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EducationList({ education, colors, layout = 'default' }: {
  education: CanonicalEducation[];
  colors: TemplateProps['colors'];
  layout?: 'default' | 'compact' | 'center';
}) {
  if (!education?.length) return null;

  return (
    <div>
      {education.map((edu, i) => (
        <div key={i} className={`mb-2 ${layout === 'center' ? 'text-center' : ''}`}>
          <p className="font-semibold text-gray-900">{edu.degree}</p>
          <p className="text-sm text-gray-500">{edu.institution}{edu.year ? ` • ${edu.year}` : ''}</p>
          {edu.details && <p className="text-xs text-gray-400 mt-0.5">{edu.details}</p>}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children, colors, style = 'default' }: {
  children: React.ReactNode;
  colors: TemplateProps['colors'];
  style?: 'default' | 'border' | 'uppercase' | 'center' | 'tracked' | 'mono';
}) {
  const base = 'mb-3';
  if (style === 'border') return <h2 className={`${base} text-sm font-bold uppercase tracking-wider border-b pb-1`} style={{ color: colors.primary, borderColor: `${colors.primary}40` }}>{children}</h2>;
  if (style === 'uppercase') return <h2 className={`${base} text-sm uppercase tracking-widest text-gray-400`}>{children}</h2>;
  if (style === 'center') return (
    <div className={`${base} flex items-center gap-4`}>
      <div className="h-px flex-1" style={{ backgroundColor: `${colors.accent}40` }} />
      <h2 className="text-xs uppercase tracking-[0.3em] font-semibold" style={{ color: colors.primary }}>{children}</h2>
      <div className="h-px flex-1" style={{ backgroundColor: `${colors.accent}40` }} />
    </div>
  );
  if (style === 'tracked') return <h2 className={`${base} text-[11px] uppercase tracking-[0.25em] font-medium`} style={{ color: colors.accent }}>{children}</h2>;
  if (style === 'mono') return <h2 className={`${base} font-bold uppercase tracking-wider font-mono`} style={{ color: colors.primary }}>// {children}</h2>;
  return <h2 className={`${base} text-lg font-bold uppercase tracking-wider`} style={{ color: colors.primary }}>{children}</h2>;
}

// ============================================================
// TEMPLATE 1: EXECUTIVE — Clean professional for senior roles
// ============================================================
function ExecutiveTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10 font-serif" style={{ color: colors.text }}>
      <div className="border-b-4 pb-6 mb-6" style={{ borderColor: colors.primary }}>
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-xl mt-1" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} className="mt-3" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors}>Professional Summary</SectionTitle><p className="text-gray-700 leading-relaxed">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors}>Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} /></div>}
      <div className="grid grid-cols-2 gap-6">
        {resume.education.length > 0 && <div><SectionTitle colors={colors}>Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
        {resume.skills.length > 0 && <div><SectionTitle colors={colors}>Skills</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} /></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 2: MINIMAL — Centered, lots of whitespace
// ============================================================
function MinimalTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-light tracking-wide">{resume.name}</h1>
        <p className="text-gray-500 mt-1">{resume.title}</p>
        <ContactBar resume={resume} separator="•" className="justify-center mt-3" />
      </div>
      {resume.summary && <div className="border-t border-gray-200 pt-6 mb-6"><p className="text-gray-700 text-center max-w-2xl mx-auto">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-8"><SectionTitle colors={colors} style="uppercase">Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="minimal" /></div>}
      <div className="grid grid-cols-2 gap-8">
        {resume.education.length > 0 && <div><SectionTitle colors={colors} style="uppercase">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
        {resume.skills.length > 0 && <div><SectionTitle colors={colors} style="uppercase">Skills</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="compact" /></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 3: COMPACT — Dense one-page, small type
// ============================================================
function CompactTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-6 text-xs" style={{ color: colors.text }}>
      <div className="flex justify-between items-end border-b-2 pb-3 mb-4" style={{ borderColor: colors.primary }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{resume.title}</p>
        </div>
        <div className="text-right text-gray-500 space-y-0.5">
          {resume.email && <p>{resume.email}</p>}
          {resume.phone && <p>{resume.phone}</p>}
          {resume.location && <p>{resume.location}</p>}
        </div>
      </div>
      {resume.summary && <div className="mb-3 p-2.5 rounded" style={{ backgroundColor: `${colors.primary}08` }}><p className="text-gray-700 leading-relaxed">{resume.summary}</p></div>}
      {resume.skills.length > 0 && <div className="mb-3"><SectionTitle colors={colors} style="border">Core Competencies</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="pills" /></div>}
      {resume.experience.length > 0 && <div className="mb-3"><SectionTitle colors={colors} style="border">Professional Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="compact" /></div>}
      <div className="grid grid-cols-2 gap-4">
        {resume.education.length > 0 && <div><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} layout="compact" /></div>}
        {resume.certifications.length > 0 && <div><SectionTitle colors={colors} style="border">Certifications</SectionTitle><ul>{resume.certifications.map((c, i) => <li key={i} className="text-gray-600 mb-1">• {c}</li>)}</ul></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 4: TECHNICAL — Monospace code-style
// ============================================================
function TechnicalTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-8 font-mono text-sm" style={{ color: colors.text }}>
      <div className="border-b-2 pb-4 mb-6" style={{ borderColor: colors.primary }}>
        <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-lg" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="|" className="mt-2" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="mono">Summary</SectionTitle><p className="text-gray-700 bg-gray-50 p-3 rounded border-l-4" style={{ borderColor: colors.accent }}>{resume.summary}</p></div>}
      {resume.skills.length > 0 && (
        <div className="mb-6">
          <SectionTitle colors={colors} style="mono">Technical Skills</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {resume.skills.map((cat, i) => <div key={i} className="p-3 bg-gray-50 rounded"><p className="font-bold text-gray-700 mb-1">{cat.category}:</p><p className="text-gray-600">{cat.items.join(', ')}</p></div>)}
          </div>
        </div>
      )}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="mono">Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="boxed" /></div>}
      {resume.education.length > 0 && <div><SectionTitle colors={colors} style="mono">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 5: HARVARD — Education-first, traditional academic
// ============================================================
function HarvardTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10 font-serif" style={{ color: colors.text }}>
      <div className="text-center border-b-2 pb-5 mb-6" style={{ borderColor: colors.primary }}>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: colors.primary }}>{resume.name}</h1>
        <ContactBar resume={resume} separator="|" className="justify-center mt-2" />
      </div>
      {resume.education.length > 0 && <div className="mb-5"><SectionTitle colors={colors} style="border">Education</SectionTitle>{resume.education.map((edu, i) => (<div key={i} className="flex justify-between mb-2"><div><p className="font-bold text-gray-900">{edu.institution}</p><p className="text-sm italic text-gray-700">{edu.degree}</p></div><span className="text-sm text-gray-500">{edu.year}</span></div>))}</div>}
      {resume.experience.length > 0 && <div className="mb-5"><SectionTitle colors={colors} style="border">Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} companyFirst /></div>}
      {resume.skills.length > 0 && <div className="mb-5"><SectionTitle colors={colors} style="border">Skills &amp; Interests</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="inline" /></div>}
      {resume.summary && <div><SectionTitle colors={colors} style="border">Summary</SectionTitle><p className="text-sm text-gray-700 leading-relaxed">{resume.summary}</p></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 6: ELEGANT — Serif with decorative dividers
// ============================================================
function ElegantTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10 font-serif" style={{ color: colors.text }}>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-light tracking-[0.2em] uppercase" style={{ color: colors.primary }}>{resume.name}</h1>
        <div className="flex justify-center items-center gap-4 mt-3">
          <div className="h-px flex-1 max-w-[80px]" style={{ backgroundColor: colors.accent }} />
          <p className="text-sm tracking-wider uppercase" style={{ color: colors.accent }}>{resume.title}</p>
          <div className="h-px flex-1 max-w-[80px]" style={{ backgroundColor: colors.accent }} />
        </div>
        <ContactBar resume={resume} className="justify-center mt-4 text-xs tracking-wider" />
      </div>
      {resume.summary && <div className="mb-8 max-w-xl mx-auto text-center"><p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{resume.summary}&rdquo;</p></div>}
      {resume.experience.length > 0 && <div className="mb-8"><SectionTitle colors={colors} style="center">Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} /></div>}
      <div className="grid grid-cols-2 gap-8">
        {resume.education.length > 0 && <div><SectionTitle colors={colors} style="center">Education</SectionTitle><EducationList education={resume.education} colors={colors} layout="center" /></div>}
        {resume.skills.length > 0 && <div><SectionTitle colors={colors} style="center">Expertise</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="compact" /></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 7: NORDIC — Wide margins, grid dates
// ============================================================
function NordicTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-12" style={{ color: colors.text }}>
      <div className="mb-10">
        <h1 className="text-3xl font-light tracking-wide">{resume.name}</h1>
        <p className="text-lg mt-1" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} className="mt-4" separator="" />
        <div className="mt-6 h-px w-full" style={{ backgroundColor: `${colors.accent}30` }} />
      </div>
      {resume.summary && <div className="mb-10"><p className="text-sm leading-7 max-w-[85%]" style={{ color: `${colors.text}cc` }}>{resume.summary}</p></div>}
      {resume.experience.length > 0 && (
        <div className="mb-10">
          <SectionTitle colors={colors} style="tracked">Experience</SectionTitle>
          {resume.experience.map((exp, i) => (
            <div key={i} className="mb-6 grid grid-cols-[140px_1fr] gap-6">
              <div className="text-sm" style={{ color: colors.accent }}><p>{exp.duration}</p><p className="text-xs mt-0.5">{exp.company}</p></div>
              <div><h3 className="font-medium text-gray-900 mb-2">{exp.role}</h3><ul className="space-y-1.5">{exp.achievements.map((a, j) => <li key={j} className="text-sm text-gray-600 leading-relaxed">{a}</li>)}</ul></div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[140px_1fr] gap-6">
        {resume.education.length > 0 && <><div><SectionTitle colors={colors} style="tracked">Education</SectionTitle></div><div className="space-y-3">{resume.education.map((edu, i) => <div key={i}><p className="font-medium text-gray-900">{edu.degree}</p><p className="text-sm text-gray-500">{edu.institution} — {edu.year}</p></div>)}</div></>}
      </div>
      {resume.skills.length > 0 && <div className="mt-8 grid grid-cols-[140px_1fr] gap-6"><div><SectionTitle colors={colors} style="tracked">Skills</SectionTitle></div><SkillsGrid skills={resume.skills} colors={colors} layout="compact" /></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 8: ATS ULTRA — Maximum ATS compliance
// ============================================================
function ATSUltraTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="mb-6 pb-4 border-b-2" style={{ borderColor: colors.primary }}>
        <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="•" className="mt-3 text-xs" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="border">Summary</SectionTitle><p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p></div>}
      {resume.skills.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Core Competencies</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="inline" /></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Professional Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} /></div>}
      {resume.education.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
      {resume.certifications.length > 0 && <div><SectionTitle colors={colors} style="border">Certifications</SectionTitle><ul>{resume.certifications.map((c, i) => <li key={i} className="text-sm text-gray-700 mb-1">• {c}</li>)}</ul></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 9: FAANG — Big Tech with timeline
// ============================================================
function FAANGTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="mb-6 pb-4 border-b-2" style={{ borderColor: colors.primary }}>
        <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="•" className="mt-3 text-xs" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="border">Summary</SectionTitle><p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="timeline" /></div>}
      {resume.skills.length > 0 && (
        <div className="mb-6">
          <SectionTitle colors={colors} style="border">Skills</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {resume.skills.map((cat, i) => (
              <div key={i} className="p-3 rounded" style={{ backgroundColor: `${colors.primary}08` }}>
                <p className="text-xs font-bold mb-1" style={{ color: colors.primary }}>{cat.category}</p>
                <p className="text-xs text-gray-600">{cat.items.join(' • ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {resume.education.length > 0 && <div><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 10: FEDERAL — Government with clearance section
// ============================================================
function FederalTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="mb-6 pb-4 border-b-2" style={{ borderColor: colors.primary }}>
        <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="•" className="mt-3 text-xs" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="border">Professional Summary</SectionTitle><p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Professional Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} /></div>}
      {resume.skills.length > 0 && (
        <div className="mb-6">
          <SectionTitle colors={colors} style="border">Skills</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {resume.skills.map((cat, i) => (
              <div key={i} className="p-3 rounded" style={{ backgroundColor: `${colors.primary}08` }}>
                <p className="text-xs font-bold mb-1" style={{ color: colors.primary }}>{cat.category}</p>
                <p className="text-xs text-gray-600">{cat.items.join(' • ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {resume.education.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
      {resume.certifications.length > 0 && <div><SectionTitle colors={colors} style="border">Certifications &amp; Clearances</SectionTitle><ul>{resume.certifications.map((c, i) => <li key={i} className="text-sm text-gray-700 mb-1">✓ {c}</li>)}</ul></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 11: MODERN — Rich teal header band (reworked from sidebar)
// ============================================================
function ModernTemplate({ resume, colors }: TemplateProps) {
  return (
    <div style={{ color: colors.text }}>
      <div className="p-8 pb-6" style={{ backgroundColor: colors.primary }}>
        <h1 className="text-3xl font-bold text-white">{resume.name}</h1>
        <p className="text-lg text-white/80 mt-1">{resume.title}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-white/70">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone && <span>{resume.phone}</span>}
          {resume.location && <span>{resume.location}</span>}
        </div>
      </div>
      <div className="p-8 pt-6">
        {resume.summary && <div className="mb-6"><SectionTitle colors={colors}>About Me</SectionTitle><p className="text-gray-700 leading-relaxed">{resume.summary}</p></div>}
        {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors}>Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="timeline" /></div>}
        {resume.skills.length > 0 && <div className="mb-6"><SectionTitle colors={colors}>Skills</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="pills" /></div>}
        {resume.education.length > 0 && <div><SectionTitle colors={colors}>Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 12: CREATIVE — Initials badge, colored chips
// ============================================================
function CreativeTemplate({ resume, colors }: TemplateProps) {
  const initials = resume.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '';
  return (
    <div className="p-8" style={{ color: colors.text }}>
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shrink-0" style={{ backgroundColor: colors.primary }}>{initials}</div>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
          <p className="text-xl text-gray-600">{resume.title}</p>
          <ContactBar resume={resume} className="mt-2" />
        </div>
      </div>
      {resume.summary && <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: `${colors.primary}10` }}><p className="text-gray-700">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors}>Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="boxed" /></div>}
      <div className="grid grid-cols-2 gap-6">
        {resume.education.length > 0 && <div><SectionTitle colors={colors}>Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
        {resume.skills.length > 0 && <div><SectionTitle colors={colors}>Skills</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="pills" /></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 13: CASCADE — Timeline dots, single column
// ============================================================
function CascadeTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4" style={{ backgroundColor: colors.primary }}>
          {resume.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{resume.title}</p>
        <ContactBar resume={resume} separator="•" className="mt-3" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="border">Profile</SectionTitle><p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p></div>}
      {resume.experience.length > 0 && (
        <div className="mb-6">
          <SectionTitle colors={colors} style="border">Work Experience</SectionTitle>
          {resume.experience.map((exp, i) => (
            <div key={i} className="mb-5 relative pl-5">
              <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: colors.accent }} />
              {i < resume.experience.length - 1 && <div className="absolute left-[3px] top-4 bottom-0 w-px bg-gray-200" />}
              <div className="flex justify-between items-baseline"><h3 className="font-bold text-gray-900">{exp.role}</h3><span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{exp.duration}</span></div>
              <p className="text-sm mb-1.5" style={{ color: colors.accent }}>{exp.company}</p>
              <ul className="space-y-1">{exp.achievements.map((a, j) => <li key={j} className="text-sm text-gray-600">• {a}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
      {resume.skills.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Skills</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} /></div>}
      {resume.education.length > 0 && <div><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 14: COLUMNIST — Skills pills at top
// ============================================================
function ColumnistTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="mb-6 pb-4 border-b-2" style={{ borderColor: colors.primary }}>
        <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="•" className="mt-3 text-xs" />
      </div>
      {resume.skills.length > 0 && (
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: `${colors.primary}06` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.primary }}>Key Competencies</p>
          <SkillsGrid skills={resume.skills} colors={colors} layout="pills" />
        </div>
      )}
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="border">Profile</SectionTitle><p className="text-sm text-gray-600 leading-relaxed">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Experience</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="timeline" /></div>}
      {resume.education.length > 0 && <div><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 15: METRO — Bold section headers with color blocks
// ============================================================
function MetroTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-8" style={{ color: colors.text }}>
      <div className="mb-8 p-6 rounded-2xl" style={{ backgroundColor: colors.primary }}>
        <h1 className="text-3xl font-bold text-white">{resume.name}</h1>
        <p className="text-lg text-white/80 mt-1">{resume.title}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-white/60">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone && <span>{resume.phone}</span>}
          {resume.location && <span>{resume.location}</span>}
        </div>
      </div>
      {resume.summary && <div className="mb-6"><div className="flex items-center gap-3 mb-3"><div className="w-1 h-6 rounded-full" style={{ backgroundColor: colors.accent }} /><h2 className="text-lg font-bold" style={{ color: colors.primary }}>Summary</h2></div><p className="text-sm text-gray-600 leading-relaxed pl-4">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><div className="flex items-center gap-3 mb-3"><div className="w-1 h-6 rounded-full" style={{ backgroundColor: colors.accent }} /><h2 className="text-lg font-bold" style={{ color: colors.primary }}>Experience</h2></div><div className="pl-4"><ExperienceList experience={resume.experience} colors={colors} /></div></div>}
      {resume.skills.length > 0 && <div className="mb-6"><div className="flex items-center gap-3 mb-3"><div className="w-1 h-6 rounded-full" style={{ backgroundColor: colors.accent }} /><h2 className="text-lg font-bold" style={{ color: colors.primary }}>Skills</h2></div><div className="pl-4"><SkillsGrid skills={resume.skills} colors={colors} layout="pills" /></div></div>}
      {resume.education.length > 0 && <div><div className="flex items-center gap-3 mb-3"><div className="w-1 h-6 rounded-full" style={{ backgroundColor: colors.accent }} /><h2 className="text-lg font-bold" style={{ color: colors.primary }}>Education</h2></div><div className="pl-4"><EducationList education={resume.education} colors={colors} /></div></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 16: CONSULTANT — Impact metrics first
// ============================================================
function ConsultantTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10" style={{ color: colors.text }}>
      <div className="border-b-4 pb-5 mb-6" style={{ borderColor: colors.primary }}>
        <h1 className="text-3xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-lg mt-1" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="|" className="mt-3" />
      </div>
      {resume.summary && <div className="mb-6 p-4 border-l-4 bg-gray-50 rounded-r" style={{ borderColor: colors.accent }}><p className="text-sm text-gray-700 leading-relaxed italic">{resume.summary}</p></div>}
      {resume.skills.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Areas of Expertise</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="inline" /></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Professional Impact</SectionTitle><ExperienceList experience={resume.experience} colors={colors} /></div>}
      <div className="grid grid-cols-2 gap-6">
        {resume.education.length > 0 && <div><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
        {resume.certifications.length > 0 && <div><SectionTitle colors={colors} style="border">Credentials</SectionTitle><ul>{resume.certifications.map((c, i) => <li key={i} className="text-sm text-gray-700 mb-1">• {c}</li>)}</ul></div>}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATE 17: STARTUP — Bold, energetic, orange accents
// ============================================================
function StartupTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-8" style={{ color: colors.text }}>
      <div className="mb-6">
        <h1 className="text-4xl font-black" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-lg font-medium mt-1" style={{ color: colors.accent }}>{resume.title}</p>
        <ContactBar resume={resume} separator="/" className="mt-2" />
        <div className="mt-4 h-1 w-20 rounded-full" style={{ backgroundColor: colors.accent }} />
      </div>
      {resume.summary && <div className="mb-6"><p className="text-gray-700 leading-relaxed font-medium">{resume.summary}</p></div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">What I&apos;ve Built</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="timeline" /></div>}
      {resume.skills.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Stack</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="pills" /></div>}
      {resume.education.length > 0 && <div><SectionTitle colors={colors} style="border">Education</SectionTitle><EducationList education={resume.education} colors={colors} /></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE 18: ACADEMIC — Research-focused with publications
// ============================================================
function AcademicTemplate({ resume, colors }: TemplateProps) {
  return (
    <div className="p-10 font-serif" style={{ color: colors.text }}>
      <div className="text-center border-b-2 pb-5 mb-6" style={{ borderColor: colors.primary }}>
        <h1 className="text-3xl font-bold" style={{ color: colors.primary }}>{resume.name}</h1>
        <p className="text-lg mt-1 text-gray-600">{resume.title}</p>
        <ContactBar resume={resume} separator="|" className="justify-center mt-3 text-xs" />
      </div>
      {resume.summary && <div className="mb-6"><SectionTitle colors={colors} style="border">Research Statement</SectionTitle><p className="text-sm text-gray-700 leading-relaxed">{resume.summary}</p></div>}
      {resume.education.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Education</SectionTitle>{resume.education.map((edu, i) => (<div key={i} className="flex justify-between mb-3"><div><p className="font-bold text-gray-900">{edu.institution}</p><p className="text-sm italic text-gray-700">{edu.degree}</p>{edu.details && <p className="text-xs text-gray-500 mt-0.5">{edu.details}</p>}</div><span className="text-sm text-gray-500">{edu.year}</span></div>))}</div>}
      {resume.experience.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Academic Positions</SectionTitle><ExperienceList experience={resume.experience} colors={colors} style="timeline" /></div>}
      {resume.skills.length > 0 && <div className="mb-6"><SectionTitle colors={colors} style="border">Research Areas &amp; Methods</SectionTitle><SkillsGrid skills={resume.skills} colors={colors} layout="inline" /></div>}
      {resume.certifications.length > 0 && <div><SectionTitle colors={colors} style="border">Publications &amp; Grants</SectionTitle><ul>{resume.certifications.map((c, i) => <li key={i} className="text-sm text-gray-700 mb-2">{c}</li>)}</ul></div>}
    </div>
  );
}

// ============================================================
// TEMPLATE MAP & ROUTER
// ============================================================
const TEMPLATE_MAP: Record<string, React.FC<TemplateProps>> = {
  'executive': ExecutiveTemplate,
  'minimal': MinimalTemplate,
  'compact': CompactTemplate,
  'technical': TechnicalTemplate,
  'harvard': HarvardTemplate,
  'elegant': ElegantTemplate,
  'nordic': NordicTemplate,
  'ats-optimized': ATSUltraTemplate,
  'faang': FAANGTemplate,
  'federal': FederalTemplate,
  'modern': ModernTemplate,
  'creative': CreativeTemplate,
  'cascade': CascadeTemplate,
  'double-column': ColumnistTemplate,
  'infographic': MetroTemplate,
  'deloitte': ConsultantTemplate,
  'startup': StartupTemplate,
  'academic': AcademicTemplate,
};

export function ResumeTemplate({ resume, templateId, colors }: {
  resume: CanonicalResume;
  templateId: string;
  colors: { primary: string; accent: string; text: string };
}) {
  const Component = TEMPLATE_MAP[templateId] || ExecutiveTemplate;
  return (
    <div
      className="resume-page bg-white"
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        position: 'relative',
      }}
    >
      <Component resume={resume} colors={colors} />
    </div>
  );
}

export default ResumeTemplate;
