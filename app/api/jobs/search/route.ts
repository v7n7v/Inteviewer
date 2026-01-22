import { NextRequest, NextResponse } from 'next/server';
import { searchJobs, searchJobsRemotive, type JobSearchParams } from '@/lib/job-search-api';

export async function GET(request: NextRequest) {
    try {
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

        // Search for jobs
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
        const body = await request.json();

        const params: JobSearchParams = {
            query: body.query || 'software engineer',
            location: body.location,
            page: body.page || 1,
            numPages: body.numPages || 1,
            remote: body.remote
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
