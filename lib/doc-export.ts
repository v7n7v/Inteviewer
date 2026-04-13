/**
 * Document Export Utility
 * Generates downloadable .docx and .txt files from finalized text.
 */

import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  HeadingLevel,
  AlignmentType,
} from 'docx';

export type ExportFormat = 'docx' | 'txt';

interface ExportOptions {
  title?: string;
  author?: string;
  format: ExportFormat;
}

/** Generate a Word document from text */
async function generateDocx(text: string, options: ExportOptions): Promise<Blob> {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const docParagraphs: Paragraph[] = [];

  // Title
  if (options.title) {
    docParagraphs.push(
      new Paragraph({
        text: options.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  // Body paragraphs
  for (const para of paragraphs) {
    const lines = para.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || /^\d+[.)]\s/.test(trimmed)) {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.replace(/^[-•]\s/, '').replace(/^\d+[.)]\s/, ''),
                size: 24,
                font: 'Calibri',
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: 24,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 200, line: 360 },
          })
        );
      }
    }
  }

  // Footer
  docParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated with Inkwell Writing Suite • ${new Date().toLocaleDateString()}`,
          size: 18,
          color: '999999',
          italics: true,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 800 },
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    creator: options.author || 'Inkwell Writing Suite',
    title: options.title || 'Humanized Document',
    sections: [{ children: docParagraphs }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);
  return new Blob([uint8], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Generate a plain .txt file */
function generateTxt(text: string, options: ExportOptions): Blob {
  let content = '';
  if (options.title) {
    content += `${options.title}\n${'='.repeat(options.title.length)}\n\n`;
  }
  content += text;
  content += `\n\n---\nGenerated with Inkwell Writing Suite • ${new Date().toLocaleDateString()}\n`;

  return new Blob([content], { type: 'text/plain' });
}

/** Main export function — returns a downloadable Blob */
export async function exportDocument(
  text: string,
  options: ExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const safeTitle = (options.title || 'document')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 50);

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${safeTitle}_${timestamp}.${options.format}`;

  let blob: Blob;
  switch (options.format) {
    case 'docx':
      blob = await generateDocx(text, options);
      break;
    case 'txt':
      blob = generateTxt(text, options);
      break;
    default:
      blob = generateTxt(text, options);
  }

  return { blob, filename };
}

/** Trigger browser download */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
