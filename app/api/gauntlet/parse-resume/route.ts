import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();

        // Handle plain text files
        if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            const text = await file.text();
            return NextResponse.json({ text, fileName: file.name });
        }

        // Handle PDF files — use pdf-parse (works in Node.js without workers)
        if (fileName.endsWith('.pdf')) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Dynamic import to avoid SSR issues
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(buffer);

            return NextResponse.json({ text: pdfData.text.trim(), fileName: file.name });
        }

        // Handle DOCX/DOC files using mammoth
        if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            const mammoth = await import('mammoth');
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await mammoth.extractRawText({ buffer });
            const cleanText = result.value.trim();
            return NextResponse.json({ text: cleanText.substring(0, 10000), fileName: file.name });
        }

        return NextResponse.json(
            { error: 'Unsupported file type. Please upload a PDF, Word (.docx) or TXT file.' },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('Resume parsing error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to parse resume' },
            { status: 500 }
        );
    }
}
