'use client';

/**
 * ATS-Safe PDF Templates using @react-pdf/renderer
 * Template-aware: generates PDFs that match each preview layout.
 * All templates are single-column for maximum ATS compatibility.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import type { CanonicalResume } from '@/lib/resume-normalizer';
import { normalizeResume } from '@/lib/resume-normalizer';

// ============================================================
// FONT REGISTRATION — physical files for ATS compatibility
// ============================================================
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Inter-Italic.ttf', fontStyle: 'italic' },
  ],
});

// ============================================================
// TYPES
// ============================================================
interface TemplateColors {
  primary: string;
  accent: string;
  text: string;
}

interface PDFTemplateProps {
  resume: CanonicalResume;
  colors: TemplateColors;
}

// ============================================================
// ATS TEXT NORMALIZATION
// Converts Unicode characters that ATS bots can't parse
// ============================================================
function atsNormalize(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2009\u200A\u200B\u202F\u205F]/g, ' ')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u00A9/g, '(c)')
    .replace(/[\u2192\u2794\u27A4]/g, '->')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function atsNormalizeResume(resume: CanonicalResume): CanonicalResume {
  return {
    ...resume,
    name: atsNormalize(resume.name),
    title: atsNormalize(resume.title),
    email: resume.email,
    phone: resume.phone,
    location: atsNormalize(resume.location),
    linkedin: resume.linkedin,
    website: resume.website,
    summary: atsNormalize(resume.summary),
    experience: resume.experience.map(exp => ({
      ...exp,
      company: atsNormalize(exp.company),
      role: atsNormalize(exp.role),
      duration: atsNormalize(exp.duration),
      achievements: exp.achievements.map(a => atsNormalize(a)),
    })),
    education: resume.education.map(edu => ({
      ...edu,
      degree: atsNormalize(edu.degree),
      institution: atsNormalize(edu.institution),
      year: edu.year,
      details: edu.details ? atsNormalize(edu.details) : undefined,
    })),
    skills: resume.skills.map(cat => ({
      ...cat,
      category: atsNormalize(cat.category),
      items: cat.items.map(i => atsNormalize(i)),
    })),
    certifications: resume.certifications.map(c => atsNormalize(c)),
  };
}

// ============================================================
// SHARED PDF SECTION COMPONENTS
// ============================================================
function PDFSectionTitle({ children, color, borderColor, align, font }: {
  children: string; color: string; borderColor?: string; align?: 'center' | 'left'; font?: string;
}) {
  return (
    <Text style={{
      fontSize: 12, fontWeight: 'bold', color, textTransform: 'uppercase', letterSpacing: 1,
      marginTop: 14, marginBottom: 6,
      borderBottomWidth: borderColor ? 1 : 0, borderBottomColor: borderColor || '#e0e0e0',
      paddingBottom: 3, textAlign: align || 'left',
      fontFamily: font || 'Inter',
    }}>{children}</Text>
  );
}

function PDFContactRow({ resume, separator = '|' }: { resume: CanonicalResume; separator?: string }) {
  const items = [resume.email, resume.phone, resume.location, resume.linkedin, resume.website].filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', gap: 8, fontSize: 9, color: '#555555', flexWrap: 'wrap' }}>
      {items.map((item, i) => (
        <Text key={i}>{i > 0 ? `${separator}  ` : ''}{item}</Text>
      ))}
    </View>
  );
}

function PDFExperience({ entries, colors, companyFirst }: { entries: CanonicalResume['experience']; colors: TemplateColors; companyFirst?: boolean }) {
  return (
    <View>{entries.map((exp, i) => (
      <View key={i} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          {companyFirst ? (
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.text }}>{exp.company}</Text>
              <Text style={{ fontSize: 10, color: '#555555' }}>,  </Text>
              <Text style={{ fontSize: 10, fontStyle: 'italic', color: '#555555' }}>{exp.role}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.text }}>{exp.role}</Text>
          )}
          <Text style={{ fontSize: 9, color: '#666666', fontStyle: 'italic' }}>{exp.duration}</Text>
        </View>
        {!companyFirst && <Text style={{ fontSize: 10, color: colors.accent, marginBottom: 3 }}>{exp.company}</Text>}
        {exp.achievements.map((a, j) => (
          <Text key={j} style={{ fontSize: 9.5, marginLeft: 12, marginBottom: 2, lineHeight: 1.5, color: '#333333' }}>•  {a}</Text>
        ))}
      </View>
    ))}</View>
  );
}

function PDFEducation({ entries, colors, companyFirst }: { entries: CanonicalResume['education']; colors: TemplateColors; companyFirst?: boolean }) {
  return (
    <View>{entries.map((edu, i) => (
      <View key={i} style={{ marginBottom: 6 }}>
        {companyFirst ? (
          <>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{edu.institution}</Text>
            <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#555555' }}>{edu.degree}</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{edu.degree}  —  {edu.institution}</Text>
          </>
        )}
        <Text style={{ fontSize: 9, color: '#555555' }}>{edu.year}{edu.details ? ` | ${edu.details}` : ''}</Text>
      </View>
    ))}</View>
  );
}

function PDFSkills({ skills, colors, layout = 'category' }: { skills: CanonicalResume['skills']; colors: TemplateColors; layout?: 'category' | 'inline' }) {
  if (layout === 'inline') {
    return (
      <View>{skills.map((cat, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: colors.primary, marginRight: 6 }}>{cat.category}:</Text>
          <Text style={{ fontSize: 9.5, color: '#444444', flex: 1 }}>{cat.items.join(', ')}</Text>
        </View>
      ))}</View>
    );
  }

  return (
    <View>{skills.map((cat, i) => (
      <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: colors.primary, marginRight: 6 }}>{cat.category}:</Text>
        <Text style={{ fontSize: 9.5, color: '#444444' }}>{cat.items.join(',  ')}</Text>
      </View>
    ))}</View>
  );
}

function PDFCertifications({ certs, colors }: { certs: string[]; colors: TemplateColors }) {
  if (!certs.length) return null;
  return (
    <View>
      {certs.map((cert, i) => (
        <Text key={i} style={{ fontSize: 9.5, marginBottom: 2, color: '#333333' }}>•  {cert}</Text>
      ))}
    </View>
  );
}

// ============================================================
// TEMPLATE-SPECIFIC PDF LAYOUTS
// ============================================================

// Executive: Professional serif, border-bottom header
function ExecutivePDF({ resume, colors }: PDFTemplateProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Inter', fontSize: 10, color: colors.text, padding: '40 50', lineHeight: 1.5 }}>
      <View style={{ marginBottom: 16, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.primary, marginBottom: 2 }}>{resume.name}</Text>
        <Text style={{ fontSize: 12, color: colors.accent, marginBottom: 6 }}>{resume.title}</Text>
        <PDFContactRow resume={resume} />
      </View>
      {resume.summary && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Professional Summary</PDFSectionTitle><Text style={{ fontSize: 10, lineHeight: 1.6, color: '#333333' }}>{resume.summary}</Text></View>}
      {resume.experience.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Experience</PDFSectionTitle><PDFExperience entries={resume.experience} colors={colors} /></View>}
      {resume.education.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Education</PDFSectionTitle><PDFEducation entries={resume.education} colors={colors} /></View>}
      {resume.skills.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Skills</PDFSectionTitle><PDFSkills skills={resume.skills} colors={colors} /></View>}
      <PDFCertifications certs={resume.certifications} colors={colors} />
    </Page>
  );
}

// Minimal: Light, centered header
function MinimalPDF({ resume, colors }: PDFTemplateProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Inter', fontSize: 10, color: colors.text, padding: '40 50', lineHeight: 1.5 }}>
      <View style={{ marginBottom: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 2 }}>{resume.name}</Text>
        <Text style={{ fontSize: 11, color: '#666666', marginBottom: 6 }}>{resume.title}</Text>
        <PDFContactRow resume={resume} separator="•" />
      </View>
      {resume.summary && <View style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 10 }}><Text style={{ fontSize: 10, lineHeight: 1.6, color: '#555555', textAlign: 'center' }}>{resume.summary}</Text></View>}
      {resume.experience.length > 0 && <View><PDFSectionTitle color="#999999">Experience</PDFSectionTitle><PDFExperience entries={resume.experience} colors={colors} /></View>}
      {resume.education.length > 0 && <View><PDFSectionTitle color="#999999">Education</PDFSectionTitle><PDFEducation entries={resume.education} colors={colors} /></View>}
      {resume.skills.length > 0 && <View><PDFSectionTitle color="#999999">Skills</PDFSectionTitle><PDFSkills skills={resume.skills} colors={colors} layout="inline" /></View>}
    </Page>
  );
}

// Compact: Dense, small type
function CompactPDF({ resume, colors }: PDFTemplateProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Inter', fontSize: 9, color: colors.text, padding: '30 40', lineHeight: 1.4 }}>
      <View style={{ marginBottom: 10, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View><Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.primary }}>{resume.name}</Text><Text style={{ fontSize: 10, color: '#666666' }}>{resume.title}</Text></View>
        <View style={{ alignItems: 'flex-end', fontSize: 8, color: '#666666' }}>{resume.email && <Text>{resume.email}</Text>}{resume.phone && <Text>{resume.phone}</Text>}{resume.location && <Text>{resume.location}</Text>}</View>
      </View>
      {resume.summary && <View style={{ marginBottom: 8, backgroundColor: `${colors.primary}08`, padding: 8, borderRadius: 4 }}><Text style={{ fontSize: 9, color: '#444444', lineHeight: 1.5 }}>{resume.summary}</Text></View>}
      {resume.skills.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Core Competencies</PDFSectionTitle><PDFSkills skills={resume.skills} colors={colors} layout="inline" /></View>}
      {resume.experience.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Professional Experience</PDFSectionTitle><PDFExperience entries={resume.experience} colors={colors} /></View>}
      {resume.education.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Education</PDFSectionTitle><PDFEducation entries={resume.education} colors={colors} /></View>}
      <PDFCertifications certs={resume.certifications} colors={colors} />
    </Page>
  );
}

// Technical: Monospace style
function TechnicalPDF({ resume, colors }: PDFTemplateProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Inter', fontSize: 10, color: colors.text, padding: '40 50', lineHeight: 1.5 }}>
      <View style={{ marginBottom: 16, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>{resume.name}</Text>
        <Text style={{ fontSize: 12, color: colors.accent, marginBottom: 6 }}>{resume.title}</Text>
        <PDFContactRow resume={resume} separator="|" />
      </View>
      {resume.summary && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Summary</PDFSectionTitle><Text style={{ fontSize: 10, lineHeight: 1.6, color: '#333333' }}>{resume.summary}</Text></View>}
      {resume.skills.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Technical Skills</PDFSectionTitle><PDFSkills skills={resume.skills} colors={colors} /></View>}
      {resume.experience.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Experience</PDFSectionTitle><PDFExperience entries={resume.experience} colors={colors} /></View>}
      {resume.education.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Education</PDFSectionTitle><PDFEducation entries={resume.education} colors={colors} /></View>}
    </Page>
  );
}

// Harvard: Education-first, centered header
function HarvardPDF({ resume, colors }: PDFTemplateProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Inter', fontSize: 10, color: colors.text, padding: '40 50', lineHeight: 1.5 }}>
      <View style={{ marginBottom: 16, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.primary, marginBottom: 4 }}>{resume.name}</Text>
        <PDFContactRow resume={resume} separator="|" />
      </View>
      {resume.education.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Education</PDFSectionTitle><PDFEducation entries={resume.education} colors={colors} companyFirst /></View>}
      {resume.experience.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Experience</PDFSectionTitle><PDFExperience entries={resume.experience} colors={colors} companyFirst /></View>}
      {resume.skills.length > 0 && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Skills and Interests</PDFSectionTitle><PDFSkills skills={resume.skills} colors={colors} layout="inline" /></View>}
      {resume.summary && <View><PDFSectionTitle color={colors.primary} borderColor={`${colors.primary}40`}>Summary</PDFSectionTitle><Text style={{ fontSize: 10, color: '#555555', lineHeight: 1.6 }}>{resume.summary}</Text></View>}
    </Page>
  );
}

// Generic single-column PDF for: Elegant, Nordic, Modern, Creative, Cascade, Columnist, Metro, Consultant, Startup, ATS Ultra, FAANG, Federal, Academic
function GenericSingleColumnPDF({ resume, colors, sectionOrder }: PDFTemplateProps & { sectionOrder?: string[] }) {
  const order = sectionOrder || ['summary', 'experience', 'skills', 'education', 'certifications'];
  const sections: Record<string, JSX.Element | null> = {
    summary: resume.summary ? <View key="summary"><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Professional Summary</PDFSectionTitle><Text style={{ fontSize: 10, lineHeight: 1.6, color: '#333333' }}>{resume.summary}</Text></View> : null,
    experience: resume.experience.length > 0 ? <View key="experience"><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Experience</PDFSectionTitle><PDFExperience entries={resume.experience} colors={colors} /></View> : null,
    skills: resume.skills.length > 0 ? <View key="skills"><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Skills</PDFSectionTitle><PDFSkills skills={resume.skills} colors={colors} /></View> : null,
    education: resume.education.length > 0 ? <View key="education"><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Education</PDFSectionTitle><PDFEducation entries={resume.education} colors={colors} /></View> : null,
    certifications: resume.certifications.length > 0 ? <View key="certifications"><PDFSectionTitle color={colors.primary} borderColor="#e0e0e0">Certifications</PDFSectionTitle><PDFCertifications certs={resume.certifications} colors={colors} /></View> : null,
  };
  return (
    <Page size="A4" style={{ fontFamily: 'Inter', fontSize: 10, color: colors.text, padding: '40 50', lineHeight: 1.5 }}>
      <View style={{ marginBottom: 16, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.primary, marginBottom: 2 }}>{resume.name}</Text>
        <Text style={{ fontSize: 12, color: colors.accent, marginBottom: 6 }}>{resume.title}</Text>
        <PDFContactRow resume={resume} />
      </View>
      {order.map(s => sections[s]).filter(Boolean)}
    </Page>
  );
}

// ============================================================
// TEMPLATE MAP → PDF LAYOUT
// ============================================================
const PDF_TEMPLATE_MAP: Record<string, React.FC<PDFTemplateProps>> = {
  'executive': ExecutivePDF,
  'minimal': MinimalPDF,
  'compact': CompactPDF,
  'technical': TechnicalPDF,
  'harvard': HarvardPDF,
  // These use the generic single-column with different section orders:
  'elegant': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'education', 'skills']} />,
  'nordic': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'education', 'skills']} />,
  'modern': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'skills', 'education']} />,
  'creative': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'education', 'skills']} />,
  'cascade': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'skills', 'education']} />,
  'double-column': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['skills', 'summary', 'experience', 'education']} />,
  'infographic': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'skills', 'education']} />,
  'deloitte': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'skills', 'experience', 'education', 'certifications']} />,
  'ats-optimized': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'skills', 'experience', 'education', 'certifications']} />,
  'faang': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'skills', 'education']} />,
  'startup': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'skills', 'education']} />,
  'federal': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'experience', 'skills', 'education', 'certifications']} />,
  'academic': (p) => <GenericSingleColumnPDF {...p} sectionOrder={['summary', 'education', 'experience', 'skills', 'certifications']} />,
};

// ============================================================
// MAIN PDF DOCUMENT — template-aware
// ============================================================
export function ResumePDFDocument({
  resume,
  templateId = 'executive',
  colors = { primary: '#1a365d', accent: '#2b6cb0', text: '#1a202c' },
}: {
  resume: CanonicalResume;
  templateId?: string;
  colors?: TemplateColors;
}) {
  const TemplateComponent = PDF_TEMPLATE_MAP[templateId] || ExecutivePDF;
  return (
    <Document>
      <TemplateComponent resume={resume} colors={colors} />
    </Document>
  );
}

// ============================================================
// JD PDF DOCUMENT (unchanged)
// ============================================================
const jdStyles = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 10, color: '#1a202c', padding: '40 50', lineHeight: 1.6 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0369a1', marginBottom: 6 },
  mission: { fontSize: 11, fontStyle: 'italic', color: '#475569', marginBottom: 14, lineHeight: 1.5 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 3 },
  body: { fontSize: 10, lineHeight: 1.6, color: '#334155', marginBottom: 4 },
  bullet: { fontSize: 9.5, marginLeft: 12, marginBottom: 3, lineHeight: 1.5, color: '#334155' },
  subheading: { fontSize: 10, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
});

interface GeneratedJD {
  roleTitle: string;
  missionStatement: string;
  overview: string;
  first90Days: { day: string; milestone: string }[];
  coreRequirements: string[];
  niceToHave: string[];
  culturePulse: { trait: string; description: string }[];
  talentDensity: string;
  growthPath: string[];
  compensation?: string;
  benefits?: string[];
}

export function JDPDFDocument({ jd, editableText }: { jd?: GeneratedJD; editableText?: string }) {
  if (jd) {
    return (
      <Document>
        <Page size="A4" style={jdStyles.page}>
          <Text style={jdStyles.title}>{jd.roleTitle}</Text>
          <Text style={jdStyles.mission}>{jd.missionStatement}</Text>
          <Text style={jdStyles.sectionTitle}>About the Role</Text>
          <Text style={jdStyles.body}>{jd.overview}</Text>
          {jd.first90Days?.length > 0 && <View><Text style={jdStyles.sectionTitle}>First 90 Days</Text>{jd.first90Days.map((m, i) => <Text key={i} style={jdStyles.bullet}>•  {m.day}: {m.milestone}</Text>)}</View>}
          {jd.coreRequirements?.length > 0 && <View><Text style={jdStyles.sectionTitle}>What You'll Bring</Text>{jd.coreRequirements.map((r, i) => <Text key={i} style={jdStyles.bullet}>•  {r}</Text>)}</View>}
          {jd.niceToHave?.length > 0 && <View><Text style={jdStyles.sectionTitle}>Nice to Have</Text>{jd.niceToHave.map((r, i) => <Text key={i} style={jdStyles.bullet}>•  {r}</Text>)}</View>}
          {jd.culturePulse?.length > 0 && <View><Text style={jdStyles.sectionTitle}>Our Culture</Text>{jd.culturePulse.map((c, i) => <View key={i} style={{ marginBottom: 4 }}><Text style={jdStyles.subheading}>{c.trait}</Text><Text style={jdStyles.body}>{c.description}</Text></View>)}</View>}
          {jd.talentDensity && <View><Text style={jdStyles.sectionTitle}>What Exceptional Looks Like</Text><Text style={jdStyles.body}>{jd.talentDensity}</Text></View>}
          {jd.growthPath?.length > 0 && <View><Text style={jdStyles.sectionTitle}>Growth Path</Text>{jd.growthPath.map((g, i) => <Text key={i} style={jdStyles.bullet}>•  {g}</Text>)}</View>}
          {jd.compensation && <View><Text style={jdStyles.sectionTitle}>Compensation</Text><Text style={jdStyles.body}>{jd.compensation}</Text></View>}
          {jd.benefits && jd.benefits.length > 0 && <View><Text style={jdStyles.sectionTitle}>Benefits</Text>{jd.benefits.map((b, i) => <Text key={i} style={jdStyles.bullet}>•  {b}</Text>)}</View>}
        </Page>
      </Document>
    );
  }
  return <Document><Page size="A4" style={jdStyles.page}><Text style={jdStyles.body}>{editableText || ''}</Text></Page></Document>;
}

// ============================================================
// DOWNLOAD HELPERS — now template-aware
// ============================================================
export async function downloadResumePDF(
  resume: any,
  colors?: TemplateColors,
  filename?: string,
  templateId?: string
) {
  // Normalize + ATS-clean
  const normalized = atsNormalizeResume(normalizeResume(resume));
  const doc = <ResumePDFDocument resume={normalized} templateId={templateId || 'executive'} colors={colors} />;
  const blob = await pdf(doc).toBlob();
  saveAs(blob, `${filename || normalized.name?.replace(/\s+/g, '_') || 'resume'}.pdf`);
}

export async function downloadJDPDF(
  jd: GeneratedJD | undefined,
  editableText: string | undefined,
  filename?: string
) {
  const doc = <JDPDFDocument jd={jd} editableText={editableText} />;
  const blob = await pdf(doc).toBlob();
  saveAs(blob, `${filename || jd?.roleTitle?.replace(/\s+/g, '_') || 'job-description'}.pdf`);
}
