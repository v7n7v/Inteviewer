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
 * Wrap user content with delimiter markers to reduce prompt injection risk.
 * The AI model treats content between delimiters as data, not instructions.
 */
export function wrapUserContent(label: string, content: string): string {
  return `<user_${label}>\n${sanitizeForAI(content)}\n</user_${label}>`;
}
