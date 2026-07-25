import type { CSSProperties } from 'react';

export const TALENT_CONSULTING_WORDMARK = '/brand/talentconsulting-logo-white.png';
export const TALENT_CONSULTING_WORDMARK_TRANSPARENT = '/brand/talentconsulting-logo.png';
export const TALENT_CONSULTING_WORDMARK_DARK_SURFACE = '/brand/talentconsulting-logo-dark-surface.png';
export const TALENT_CONSULTING_MARK = '/brand/talentconsulting-mark-512.png';
export const TACO_MARK = '/taco-icon-512.png';
export const TALENT_CONSULTING_BRAND_NAME = 'TalentConsulting.io';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
  style?: CSSProperties;
  transparent?: boolean;
  darkSurface?: boolean;
}

export function TalentConsultingWordmark({
  className = '',
  imgClassName = '',
  alt = TALENT_CONSULTING_BRAND_NAME,
  style,
  transparent = false,
  darkSurface = false,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center ${className}`} style={style}>
      <img
        src={darkSurface ? TALENT_CONSULTING_WORDMARK_DARK_SURFACE : transparent ? TALENT_CONSULTING_WORDMARK_TRANSPARENT : TALENT_CONSULTING_WORDMARK}
        alt={alt}
        width={1196}
        height={148}
        decoding="async"
        className={`block h-auto w-full max-w-full object-contain ${imgClassName}`}
      />
    </span>
  );
}

export function TalentConsultingMark({
  className = '',
  imgClassName = '',
  alt = TALENT_CONSULTING_BRAND_NAME,
  style,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`} style={style}>
      <img
        src={TALENT_CONSULTING_MARK}
        alt={alt}
        width={512}
        height={512}
        decoding="async"
        className={`block h-full w-full object-cover ${imgClassName}`}
      />
    </span>
  );
}

export function TacoMark({
  className = '',
  imgClassName = '',
  alt = 'Taco AI assistant',
  style,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`} style={style}>
      <img
        src={TACO_MARK}
        alt={alt}
        width={512}
        height={512}
        decoding="async"
        className={`block h-full w-full object-contain ${imgClassName}`}
      />
    </span>
  );
}
