'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TalentConsultingWordmark } from '@/components/BrandLogo';
import { CuratedTemplateMiniature } from '@/components/resume-templates/curated';
import { useTheme } from '@/components/ThemeProvider';
import SeoTrackedLink from '@/components/seo/SeoTrackedLink';
import {
  NEW_SIGNATURE_TEMPLATE_IDS,
  getSelectableTemplates,
  type ResumeTemplateMetadata,
} from '@/lib/resume-templates';

const TEMPLATES = getSelectableTemplates();

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'technical', label: 'Technical' },
  { id: 'professional', label: 'Specialist' },
  { id: 'career', label: 'Career paths' },
  { id: 'creative', label: 'Creative' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const CATEGORY_GROUPS: Record<Exclude<CategoryId, 'all'>, string[]> = {
  leadership: ['executive', 'strategy', 'product', 'nonprofit', 'sales'],
  technical: ['technical', 'data'],
  professional: ['finance', 'legal', 'healthcare', 'academic', 'public-sector'],
  career: ['transition', 'early-career'],
  creative: ['creative', 'design', 'editorial'],
};

function matchesCategory(template: ResumeTemplateMetadata, category: CategoryId) {
  return category === 'all' || CATEGORY_GROUPS[category].includes(template.category);
}

function TemplatePreview({ template }: { template: ResumeTemplateMetadata }) {
  if (template.thumbnail) {
    return (
      <img
        src={template.thumbnail}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover object-top"
      />
    );
  }

  if (NEW_SIGNATURE_TEMPLATE_IDS.includes(template.id as (typeof NEW_SIGNATURE_TEMPLATE_IDS)[number])) {
    return <CuratedTemplateMiniature template={template} />;
  }

  return null;
}

function TemplateCard({
  template,
  isLight,
}: {
  template: ResumeTemplateMetadata;
  isLight: boolean;
}) {
  const href = `/suite/resume?template=${encodeURIComponent(template.slug)}`;
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className={`group overflow-hidden rounded-[22px] border transition-all hover:-translate-y-1 hover:shadow-2xl ${
        isLight
          ? 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
          : 'border-white/[0.08] bg-white/[0.035] hover:border-white/[0.16]'
      }`}
    >
      <div className={`relative aspect-[2/3] overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#111216]'}`}>
        <TemplatePreview template={template} />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <span className="rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur">
            {template.atsClassification}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur ${
            template.tier === 'pro'
              ? 'border-emerald-400/30 bg-emerald-950/85 text-emerald-200'
              : 'border-cyan-400/30 bg-cyan-950/85 text-cyan-100'
          }`}>
            {template.tier === 'pro' ? 'STANDARD' : 'FREE'}
          </span>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-center opacity-100 transition-opacity md:inset-0 md:bg-slate-950/70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <SeoTrackedLink
            href={href}
            eventName="seo_template_click"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-xl outline-none transition hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-emerald-300/60"
          >
            {template.tier === 'pro' ? 'Preview in Studio' : 'Use this template'} →
          </SeoTrackedLink>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
              {template.category.replace(/-/g, ' ')}
            </p>
            <h2 className={`mt-1 text-lg font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              {template.name}
            </h2>
          </div>
          <span className="material-symbols-rounded text-[20px]" style={{ color: template.colors.primary }}>
            {template.icon}
          </span>
        </div>
        <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-white/55'}`}>
          {template.description}
        </p>
        <p className={`mt-3 text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
          Built for {template.audience.join(' and ')}.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {template.filterTags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                isLight
                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/45'
              }`}
            >
              {tag.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

export default function TemplatesGallery() {
  const [filter, setFilter] = useState<CategoryId>('all');
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const filtered = TEMPLATES.filter(template => matchesCategory(template, filter));

  return (
    <main className={`min-h-dvh ${isLight ? 'bg-slate-50' : 'bg-[#090a0c]'}`}>
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
        isLight ? 'border-slate-200 bg-white/85' : 'border-white/[0.06] bg-[#090a0c]/85'
      }`}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link href="/" aria-label="TalentConsulting.io home" className="inline-flex min-w-0 items-center">
            <TalentConsultingWordmark className="w-[min(210px,48vw)]" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/#pricing-section" className={`text-xs transition ${isLight ? 'text-slate-500 hover:text-slate-950' : 'text-white/45 hover:text-white'}`}>
              Pricing
            </Link>
            <SeoTrackedLink
              href="/suite/resume"
              eventName="seo_template_click"
              className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:from-emerald-300 hover:to-teal-300"
            >
              Open Studio
            </SeoTrackedLink>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-5 pb-10 pt-16 text-center sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">TalentConsulting Signature Collection</p>
        <h1 className={`mt-4 text-4xl font-bold tracking-tight sm:text-5xl ${isLight ? 'text-slate-950' : 'text-white'}`}>
          20 resume formats for different professional signals
        </h1>
        <p className={`mx-auto mt-5 max-w-2xl text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-white/55'}`}>
          Three foundational templates are free and 17 new curated designs are available with Standard.
          Every design keeps real text, includes a linear Word companion, and states its ATS posture honestly.
        </p>
        <p className={`mx-auto mt-3 max-w-2xl text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-white/35'}`}>
          ATS behavior varies by employer and software; no template can guarantee compatibility with every system.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter resume templates">
          {CATEGORIES.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setFilter(category.id)}
              aria-pressed={filter === category.id}
              className={`rounded-full border px-4 py-2 text-xs font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-emerald-400/30 ${
                filter === category.id
                  ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
                  : isLight
                    ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    : 'border-white/[0.08] bg-white/[0.04] text-white/45 hover:border-white/[0.16] hover:text-white/70'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-6" aria-live="polite">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
            {filtered.length} {filtered.length === 1 ? 'template' : 'templates'}
          </p>
          <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-white/30'}`}>PDF + linear DOCX companion</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(template => (
            <TemplateCard key={template.id} template={template} isLight={isLight} />
          ))}
        </div>
      </section>

      <section className={`border-t py-16 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-white/[0.02]'}`}>
        <h2 className={`text-2xl font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>Ready to shape the right first impression?</h2>
        <p className={`mx-auto mt-3 max-w-lg text-sm ${isLight ? 'text-slate-600' : 'text-white/45'}`}>
          Bring your real experience. The Studio preserves your content while you compare structure, hierarchy, and export behavior.
        </p>
        <SeoTrackedLink
          href="/suite/resume"
          eventName="seo_template_click"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-teal-400"
        >
          Build your resume →
        </SeoTrackedLink>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 px-5 text-left md:grid-cols-3">
          {[
            { href: '/resume-examples/project-manager', title: 'Project Manager Example', desc: 'Use metrics, scope, and delivery language.' },
            { href: '/resume-keywords/marketing', title: 'Marketing Keywords', desc: 'Match acquisition, lifecycle, and analytics terms.' },
            { href: '/tools/ats-analyzer', title: 'ATS Analyzer', desc: 'Check keyword fit before applying.' },
          ].map(guide => (
            <Link
              key={guide.href}
              href={guide.href}
              className={`rounded-xl border p-4 transition ${
                isLight
                  ? 'border-slate-200 bg-slate-50 hover:bg-white'
                  : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-950' : 'text-white/75'}`}>{guide.title}</h3>
              <p className={`mt-2 text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-white/40'}`}>{guide.desc}</p>
            </Link>
          ))}
        </div>

        <div className={`mx-auto mt-14 max-w-2xl space-y-4 px-5 text-left ${isLight ? 'text-slate-600' : 'text-white/45'}`}>
          <h3 className={`mb-4 text-center text-lg font-bold ${isLight ? 'text-slate-950' : 'text-white/75'}`}>
            Frequently Asked Questions
          </h3>
          {[
            {
              q: 'Which resume templates are free?',
              a: 'Editorial Authority, Technical Signal, and Brutalist Voltage are free. The 17 new curated signature designs require Standard.',
            },
            {
              q: 'Are the templates guaranteed to work with every ATS?',
              a: 'No template can guarantee compatibility with every employer or system. Each design is labeled ATS-first, ATS-conscious, or Human-first so you can choose deliberately.',
            },
            {
              q: 'Can I customize the templates?',
              a: 'Yes. Your verified resume content stays intact while you compare structures, palettes, hierarchy, and export behavior in Resume Studio.',
            },
            {
              q: 'What file formats can I download?',
              a: 'Each design includes a styled, selectable-text PDF and a deliberately linear Word companion for easier editing and conservative parsing workflows.',
            },
          ].map(faq => (
            <details
              key={faq.q}
              className={`rounded-xl border p-4 ${
                isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.08] bg-white/[0.03]'
              }`}
            >
              <summary className={`cursor-pointer text-sm font-medium ${isLight ? 'text-slate-950' : 'text-white/70'}`}>
                {faq.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
