import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { checkVoiceAllowed, recordVoiceUsage, estimateSTTSeconds } from '@/lib/usage-tracker';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const formData = await req.formData();
        const file = formData.get('file') as Blob;

        if (!file) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // Enforce file size limit: 10MB max
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'Audio file too large. Max 10MB.' }, { status: 400 });
        }

        // ── Voice minute cap check ──
        const voiceCheck = await checkVoiceAllowed(guard.user.uid, guard.user.tier);
        if (!voiceCheck.allowed) {
            const isFreeTier = guard.user.tier === 'free';
            return NextResponse.json(
                {
                    error: isFreeTier
                        ? 'Voice mode is a Pro feature. Upgrade to access voice transcription.'
                        : `Monthly voice limit reached (${Math.floor(voiceCheck.capSeconds / 60)} min). Resets next month.`,
                    upgrade: isFreeTier,
                    remainingSeconds: voiceCheck.remainingSeconds,
                },
                { status: 403 }
            );
        }

        // Estimate audio duration from file size
        const estimatedSeconds = estimateSTTSeconds(file.size);

        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
        }

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

        // Use actual duration from Deepgram if available, else use estimate
        const actualDuration = data.metadata?.duration
            ? Math.ceil(data.metadata.duration)
            : estimatedSeconds;

        // ── Record usage AFTER successful transcription ──
        await recordVoiceUsage(guard.user.uid, actualDuration);

        return NextResponse.json({
            text: transcript,
            voiceUsage: {
                usedSeconds: voiceCheck.usedSeconds + actualDuration,
                remainingSeconds: Math.max(0, voiceCheck.remainingSeconds - actualDuration),
                capMinutes: Math.floor(voiceCheck.capSeconds / 60),
            },
        });
    } catch (error: unknown) {
        console.error('[api/voice/transcribe] Error:', error);
        monitor.critical('Tool: voice/transcribe', String(error));
        return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }
}
