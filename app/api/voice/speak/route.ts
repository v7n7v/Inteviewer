import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const { text, voiceId } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
        }

        // Default to configured voice if none provided
        // Priority: Provided Voice ID > Configured ID (Male/Female/Default) > Hardcoded Fallback
        const targetVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream?optimize_streaming_latency=4`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_turbo_v2_5', // Fastest model for conversation
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.7,
                        style: 0.5,
                        use_speaker_boost: true
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ElevenLabs API Error:', errorText);
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        // Return the audio stream directly
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
            },
        });

    } catch (error: any) {
        console.error('Synthesis error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
