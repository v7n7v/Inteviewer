import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { checkVoiceAllowed, recordVoiceUsage, estimateTTSSeconds } from '@/lib/usage-tracker';
import { validateBody } from '@/lib/validate';
import { VoiceSpeakSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const validated = await validateBody(req, VoiceSpeakSchema);
        if (!validated.success) return validated.error;
        const { text, voiceId } = validated.data;

        // ── Voice minute cap check ──
        const voiceCheck = await checkVoiceAllowed(guard.user.uid, guard.user.tier);
        if (!voiceCheck.allowed) {
            const isFreeTier = guard.user.tier === 'free';
            return NextResponse.json(
                {
                    error: isFreeTier
                        ? 'Voice mode is a Pro feature. Upgrade to access AI interview voice.'
                        : `Monthly voice limit reached (${Math.floor(voiceCheck.capSeconds / 60)} min). Resets next month.`,
                    upgrade: isFreeTier,
                    usedMinutes: Math.floor(voiceCheck.usedSeconds / 60),
                    capMinutes: Math.floor(voiceCheck.capSeconds / 60),
                    remainingSeconds: voiceCheck.remainingSeconds,
                },
                { status: 403 }
            );
        }

        // Estimate how many seconds this TTS will use
        const estimatedSeconds = estimateTTSSeconds(text);

        // Check if this request would exceed the cap
        if (voiceCheck.remainingSeconds < estimatedSeconds) {
            const remainingMin = Math.floor(voiceCheck.remainingSeconds / 60);
            const remainingSec = voiceCheck.remainingSeconds % 60;
            return NextResponse.json(
                {
                    error: `Only ${remainingMin}m ${remainingSec}s of voice remaining this month. This text needs ~${estimatedSeconds}s. Try a shorter text or wait until next month.`,
                    remainingSeconds: voiceCheck.remainingSeconds,
                    estimatedSeconds,
                },
                { status: 403 }
            );
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
        }

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
                    model_id: 'eleven_turbo_v2_5',
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

        // ── Record usage AFTER successful synthesis ──
        await recordVoiceUsage(guard.user.uid, estimatedSeconds);

        const remainingAfter = voiceCheck.remainingSeconds - estimatedSeconds;

        return new NextResponse(response.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'X-Voice-Used-Seconds': String(voiceCheck.usedSeconds + estimatedSeconds),
                'X-Voice-Remaining-Seconds': String(Math.max(0, remainingAfter)),
                'X-Voice-Cap-Minutes': String(Math.floor(voiceCheck.capSeconds / 60)),
            },
        });

    } catch (error: unknown) {
        console.error('[api/voice/speak] Error:', error);
        return NextResponse.json({ error: 'Voice synthesis failed' }, { status: 500 });
    }
}
