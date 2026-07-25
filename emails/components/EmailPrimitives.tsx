import type { ReactNode } from 'react';
import { Hr, Section, Text } from 'react-email';
import { emailTokens } from '../tokens';

export function EmailParagraph({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={muted ? styles.mutedParagraph : styles.paragraph}>{children}</Text>;
}

export function EmailCallout({
  title,
  children,
  tone = 'info',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const palette = calloutPalettes[tone];
  return (
    <Section style={{ ...styles.callout, backgroundColor: palette.background, borderColor: palette.border }}>
      {title ? <Text style={{ ...styles.calloutTitle, color: palette.foreground }}>{title}</Text> : null}
      <Text style={{ ...styles.calloutText, color: palette.foreground }}>{children}</Text>
    </Section>
  );
}

export interface EmailDetail {
  label: string;
  value: string;
}

export function EmailDetails({ rows }: { rows: readonly EmailDetail[] }) {
  if (rows.length === 0) return null;

  return (
    <Section style={styles.details}>
      {rows.map((row, index) => (
        <Section key={`${row.label}-${index}`} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text style={styles.detailValue}>{row.value}</Text>
        </Section>
      ))}
    </Section>
  );
}

export function EmailList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <Section style={styles.list}>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.listItem}>
          <span style={styles.bullet}>•</span> {item}
        </Text>
      ))}
    </Section>
  );
}

export function EmailDivider() {
  return <Hr style={styles.divider} />;
}

const calloutPalettes = {
  info: { background: emailTokens.color.infoSoft, border: '#BFDBFE', foreground: emailTokens.color.info },
  success: { background: emailTokens.color.successSoft, border: '#A7F3D0', foreground: emailTokens.color.success },
  warning: { background: emailTokens.color.warningSoft, border: '#FDE68A', foreground: emailTokens.color.warning },
  danger: { background: emailTokens.color.dangerSoft, border: '#FECACA', foreground: emailTokens.color.danger },
  neutral: { background: '#F9FAFB', border: emailTokens.color.border, foreground: emailTokens.color.text },
} as const;

const styles = {
  paragraph: {
    color: emailTokens.color.text,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  mutedParagraph: {
    color: emailTokens.color.muted,
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0 0 12px',
  },
  callout: {
    border: '1px solid',
    borderRadius: '10px',
    margin: '20px 0',
    padding: '14px 16px',
  },
  calloutTitle: {
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: '19px',
    margin: '0 0 4px',
  },
  calloutText: {
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0',
  },
  details: {
    backgroundColor: '#F9FAFB',
    border: `1px solid ${emailTokens.color.border}`,
    borderRadius: '10px',
    margin: '20px 0',
    padding: '4px 16px',
  },
  detailRow: {
    borderBottom: `1px solid ${emailTokens.color.border}`,
    padding: '10px 0',
  },
  detailLabel: {
    color: emailTokens.color.muted,
    display: 'inline-block',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '0',
    verticalAlign: 'top',
    width: '38%',
  },
  detailValue: {
    color: emailTokens.color.ink,
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '18px',
    margin: '0',
    textAlign: 'right' as const,
    verticalAlign: 'top',
    width: '62%',
  },
  list: { margin: '4px 0 20px' },
  listItem: {
    color: emailTokens.color.text,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 7px',
  },
  bullet: { color: emailTokens.color.brand, fontWeight: '700' as const },
  divider: { borderColor: emailTokens.color.border, margin: '24px 0' },
};
