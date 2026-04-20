import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from './blog/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://talentconsulting.io';

  // Stable dates — update these when pages actually change
  const lastRelease = new Date('2026-04-20');

  // Public marketing pages
  const publicPages = [
    { url: baseUrl, priority: 1.0, changeFrequency: 'weekly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/templates`, priority: 0.9, changeFrequency: 'weekly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/tools/ai-detector`, priority: 0.9, changeFrequency: 'weekly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/tools/resume-builder`, priority: 0.9, changeFrequency: 'weekly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/tools/ai-humanizer`, priority: 0.9, changeFrequency: 'weekly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/tools/interview-prep`, priority: 0.9, changeFrequency: 'weekly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/blog`, priority: 0.8, changeFrequency: 'daily' as const, lastModified: lastRelease },
    { url: `${baseUrl}/for-teams`, priority: 0.7, changeFrequency: 'monthly' as const, lastModified: lastRelease },
    { url: `${baseUrl}/help`, priority: 0.6, changeFrequency: 'monthly' as const, lastModified: lastRelease },
  ];

  // Blog articles
  const blogPages = BLOG_POSTS.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
    lastModified: lastRelease,
  }));

  return [...publicPages, ...blogPages];
}

