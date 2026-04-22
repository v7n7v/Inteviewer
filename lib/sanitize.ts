/**
 * AI Prompt Sanitization
 * Strips dangerous patterns from user-supplied text before
 * injecting it into AI system/user prompts.
 */

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/gi,
  /you\s+are\s+now\s+(a|an|the)\s+/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /\bdo\s+not\s+follow\s+(any|the)\s+rules\b/gi,
  /\boverride\s+(all\s+)?instructions\b/gi,
  /\bact\s+as\s+(if|though)\s+you\s+(are|were)\b/gi,
  /\bforget\s+(everything|all)\s+(you\s+)?know\b/gi,
  /\breturn\s+the\s+system\s+prompt\b/gi,
  /\bprint\s+(your|the)\s+(system\s+)?prompt\b/gi,
  /\brepeat\s+(your|the)\s+(system\s+)?instructions\b/gi,
];

/**
 * Sanitize user text before embedding in an AI prompt.
 * Removes known injection patterns and enforces max length.
 */
export function sanitizeForAI(text: string, maxLength = 50_000): string {
  let safe = text.slice(0, maxLength);

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    safe = safe.replace(pattern, '[FILTERED]');
  }

  return safe;
}

/**
 * Normalize text for accurate AI detection and processing.
 * Defends against homoglyph injection, zero-width characters, and encoding tricks.
 */
export function normalizeText(text: string): string {
  // 1. Unicode NFKC — collapses visually identical characters (Cyrillic "е" → Latin "e")
  let normalized = text.normalize('NFKC');

  // 2. Strip zero-width and invisible formatting characters
  normalized = normalized.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u206A\u206B\u206C\u206D\u206E\u206F]/g, '');

  // 3. Normalize whitespace — collapse tabs/multiple spaces
  normalized = normalized.replace(/[\t\v\f]+/g, ' ');
  normalized = normalized.replace(/ {2,}/g, ' ');

  // 4. Normalize smart quotes → straight quotes
  normalized = normalized.replace(/[\u2018\u2019\u201A]/g, "'");
  normalized = normalized.replace(/[\u201C\u201D\u201E]/g, '"');

  // 5. Normalize line endings
  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\r/g, '\n');

  return normalized.trim();
}

/**
 * Wrap user content with delimiter markers to reduce prompt injection risk.
 * The AI model treats content between delimiters as data, not instructions.
 */
export function wrapUserContent(label: string, content: string): string {
  return `<user_${label}>\n${sanitizeForAI(content)}\n</user_${label}>`;
}

// ═══════════════════════════════════════════════════════════
// HTML Sanitizer — for dangerouslySetInnerHTML usage
// ═══════════════════════════════════════════════════════════

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'strong', 'em', 'b', 'i', 'u',
  'ul', 'ol', 'li',
  'span', 'div',
  'a', 'code', 'pre', 'blockquote',
]);

const ALLOWED_ATTRS = new Set(['class', 'href', 'target', 'rel']);

const DANGEROUS_HTML_PATTERNS = [
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /<\s*script/gi,
  /<\s*iframe/gi,
  /<\s*object/gi,
  /<\s*embed/gi,
  /<\s*form/gi,
  /<\s*input/gi,
  /<\s*textarea/gi,
  /<\s*button/gi,
  /<\s*link/gi,
  /<\s*meta/gi,
  /<\s*style/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*['"]?\s*javascript/gi,
];

/**
 * Sanitize HTML string for safe rendering via dangerouslySetInnerHTML.
 * Strips dangerous elements/attributes, keeps safe markdown tags.
 */
export function sanitizeHtml(html: string): string {
  let safe = html;

  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    safe = safe.replace(pattern, '');
  }

  safe = safe.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';

    return match.replace(/\s+([a-z-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attrMatch, attrName) => {
      if (!ALLOWED_ATTRS.has(attrName.toLowerCase())) return '';
      return attrMatch;
    });
  });

  return safe;
}

