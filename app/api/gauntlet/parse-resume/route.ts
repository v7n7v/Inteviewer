import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        // Check if we received JSON (from our updated client) or formData (old fallback)
        let fileName = '';
        let fileBuffer: Buffer | null = null;
        let textContent = '';

        const contentType = req.headers.get('content-type') || '';

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

        if (contentType.includes('application/json')) {
            const body = await req.json();
            if (!body.fileData || !body.fileName) {
                return NextResponse.json({ error: 'No file data provided' }, { status: 400 });
            }
            fileName = body.fileName.toLowerCase();
            fileBuffer = Buffer.from(body.fileData, 'base64');
            if (fileBuffer.length > MAX_FILE_SIZE) {
                return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
            }
            if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
                textContent = fileBuffer.toString('utf-8');
            }
        } else {
            // Fallback for formData (if any)
            const formData = await req.formData();
            const file = formData.get('file') as File;
            if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
            fileName = file.name.toLowerCase();
            if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
                textContent = await file.text();
            } else {
                const arrayBuffer = await file.arrayBuffer();
                fileBuffer = Buffer.from(arrayBuffer);
            }
        }

        // Handle plain text files
        if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            return NextResponse.json({ text: textContent, fileName });
        }

        // Handle DOCX/DOC files using mammoth
        if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            if (!fileBuffer) return NextResponse.json({ error: 'Invalid file buffer' }, { status: 400 });
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            const cleanText = result.value.trim();
            return NextResponse.json({ text: cleanText.substring(0, 10000), fileName });
        }

        return NextResponse.json(
            { error: 'Unsupported file type. Please upload a Word (.docx) or TXT file.' },
            { status: 400 }
        );

    } catch (error: unknown) {
        console.error('[api/gauntlet/parse-resume] Error:', error);
        return NextResponse.json(
            { error: 'Failed to parse resume' },
            { status: 500 }
        );
    }
}
