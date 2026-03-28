import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateBody } from '@/lib/validate';
import { TeamInterestSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        // IP-based rate limit for public form (no auth required)
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown';

        const { allowed, resetIn } = checkRateLimit(`teams-interest:${ip}`, 3, 60_000);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many submissions. Please try again later.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) },
                }
            );
        }

        const validated = await validateBody(req, TeamInterestSchema);
        if (!validated.success) return validated.error;
        const { name, email, organization, orgType, teamSize, message } = validated.data;

        // Save to Firestore
        await getAdminDb().collection('team_interest').add({
            name,
            email,
            organization,
            orgType,
            teamSize: teamSize || 'not specified',
            message: message || '',
            created_at: new Date().toISOString(),
            status: 'new',
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[api/teams/interest] Error:', error);
        return NextResponse.json(
            { error: 'Failed to submit. Please try again.' },
            { status: 500 }
        );
    }
}
