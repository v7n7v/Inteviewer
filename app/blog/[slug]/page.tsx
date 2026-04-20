import type { Metadata } from 'next';
import { BLOG_POSTS } from '../posts';
import ArticlePage from './ArticlePage';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) return { title: 'Article Not Found' };

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://talentconsulting.io/blog/${post.slug}`,
      type: 'article',
      publishedTime: '2026-04-15T00:00:00Z',
    },
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  return <ArticlePage slug={slug} />;
}
