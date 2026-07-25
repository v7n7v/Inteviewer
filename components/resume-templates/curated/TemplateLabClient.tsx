'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ResumeTemplate } from '@/components/resume-templates';
import {
  RESUME_TEMPLATE_FIXTURES,
  type ResumeTemplateFixtureId,
} from '@/lib/resume-templates/fixtures';
import { getSelectableTemplates } from '@/lib/resume-templates';
import { PLAN_IDENTITIES } from '@/lib/plan-identity';

const TEMPLATES = getSelectableTemplates();
const FIXTURE_IDS: ResumeTemplateFixtureId[] = ['full', 'sparse', 'long'];
const TEMPLATE_DESIGN_WIDTH = 794;

export default function TemplateLabClient({
  initialTemplateId,
  initialFixtureId,
  initialDark,
}: {
  initialTemplateId?: string;
  initialFixtureId?: string;
  initialDark?: boolean;
}) {
  const [templateId, setTemplateId] = useState(
    TEMPLATES.some(template => template.id === initialTemplateId)
      ? initialTemplateId!
      : TEMPLATES[0].id,
  );
  const [fixtureId, setFixtureId] = useState<ResumeTemplateFixtureId>(
    FIXTURE_IDS.includes(initialFixtureId as ResumeTemplateFixtureId)
      ? initialFixtureId as ResumeTemplateFixtureId
      : 'full',
  );
  const [dark, setDark] = useState(Boolean(initialDark));
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number>();
  const template = useMemo(
    () => TEMPLATES.find(candidate => candidate.id === templateId) || TEMPLATES[0],
    [templateId],
  );
  const resume = RESUME_TEMPLATE_FIXTURES[fixtureId];

  useEffect(() => {
    const frame = previewFrameRef.current;
    const content = previewContentRef.current;
    if (!frame || !content) return;

    const measure = () => {
      const nextScale = Math.min(1, frame.clientWidth / TEMPLATE_DESIGN_WIDTH);
      setPreviewScale(nextScale);
      setPreviewHeight(content.scrollHeight * nextScale);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fixtureId, template.id]);

  const syncUrl = (nextTemplate: string, nextFixture: ResumeTemplateFixtureId, nextDark: boolean) => {
    const params = new URLSearchParams({
      template: nextTemplate,
      fixture: nextFixture,
      theme: nextDark ? 'dark' : 'light',
    });
    window.history.replaceState({}, '', `/resume-template-lab?${params.toString()}`);
  };

  return (
    <main
      data-template-lab
      data-template-id={template.id}
      data-fixture={fixtureId}
      className={`min-h-dvh px-4 py-6 sm:px-8 ${dark ? 'bg-[#090a0c] text-white' : 'bg-slate-100 text-slate-950'}`}
    >
      <div className={`sticky top-3 z-40 mx-auto mb-6 flex max-w-[1080px] flex-wrap items-center gap-3 rounded-2xl border p-3 shadow-xl backdrop-blur ${
        dark ? 'border-white/10 bg-[#111318]/90' : 'border-slate-200 bg-white/90'
      }`}>
        <label className="text-xs font-semibold">
          Template
          <select
            aria-label="Template"
            value={template.id}
            onChange={event => {
              setTemplateId(event.target.value);
              syncUrl(event.target.value, fixtureId, dark);
            }}
            className={`ml-2 rounded-lg border px-2 py-1.5 text-xs ${dark ? 'border-white/15 bg-black text-white' : 'border-slate-300 bg-white'}`}
          >
            {TEMPLATES.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Fixture
          <select
            aria-label="Fixture"
            value={fixtureId}
            onChange={event => {
              const next = event.target.value as ResumeTemplateFixtureId;
              setFixtureId(next);
              syncUrl(template.id, next, dark);
            }}
            className={`ml-2 rounded-lg border px-2 py-1.5 text-xs ${dark ? 'border-white/15 bg-black text-white' : 'border-slate-300 bg-white'}`}
          >
            {FIXTURE_IDS.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const next = !dark;
            setDark(next);
            syncUrl(template.id, fixtureId, next);
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${dark ? 'border-white/15 bg-white/5' : 'border-slate-300 bg-slate-50'}`}
        >
          {dark ? 'Light chrome' : 'Dark chrome'}
        </button>
        <div className="ml-auto text-right text-[11px] opacity-70">
          <div>{template.atsClassification} · {template.tier === 'pro' ? PLAN_IDENTITIES.pro.label : 'FREE'}</div>
          <div>{template.structure.family} · {template.structure.columns} column</div>
        </div>
      </div>

      <div
        ref={previewFrameRef}
        className="mx-auto w-full max-w-[794px] overflow-hidden rounded-sm bg-white shadow-2xl"
        style={{ height: previewHeight }}
      >
        <div
          ref={previewContentRef}
          data-template-lab-scale={previewScale.toFixed(4)}
          style={{
            width: TEMPLATE_DESIGN_WIDTH,
            transform: `matrix(${previewScale}, 0, 0, ${previewScale}, 0, 0)`,
            transformOrigin: 'top left',
          }}
        >
          <ResumeTemplate
            resume={resume}
            templateId={template.id}
            colors={template.colors}
          />
        </div>
      </div>
    </main>
  );
}
