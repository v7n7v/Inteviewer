import { notFound } from 'next/navigation';
import TemplateLabClient from '@/components/resume-templates/curated/TemplateLabClient';

export default async function ResumeTemplateLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const read = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  return (
    <TemplateLabClient
      initialTemplateId={read(params.template)}
      initialFixtureId={read(params.fixture)}
      initialDark={read(params.theme) === 'dark'}
    />
  );
}
