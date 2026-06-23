import type { CSSProperties } from 'react';

export const TALENT_CONSULTING_WORDMARK = '/brand/talent-consulting-logo-wordmark.png';
export const TALENT_CONSULTING_MARK = '/brand/talent-consulting-mark-512.png';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
  style?: CSSProperties;
}

export function TalentConsultingWordmark({
  className = '',
  imgClassName = '',
  alt = 'Talent Consulting',
  style,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center ${className}`} style={style}>
      <img
        src={TALENT_CONSULTING_WORDMARK}
        alt={alt}
        className={`block max-w-full object-contain ${imgClassName}`}
      />
    </span>
  );
}

export function TalentConsultingMark({
  className = '',
  imgClassName = '',
  alt = 'Talent Consulting',
  style,
}: BrandLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ${className}`}
      style={style}
    >
      <img
        src={TALENT_CONSULTING_MARK}
        alt={alt}
        className={`block h-full w-full object-contain ${imgClassName}`}
      />
    </span>
  );
}

