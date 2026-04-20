'use client';

/**
 * ATS-Safe PDF Templates using @react-pdf/renderer
 * Generates text-layer PDFs that ATS bots can parse (no raster images)
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

// ============================================================
// FONT REGISTRATION — physical files for ATS compatibility
// ============================================================
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.otf', fontWeight: 'normal' },
    { src: '/fonts/Inter-Bold.otf', fontWeight: 'bold' },
    { src: '/fonts/Inter-Italic.otf', fontStyle: 'italic' },
  ],
});

// ============================================================
// TYPES (matching existing data structures)
// ============================================================
interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  summary: string;
  experience: { company: string; role: string; duration: string; achievements: string[] }[];
  education: { degree: string; institution: string; year: string; details?: string }[];
  skills: { category: string; items: string[] }[];
  certifications?: string[];
}

interface TemplateColors {
  primary: string;
  accent: string;
  text: string;
}

// ============================================================
// STYLES
// ============================================================
const createResumeStyles = (colors: TemplateColors) =>
  StyleSheet.create({
    page: {
      fontFamily: 'Inter',
      fontSize: 10,
      color: colors.text,
      padding: '40 50',
      lineHeight: 1.5,
    },
    header: {
      marginBottom: 16,
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
      paddingBottom: 12,
    },
    name: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 2,
    },
    title: {
      fontSize: 12,
      color: colors.accent,
      marginBottom: 6,
    },
    contactRow: {
      flexDirection: 'row',
      gap: 12,
      fontSize: 9,
      color: '#555555',
    },
    contactItem: {
      fontSize: 9,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 14,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 1,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
      paddingBottom: 3,
    },
    summary: {
      fontSize: 10,
      lineHeight: 1.6,
      marginBottom: 4,
      color: '#333333',
    },
    expEntry: {
      marginBottom: 10,
    },
    expHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    expRole: {
      fontSize: 11,
      fontWeight: 'bold',
      color: colors.text,
    },
    expDuration: {
      fontSize: 9,
      color: '#666666',
      fontStyle: 'italic',
    },
    expCompany: {
      fontSize: 10,
      color: colors.accent,
      marginBottom: 3,
    },
    bullet: {
      fontSize: 9.5,
      marginLeft: 12,
      marginBottom: 2,
      lineHeight: 1.5,
      color: '#333333',
    },
    eduEntry: {
      marginBottom: 6,
    },
    eduDegree: {
      fontSize: 10,
      fontWeight: 'bold',
    },
    eduInstitution: {
      fontSize: 9,
      color: '#555555',
    },
    skillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 4,
    },
    skillCategory: {
      fontSize: 9.5,
      fontWeight: 'bold',
      color: colors.primary,
      marginRight: 6,
    },
    skillItems: {
      fontSize: 9.5,
      color: '#444444',
    },
    certItem: {
      fontSize: 9.5,
      marginBottom: 2,
      color: '#333333',
    },
  });

// ============================================================
// RESUME PDF DOCUMENT
// ============================================================
export function ResumePDFDocument({
  resume,
  colors = { primary: '#1a365d', accent: '#2b6cb0', text: '#1a202c' },
}: {
  resume: ResumeData;
  colors?: TemplateColors;
}) {
  const styles = createResumeStyles(colors);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.name}</Text>
          <Text style={styles.title}>{resume.title}</Text>
          <View style={styles.contactRow}>
            {resume.email && <Text style={styles.contactItem}>{resume.email}</Text>}
            {resume.phone && <Text style={styles.contactItem}>|  {resume.phone}</Text>}
            {resume.location && <Text style={styles.contactItem}>|  {resume.location}</Text>}
            {resume.linkedin && <Text style={styles.contactItem}>|  {resume.linkedin}</Text>}
            {resume.website && <Text style={styles.contactItem}>|  {resume.website}</Text>}
          </View>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience?.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            {resume.experience.map((exp, i) => (
              <View key={i} style={styles.expEntry}>
                <View style={styles.expHeader}>
                  <Text style={styles.expRole}>{exp.role}</Text>
                  <Text style={styles.expDuration}>{exp.duration}</Text>
                </View>
                <Text style={styles.expCompany}>{exp.company}</Text>
                {exp.achievements?.map((achievement, j) => (
                  <Text key={j} style={styles.bullet}>•  {achievement}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education?.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.eduEntry}>
                <Text style={styles.eduDegree}>
                  {edu.degree}  —  {edu.institution}
                </Text>
                <Text style={styles.eduInstitution}>{edu.year}{edu.details ? ` | ${edu.details}` : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {resume.skills?.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            {resume.skills.map((cat, i) => (
              <View key={i} style={styles.skillsRow}>
                <Text style={styles.skillCategory}>{cat.category}:</Text>
                <Text style={styles.skillItems}>{cat.items.join(',  ')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {resume.certifications.map((cert, i) => (
              <Text key={i} style={styles.certItem}>•  {cert}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

// ============================================================
// JD PDF DOCUMENT
// ============================================================
const jdStyles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1a202c',
    padding: '40 50',
    lineHeight: 1.6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 6,
  },
  mission: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
    marginBottom: 14,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 9.5,
    marginLeft: 12,
    marginBottom: 3,
    lineHeight: 1.5,
    color: '#334155',
  },
  subheading: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
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
  // If we have structured JD data, render it beautifully
  if (jd) {
    return (
      <Document>
        <Page size="A4" style={jdStyles.page}>
          <Text style={jdStyles.title}>{jd.roleTitle}</Text>
          <Text style={jdStyles.mission}>{jd.missionStatement}</Text>

          <Text style={jdStyles.sectionTitle}>About the Role</Text>
          <Text style={jdStyles.body}>{jd.overview}</Text>

          {jd.first90Days?.length > 0 && (
            <View>
              <Text style={jdStyles.sectionTitle}>First 90 Days</Text>
              {jd.first90Days.map((m, i) => (
                <Text key={i} style={jdStyles.bullet}>•  {m.day}: {m.milestone}</Text>
              ))}
            </View>
          )}

          {jd.coreRequirements?.length > 0 && (
            <View>
              <Text style={jdStyles.sectionTitle}>What You'll Bring</Text>
              {jd.coreRequirements.map((r, i) => (
                <Text key={i} style={jdStyles.bullet}>•  {r}</Text>
              ))}
            </View>
          )}

          {jd.niceToHave?.length > 0 && (
            <View>
              <Text style={jdStyles.sectionTitle}>Nice to Have</Text>
              {jd.niceToHave.map((r, i) => (
                <Text key={i} style={jdStyles.bullet}>•  {r}</Text>
              ))}
            </View>
          )}

          {jd.culturePulse?.length > 0 && (
            <View>
              <Text style={jdStyles.sectionTitle}>Our Culture</Text>
              {jd.culturePulse.map((c, i) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text style={jdStyles.subheading}>{c.trait}</Text>
                  <Text style={jdStyles.body}>{c.description}</Text>
                </View>
              ))}
            </View>
          )}

          {jd.talentDensity && (
            <View>
              <Text style={jdStyles.sectionTitle}>What Exceptional Looks Like</Text>
              <Text style={jdStyles.body}>{jd.talentDensity}</Text>
            </View>
          )}

          {jd.growthPath?.length > 0 && (
            <View>
              <Text style={jdStyles.sectionTitle}>Growth Path</Text>
              {jd.growthPath.map((g, i) => (
                <Text key={i} style={jdStyles.bullet}>•  {g}</Text>
              ))}
            </View>
          )}

          {jd.compensation && (
            <View>
              <Text style={jdStyles.sectionTitle}>Compensation</Text>
              <Text style={jdStyles.body}>{jd.compensation}</Text>
            </View>
          )}

          {jd.benefits && jd.benefits.length > 0 && (
            <View>
              <Text style={jdStyles.sectionTitle}>Benefits</Text>
              {jd.benefits.map((b, i) => (
                <Text key={i} style={jdStyles.bullet}>•  {b}</Text>
              ))}
            </View>
          )}
        </Page>
      </Document>
    );
  }

  // Fallback: render editable plain text
  return (
    <Document>
      <Page size="A4" style={jdStyles.page}>
        <Text style={jdStyles.body}>{editableText || ''}</Text>
      </Page>
    </Document>
  );
}

// ============================================================
// ATS TEXT NORMALIZATION (inspired by career-ops)
// Converts Unicode characters that ATS bots can't parse
// ============================================================
function atsNormalize(text: string): string {
  if (!text) return '';
  return text
    // Em/en dashes → hyphen
    .replace(/[\u2013\u2014\u2015]/g, '-')
    // Smart quotes → straight quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Ellipsis → three dots
    .replace(/\u2026/g, '...')
    // Bullet → hyphen
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
    // Non-breaking space → regular space
    .replace(/\u00A0/g, ' ')
    // Thin/hair spaces → regular space
    .replace(/[\u2009\u200A\u200B\u202F\u205F]/g, ' ')
    // Trademark/registered/copyright → text
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u00A9/g, '(c)')
    // Fancy arrows → plain
    .replace(/[\u2192\u2794\u27A4]/g, '->')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function atsNormalizeResume(resume: ResumeData): ResumeData {
  return {
    ...resume,
    name: atsNormalize(resume.name),
    title: atsNormalize(resume.title),
    email: resume.email, // don't normalize emails
    phone: resume.phone,
    location: atsNormalize(resume.location),
    linkedin: resume.linkedin,
    website: resume.website,
    summary: atsNormalize(resume.summary),
    experience: (resume.experience || []).map(exp => ({
      ...exp,
      company: atsNormalize(exp.company),
      role: atsNormalize(exp.role),
      duration: atsNormalize(exp.duration),
      achievements: (exp.achievements || []).map(a => atsNormalize(a)),
    })),
    education: (resume.education || []).map(edu => ({
      ...edu,
      degree: atsNormalize(edu.degree),
      institution: atsNormalize(edu.institution),
      year: edu.year,
      details: edu.details ? atsNormalize(edu.details) : undefined,
    })),
    skills: (resume.skills || []).map(cat => ({
      ...cat,
      category: atsNormalize(cat.category),
      items: cat.items.map(i => atsNormalize(i)),
    })),
    certifications: (resume.certifications || []).map(c => atsNormalize(c)),
  };
}

// ============================================================
// DOWNLOAD HELPERS
// ============================================================
export async function downloadResumePDF(
  resume: ResumeData,
  colors?: TemplateColors,
  filename?: string
) {
  // ATS normalization pass — convert Unicode that ATS bots can't parse
  const normalized = atsNormalizeResume(resume);
  const doc = <ResumePDFDocument resume={normalized} colors={colors} />;
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

