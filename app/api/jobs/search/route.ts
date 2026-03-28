import { NextRequest, NextResponse } from 'next/server';
import { searchJobs, searchJobsRemotive, type JobSearchParams } from '@/lib/job-search-api';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { JobSearchSchema } from '@/lib/schemas';

export async function GET(request: NextRequest) {
    try {
        const guard = await guardApiRoute(request, { rateLimit: 10, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);

        const query = searchParams.get('query') || 'software engineer';
        const location = searchParams.get('location') || '';
        const page = parseInt(searchParams.get('page') || '1');

        const params: JobSearchParams = {
            query,
            location,
            page,
            numPages: 1,
            remote: searchParams.get('remote') === 'true'
        };

        const result = await searchJobs(params);

        return NextResponse.json({
            success: true,
            jobs: result.jobs,
            totalCount: result.totalCount,
            source: result.source,
            query,
            location
        });
    } catch (error) {
        console.error('Job search error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to search jobs', jobs: [] },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const guard = await guardApiRoute(request, { rateLimit: 10, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const validated = await validateBody(request, JobSearchSchema);
        if (!validated.success) return validated.error;

        const params: JobSearchParams = {
            query: validated.data.query || 'software engineer',
            location: validated.data.location,
            page: validated.data.page || 1,
            numPages: validated.data.numPages || 1,
            remote: validated.data.remote,
        };

        const result = await searchJobs(params);

        return NextResponse.json({
            success: true,
            jobs: result.jobs,
            totalCount: result.totalCount,
            source: result.source
        });
    } catch (error) {
        console.error('Job search error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to search jobs', jobs: [] },
            { status: 500 }
        );
    }
}
