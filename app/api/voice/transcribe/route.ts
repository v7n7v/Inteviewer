import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;

        if (!file) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
        }

        // Direct fetch to Deepgram to avoid needing server-side SDK
        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': file.type || 'audio/webm',
            },
            body: file,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Deepgram API Error:', errorText);
            throw new Error(`Deepgram API error: ${response.status}`);
        }

        const data = await response.json();
        const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || '';

        return NextResponse.json({ text: transcript });
    } catch (error: any) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
