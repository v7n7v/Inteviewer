import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { checkVoiceAllowed, recordVoiceUsage, estimateTTSSeconds } from '@/lib/usage-tracker';
import { validateBody } from '@/lib/validate';
import { VoiceSpeakSchema } from '@/lib/schemas';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// ── Voice resolution ──
// On the international DashScope endpoint, only 'longanyang' is confirmed working.
// TODO: Test more voices on intl endpoint and expand this mapping per persona.
const CONFIRMED_VOICE = 'longanyang';

function resolveVoice(_voiceHint?: string): string {
    return CONFIRMED_VOICE;
}

/**
 * Synthesize speech via DashScope CosyVoice WebSocket API.
 * Returns raw MP3 audio bytes.
 */
function synthesizeViaDashScope(text: string, voice: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.DASHSCOPE_API_KEY;
        if (!apiKey) return reject(new Error('DASHSCOPE_API_KEY not configured'));

        const model = process.env.DASHSCOPE_TTS_MODEL || 'cosyvoice-v3-flash';
        const wsUrl = process.env.DASHSCOPE_WS_URL || 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference';

        const taskId = randomUUID().replace(/-/g, '');
        const audioChunks: Buffer[] = [];
        let resolved = false;

        const ws = new WebSocket(wsUrl, {
            headers: { Authorization: `bearer ${apiKey}` },
        });

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                ws.close();
                reject(new Error('DashScope TTS timeout (30s)'));
            }
        }, 30_000);

        ws.on('open', () => {
            // Send the run-task command
            const startMessage = {
                header: {
                    action: 'run-task',
                    task_id: taskId,
                    streaming: 'out',
                },
                payload: {
                    model,
                    task_group: 'audio',
                    task: 'tts',
                    function: 'SpeechSynthesizer',
                    input: { text },
                    parameters: {
                        voice,
                        format: 'mp3',
                        sample_rate: 22050,
                        rate: 1.0,
                        volume: 80,
                    },
                },
            };
            ws.send(JSON.stringify(startMessage));
        });

        ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
            if (isBinary) {
                // Binary frame = audio data
                audioChunks.push(Buffer.from(data as ArrayBuffer));
            } else {
                // Text frame = JSON event
                try {
                    const msg = JSON.parse(data.toString());
                    const event = msg?.header?.event;

                    if (event === 'task-failed') {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(`DashScope TTS failed: ${msg?.header?.error_message || 'unknown'}`));
                        }
                    } else if (event === 'task-finished') {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            ws.close();
                            resolve(Buffer.concat(audioChunks));
                        }
                    }
                    // 'task-started' and 'result-generated' are intermediate — ignore
                } catch {
                    // non-JSON text, ignore
                }
            }
        });

        ws.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(new Error(`DashScope WebSocket error: ${err.message}`));
            }
        });

        ws.on('close', () => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                if (audioChunks.length > 0) {
                    resolve(Buffer.concat(audioChunks));
                } else {
                    reject(new Error('DashScope WebSocket closed without audio'));
                }
            }
        });
    });
}

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

        // ── Synthesize via DashScope CosyVoice ──
        const voice = resolveVoice(voiceId);
        const audioBuffer = await synthesizeViaDashScope(text, voice);

        // ── Record usage AFTER successful synthesis ──
        await recordVoiceUsage(guard.user.uid, estimatedSeconds);

        const remainingAfter = voiceCheck.remainingSeconds - estimatedSeconds;

        return new NextResponse(new Uint8Array(audioBuffer), {
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
