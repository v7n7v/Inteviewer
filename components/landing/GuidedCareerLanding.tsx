'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Cell, Pie, PieChart } from 'recharts';
import { TacoMark, TalentConsultingWordmark } from '@/components/BrandLogo';
import { useBillingPrices } from '@/hooks/use-billing-prices';
import { useUserTier } from '@/hooks/use-user-tier';
import { readStoredAttribution } from '@/lib/attribution';
import type { BillingInterval, BillingPlan, PublicBillingPrice } from '@/lib/billing-price-types';
import { foundingOfferForPrice } from '@/lib/billing/founding-offer';
import styles from './GuidedCareerLanding.module.css';

type AuthMode = 'login' | 'signup';

interface GuidedCareerLandingProps {
  isAuthenticated: boolean;
  onOpenAuth: (mode: AuthMode, redirect: string) => void;
}

type JourneyState = 'verified' | 'inferred' | 'review';
type JourneyDirection = -1 | 1;

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  items: Array<{ label: string; source: string; state: JourneyState }>;
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'resume-proof',
    title: 'Resume proof',
    description: 'Turn your experience into verified facts.',
    metric: '98%',
    metricLabel: 'Factual coverage',
    items: [
      { label: 'Work history', source: 'Resume', state: 'verified' },
      { label: 'Impact metrics', source: 'LinkedIn', state: 'verified' },
      { label: 'Skills', source: 'Portfolio', state: 'verified' },
      { label: 'Certifications', source: 'Certifications', state: 'verified' },
      { label: 'Projects', source: 'Projects', state: 'verified' },
      { label: 'Education', source: 'Education', state: 'inferred' },
    ],
  },
  {
    id: 'career-twin',
    title: 'Career Twin',
    description: 'See your context, strengths, and gaps.',
    metric: '12',
    metricLabel: 'Signals connected',
    items: [
      { label: 'Target role', source: 'Career goals', state: 'verified' },
      { label: 'Role strengths', source: 'Resume proof', state: 'verified' },
      { label: 'Skill gaps', source: 'Role comparison', state: 'review' },
      { label: 'Preferences', source: 'Workspace', state: 'verified' },
    ],
  },
  {
    id: 'career-picks',
    title: 'Career Picks by Taco',
    description: 'Get role recommendations with evidence.',
    metric: '87%',
    metricLabel: 'Strongest match',
    items: [
      { label: 'Senior Product Manager', source: 'Acme Digital', state: 'verified' },
      { label: 'Product Manager II', source: 'Northstar Labs', state: 'verified' },
      { label: 'Platform Product Lead', source: 'Cedar Systems', state: 'review' },
    ],
  },
  {
    id: 'review-packet',
    title: 'Review packet',
    description: 'Assemble tailored, review-ready documents.',
    metric: '4',
    metricLabel: 'Drafts prepared',
    items: [
      { label: 'Tailored resume', source: 'Resume proof', state: 'verified' },
      { label: 'Cover letter', source: 'Career Twin', state: 'review' },
      { label: 'Recruiter note', source: 'Role evidence', state: 'review' },
      { label: 'Interview themes', source: 'Story Bank', state: 'verified' },
    ],
  },
  {
    id: 'interview-readiness',
    title: 'Interview readiness',
    description: 'Practice, plan, and build confidence.',
    metric: '8',
    metricLabel: 'Stories ready',
    items: [
      { label: 'Leadership story', source: 'Story Bank', state: 'verified' },
      { label: 'Roadmap strategy', source: 'Interview Studio', state: 'review' },
      { label: 'Conflict example', source: 'Resume proof', state: 'inferred' },
      { label: 'Closing questions', source: 'Saved practice', state: 'verified' },
    ],
  },
  {
    id: 'applications',
    title: 'Applications and follow-up',
    description: 'Apply with intent. Track and improve.',
    metric: '6',
    metricLabel: 'Active opportunities',
    items: [
      { label: 'Acme Digital', source: 'Packet ready', state: 'verified' },
      { label: 'Northstar Labs', source: 'Follow-up due', state: 'review' },
      { label: 'Cedar Systems', source: 'Interview set', state: 'verified' },
      { label: 'Outcome learning', source: 'Two signals', state: 'inferred' },
    ],
  },
];

const LIFECYCLE_GROUPS = [
  {
    name: 'Build',
    description: 'Make your foundation credible.',
    icon: 'description',
    tone: 'blue',
    tools: [
      ['Resume Studio', 'Create source-backed resumes', 'description'],
      ['ATS Analyzer', 'Check fit and improve keywords', 'fact_check'],
      ['Writing Toolkit', 'Write clearly, factually, consistently', 'edit_note'],
    ],
  },
  {
    name: 'Search & apply',
    description: 'Find the right opportunities and move with intent.',
    icon: 'balance',
    tone: 'cyan',
    tools: [
      ['Job Search', 'Discover roles aligned to your goals', 'search'],
      ['Market Oracle', 'See demand and compensation', 'query_stats'],
      ['Applications', 'Manage jobs, tasks, and notes', 'work'],
      ['Network CRM', 'Build and manage relationships', 'group'],
      ['Agent Queue', 'Taco drafts with your approval', 'smart_toy'],
    ],
  },
  {
    name: 'Prepare',
    description: 'Build confidence and interview ready.',
    icon: 'clinical_notes',
    tone: 'violet',
    tools: [
      ['Interview Studio', 'Practice with tailored Q&A', 'mic'],
      ['Interview Debrief', 'Reflect and improve answers', 'forum'],
      ['Story Bank', 'Store and refine your best stories', 'library_books'],
      ['Skill Bridge', 'Close gaps and plan your growth', 'account_tree'],
    ],
  },
  {
    name: 'Grow',
    description: 'Stay current and plan your next chapter.',
    icon: 'monitoring',
    tone: 'green',
    tools: [
      ['Career Intelligence', 'Track trends and plan', 'psychology'],
      ['Career Pulse', 'Monitor progress and momentum', 'monitor_heart'],
      ['Analytics', 'See what is working and why', 'analytics'],
    ],
  },
] as const;

const FREE_TOOLS = [
  ['Career Check', 'Snapshot of your career health.', 'shield_person', '/tools/ats-analyzer'],
  ['Job Match', 'Quick role alignment.', 'social_leaderboard', '/tools/ats-analyzer?mode=job-match'],
  ['Resume Check', 'Facts, clarity and impact.', 'description', '/tools/ats-analyzer'],
  ['Writing Trust', 'Verify claims and sources.', 'verified', '/tools/ai-detector'],
  ['Quick Polish', 'Tighten and improve.', 'draw', '/tools/ai-humanizer'],
  ['Resume Builder', 'Build a clean resume fast.', 'business_center', '/tools/resume-builder'],
  ['AI Humanizer', 'Sound more like you.', 'smart_toy', '/tools/ai-humanizer'],
  ['AI Detector', 'Check AI likelihood.', 'lightbulb', '/tools/ai-detector'],
  ['Interview Prep', 'Practice core questions.', 'mic', '/tools/interview-prep'],
] as const;

const WORKSPACE_SHORTCUTS = [
  { label: 'Resume Studio', description: 'Turn experience into verified proof.', icon: 'description', href: '/suite/resume', accent: 'blue' },
  { label: 'Job Search', description: 'Find roles aligned to your evidence.', icon: 'search', href: '/suite/job-search', accent: 'cyan' },
  { label: 'Taco', description: 'Prepare the next useful move.', icon: 'smart_toy', href: '/suite/agent', accent: 'violet' },
  { label: 'Applications', description: 'Track packets, follow-up, and outcomes.', icon: 'work', href: '/suite/applications', accent: 'green' },
] as const;

const PLAN_CARDS = [
  { name: 'Free', billingPlan: null, description: 'Explore and prove', features: ['Core tools and sample workflows', 'Daily AI previews', 'A private workspace'], destination: '/suite', action: 'Start free' },
  { name: 'Standard', billingPlan: 'pro', description: 'Connect your active search', features: ['Every career tool connected', 'Unlimited exports and tracking', 'Priority AI preparation'], destination: '/suite/upgrade?plan=pro', action: 'Choose Standard' },
  { name: 'Max', billingPlan: 'studio', description: 'Let Taco prepare the next move', features: ['Everything in Standard', 'Deeper Taco research and drafts', 'Six workspace controls'], destination: '/suite/upgrade?plan=studio', action: 'Choose Max' },
] as const satisfies ReadonlyArray<{
  name: string;
  billingPlan: BillingPlan | null;
  description: string;
  features: readonly string[];
  destination: string;
  action: string;
}>;

const FAQS = [
  ['How do you preserve my factual resume?', 'Verified evidence, inferred context, and missing proof stay visibly separate. Unsupported claims never enter a final packet.'],
  ['Do you auto-apply or contact employers for me?', 'No. Taco scouts and prepares, while you review and approve every consequential action.'],
  ['How is my data handled and protected?', 'Your workspace is private, your information is not sold, and you control what is saved or removed.'],
  ['What exactly does Taco do?', 'Taco connects your evidence, goals, target roles, applications, interview stories, and outcomes into the next useful recommendation.'],
  ['What free tools are available?', 'Resume, job-match, writing-trust, polish, humanizer, detector, and interview-prep previews are available.'],
  ['What is the difference between Free, Standard, and Max?', 'Free is for exploration, Standard connects an active search, and Max adds deeper Taco preparation and customization.'],
] as const;

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-rounded ${className}`}>{name}</span>;
}

function getFreeToolsLoopStart(rail: HTMLDivElement) {
  const first = rail.children[0] as HTMLElement | undefined;
  const duplicate = rail.children[FREE_TOOLS.length] as HTMLElement | undefined;
  return first && duplicate ? duplicate.offsetLeft - first.offsetLeft : 0;
}

function EntryAction({
  isAuthenticated,
  destination,
  onOpenAuth,
  children,
  className,
  mode = 'signup',
}: {
  isAuthenticated: boolean;
  destination: string;
  onOpenAuth: (mode: AuthMode, redirect: string) => void;
  children: React.ReactNode;
  className: string;
  mode?: AuthMode;
}) {
  if (isAuthenticated) return <Link className={className} href={destination}>{children}</Link>;
  return <button className={className} type="button" onClick={() => onOpenAuth(mode, destination)}>{children}</button>;
}

function WorkspaceShortcutAction({
  isAuthenticated,
  onOpenAuth,
  onBeforeAuth,
  shortcut,
  tabIndex,
}: {
  isAuthenticated: boolean;
  onOpenAuth: (mode: AuthMode, redirect: string) => void;
  onBeforeAuth: () => void;
  shortcut: typeof WORKSPACE_SHORTCUTS[number];
  tabIndex: number;
}) {
  const content = <><span><Icon name={shortcut.icon} /></span><strong>{shortcut.label}</strong><small>{shortcut.description}</small><Icon name="arrow_outward" /></>;
  if (isAuthenticated) {
    return <Link href={shortcut.href} data-accent={shortcut.accent} className={styles.workspaceShortcut} tabIndex={tabIndex}>{content}</Link>;
  }
  return <button type="button" data-accent={shortcut.accent} className={styles.workspaceShortcut} tabIndex={tabIndex} onClick={() => { onBeforeAuth(); onOpenAuth('signup', shortcut.href); }}>{content}</button>;
}

function HeroVisual() {
  return (
    <div className={styles.heroVisual} aria-label="Taco recommendation preview">
      <div className={styles.resumeProofCard}>
        <strong>Resume proof</strong>
        <small>6 sources · 98% factual coverage</small>
        {['Work history', 'Impact metrics', 'Skills', 'Education', 'Certifications', 'Projects'].map((item) => (
          <span key={item}><Icon name="check_circle" />{item}</span>
        ))}
      </div>
      <div className={styles.resumeSheet}>
        <strong>Jordan Lee</strong>
        <small>Product Manager</small>
        <div className={styles.resumeMeta}><span>jordan.lee@email.com</span><span>New York, NY</span></div>
        <div className={styles.resumeSection}><b>Experience</b><p><strong>Senior Product Manager</strong><span>Acme Digital · 2021–Present</span></p><small>Led roadmap delivery across three product lines.</small></div>
        <div className={styles.resumeSection}><b>Core skills</b><small>Product strategy · Analytics · Leadership</small></div>
      </div>
      <div className={styles.tacoCard}>
      <div className={styles.tacoCardHeader}>
        <TacoMark className={styles.tacoMark} />
        <div><strong>Taco recommendation</strong><b>Senior Product Manager</b><small>Acme Digital Products · Remote · Full-time</small></div>
        <div className={styles.matchStrength}><span className={styles.matchBadge}>Strong match</span><span className={styles.matchScoreLabel}><small>Match strength</small><strong>87%</strong></span><span className={styles.matchMeter}><span /></span></div>
        </div>
        <div className={styles.tacoEvidenceGrid}>
          <div><b><Icon name="verified" />Verified evidence</b><span><Icon name="check_circle" />Led cross-functional roadmap delivery for a SaaS platform</span><span><Icon name="check_circle" />Improved activation by 24% through product experiments</span></div>
          <div><b><Icon name="error" />Uncertainty</b><p>Missing scale metric for your base or revenue impact.</p><button type="button">Add evidence</button></div>
          <div><b><Icon name="flag" />Next action</b><p>Strengthen scale metric or review role details.</p><button type="button">Review role</button></div>
        </div>
        <div className={styles.tacoFooter}>Taco is strategic, candid, and review-first.</div>
      </div>
    </div>
  );
}

function PriceDisplay({ plan, price, interval, loading }: { plan: BillingPlan; price: PublicBillingPrice | null; interval: BillingInterval; loading: boolean }) {
  if (!price || loading) {
    return <div className={styles.planPrice} aria-live="polite"><strong>Loading verified price…</strong><span>Checking the current catalogue</span></div>;
  }

  const unavailable = price.sourceStatus !== 'verified' || !price.active || price.unitAmount == null;
  const foundingOffer = foundingOfferForPrice(plan, price);
  return (
    <div className={styles.planPrice} aria-live="polite">
      <strong>{unavailable ? 'Price unavailable' : foundingOffer?.display || price.display}</strong>
      <span>{unavailable
        ? 'View the plan for current availability'
        : foundingOffer
          ? <>Founding price · regular <s>{price.display}</s> · auto-applied</>
          : interval === 'year'
            ? [price.effectiveMonthlyDisplay, price.savingsLabel].filter(Boolean).join(' · ')
            : 'Billed monthly'}</span>
    </div>
  );
}

function JourneyPreview({ step, direction }: { step: JourneyStep; direction: JourneyDirection }) {
  const chartValue = Number.parseInt(step.metric, 10) || 75;
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={styles.journeyPreview}
      id="journey-preview"
      role="tabpanel"
      aria-labelledby={`journey-tab-${step.id}`}
      initial={prefersReducedMotion ? false : { opacity: 0, x: direction * 10, scale: 0.995 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, x: direction * -8, scale: 0.995 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
    >
      <div className={styles.evidenceChecklist}>
        <h3>{step.title}</h3>
        <p>{step.items.length} sources · {step.metric} {step.metricLabel.toLowerCase()}</p>
        <ul>{step.items.map((item) => <li key={item.label}><Icon name={item.state === 'review' ? 'error' : 'check_circle'} />{item.label}</li>)}</ul>
      </div>
      <div className={styles.sourceCoverage}>
        <strong>Source coverage</strong>
        {step.items.map((item) => <div key={item.label}><span><Icon name={item.state === 'review' ? 'warning' : 'draft'} />{item.source}</span><em data-state={item.state}>{item.state === 'verified' ? 'Verified' : item.state === 'inferred' ? 'Inferred' : 'Review'}</em></div>)}
      </div>
      <div className={styles.qualityScore}>
        <strong>Evidence quality</strong>
        <div className={styles.donutWrap}>
          <PieChart width={112} height={112}>
            <Pie data={[{ value: Math.min(chartValue, 98) }, { value: 100 - Math.min(chartValue, 98) }]} dataKey="value" innerRadius={39} outerRadius={49} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
              <Cell fill="#1ba672" /><Cell fill="#e8edf2" />
            </Pie>
          </PieChart>
          <b>{step.metric}</b>
        </div>
        <small>{step.metricLabel}</small>
        <div><b>Gaps to explore</b><span>{step.id === 'resume-proof' ? '1 missing metric' : '1 item to review'}</span></div>
      </div>
    </motion.div>
  );
}

export function GuidedCareerLanding({ isAuthenticated, onOpenAuth }: GuidedCareerLandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeJourney, setActiveJourney] = useState(0);
  const [journeyDirection, setJourneyDirection] = useState<JourneyDirection>(1);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [freeToolsPaused, setFreeToolsPaused] = useState(false);
  const [freeToolsUserPaused, setFreeToolsUserPaused] = useState(false);
  const [freeToolsInView, setFreeToolsInView] = useState(false);
  const [workspaceDeckOpen, setWorkspaceDeckOpen] = useState(false);
  const [workspaceUsesToggle, setWorkspaceUsesToggle] = useState(false);
  const [lifecycleShimmered, setLifecycleShimmered] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const prefersReducedMotion = useReducedMotion();
  const { tier } = useUserTier();
  const { prices, loading: billingLoading } = useBillingPrices();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const freeToolsRailRef = useRef<HTMLDivElement | null>(null);
  const freeToolsResumeTimerRef = useRef<number | null>(null);
  const lifecycleExplorerRef = useRef<HTMLDetailsElement | null>(null);
  const workspaceDeckRef = useRef<HTMLDivElement | null>(null);
  const workspaceDeckToggleRef = useRef<HTMLButtonElement | null>(null);
  const entryLabel = isAuthenticated ? 'Open workspace' : 'Start free';
  const maxSettingsDestination = isAuthenticated && (tier === 'studio' || tier === 'god')
    ? '/suite/settings?section=appearance'
    : '/suite/upgrade?plan=studio';

  const selectJourney = (index: number, direction?: JourneyDirection, focusTab = true) => {
    const nextIndex = (index + JOURNEY_STEPS.length) % JOURNEY_STEPS.length;
    setJourneyDirection(direction ?? (nextIndex >= activeJourney ? 1 : -1));
    setActiveJourney(nextIndex);
    if (focusTab) tabRefs.current[nextIndex]?.focus();
  };

  const handleJourneyKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); selectJourney(index + 1, 1); }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); selectJourney(index - 1, -1); }
    if (event.key === 'Home') { event.preventDefault(); selectJourney(0, -1); }
    if (event.key === 'End') { event.preventDefault(); selectJourney(JOURNEY_STEPS.length - 1, 1); }
  };

  useEffect(() => {
    const rail = freeToolsRailRef.current;
    if (!rail) return;
    const observer = new IntersectionObserver(([entry]) => setFreeToolsInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 680px), (hover: none), (pointer: coarse)');
    const updateWorkspaceMode = () => {
      setWorkspaceUsesToggle(query.matches);
      if (query.matches) {
        const focusWasInsideDeck = workspaceDeckRef.current?.contains(document.activeElement) === true;
        setWorkspaceDeckOpen(false);
        if (focusWasInsideDeck) window.requestAnimationFrame(() => workspaceDeckToggleRef.current?.focus({ preventScroll: true }));
      }
    };
    updateWorkspaceMode();
    query.addEventListener('change', updateWorkspaceMode);
    return () => query.removeEventListener('change', updateWorkspaceMode);
  }, []);

  useEffect(() => {
    const explorer = lifecycleExplorerRef.current;
    if (!explorer || lifecycleShimmered || prefersReducedMotion) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setLifecycleShimmered(true);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(explorer);
    return () => observer.disconnect();
  }, [lifecycleShimmered, prefersReducedMotion]);

  useEffect(() => {
    if (!freeToolsInView || freeToolsPaused || freeToolsUserPaused || prefersReducedMotion) return;
    let frame = 0;
    let previousTime = performance.now();
    let position = freeToolsRailRef.current?.scrollLeft ?? 0;
    let renderedPosition = position;
    const advance = (time: number) => {
      const rail = freeToolsRailRef.current;
      if (!rail) return;
      const elapsed = Math.min(time - previousTime, 40);
      previousTime = time;
      const loopStart = getFreeToolsLoopStart(rail);
      const pixelsPerSecond = rail.clientWidth <= 680 ? 36 : 44;
      const actualPosition = rail.scrollLeft;
      if (Math.abs(actualPosition - renderedPosition) > 1) position = actualPosition;
      position += elapsed * (pixelsPerSecond / 1000);
      if (loopStart > 0 && position >= loopStart) position -= loopStart;
      rail.scrollLeft = position;
      renderedPosition = rail.scrollLeft;
      frame = window.requestAnimationFrame(advance);
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [freeToolsInView, freeToolsPaused, freeToolsUserPaused, prefersReducedMotion]);

  useEffect(() => () => {
    if (freeToolsResumeTimerRef.current !== null) window.clearTimeout(freeToolsResumeTimerRef.current);
  }, []);

  const resumeFreeToolsAfterDelay = () => {
    if (freeToolsResumeTimerRef.current !== null) window.clearTimeout(freeToolsResumeTimerRef.current);
    freeToolsResumeTimerRef.current = window.setTimeout(() => {
      setFreeToolsPaused(false);
      freeToolsResumeTimerRef.current = null;
    }, 4000);
  };

  const pauseFreeTools = () => {
    if (freeToolsResumeTimerRef.current !== null) {
      window.clearTimeout(freeToolsResumeTimerRef.current);
      freeToolsResumeTimerRef.current = null;
    }
    setFreeToolsPaused(true);
  };

  const handleWorkspaceDeckKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setWorkspaceDeckOpen(false);
    if (workspaceUsesToggle) window.requestAnimationFrame(() => workspaceDeckToggleRef.current?.focus());
  };

  const prepareWorkspaceShortcutAuth = () => {
    setWorkspaceDeckOpen(false);
    if (workspaceUsesToggle) workspaceDeckToggleRef.current?.focus({ preventScroll: true });
  };

  const submitNewsletter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewsletterStatus('submitting');
    try {
      const response = await fetch('/api/newsletter/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail, frequency: 'weekly', sourcePath: window.location.pathname || '/', referrer: document.referrer || null, ...readStoredAttribution() }),
      });
      if (!response.ok) throw new Error('Newsletter signup failed');
      setNewsletterStatus('success');
    } catch {
      setNewsletterStatus('error');
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmarkLink} aria-label="TalentConsulting.io home"><TalentConsultingWordmark darkSurface /></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <a href="#product">Product <Icon name="expand_more" /></a><a href="#tools">Tools <Icon name="expand_more" /></a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><Link href="/for-teams">For teams</Link><Link href="/blog">Resources <Icon name="expand_more" /></Link>
          </nav>
          <div className={styles.headerActions}>
            {!isAuthenticated && <button className={styles.signInButton} type="button" onClick={() => onOpenAuth('login', '/suite')}>Sign in</button>}
            <EntryAction isAuthenticated={isAuthenticated} destination="/suite" onOpenAuth={onOpenAuth} className={styles.headerCta}>{entryLabel}</EntryAction>
            <button type="button" className={styles.mobileMenuButton} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" aria-label="Toggle navigation" onClick={() => setMobileMenuOpen((open) => !open)}><Icon name={mobileMenuOpen ? 'close' : 'menu'} /></button>
          </div>
        </div>
        {mobileMenuOpen && <nav id="mobile-navigation" className={styles.mobileNav} aria-label="Mobile navigation"><a href="#product" onClick={() => setMobileMenuOpen(false)}>Product</a><a href="#tools" onClick={() => setMobileMenuOpen(false)}>Tools</a><a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a><a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a><Link href="/for-teams">For teams</Link><Link href="/blog">Resources</Link></nav>}
      </header>

      <section className={styles.hero} id="product">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>The career operating system</p>
            <h1>Turn scattered<br />job-search work into<br /><span>one clear next move.</span></h1>
            <p className={styles.heroLead}>One workspace for resume proof, role discovery,<br />application packets, interviews, relationships,<br />skills, and outcomes.</p>
            <div className={styles.heroActions}><EntryAction isAuthenticated={isAuthenticated} destination="/suite/resume" onOpenAuth={onOpenAuth} className={styles.primaryButton}>{isAuthenticated ? 'Open Resume Studio' : 'Upload your resume'} <Icon name="upload" /></EntryAction><a className={styles.secondaryButton} href="#how-it-works">See the full workflow</a></div>
            <p className={styles.controlNote}><Icon name="verified_user" />No auto-apply. Review before every consequential action.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      <div className={styles.trustContract} aria-label="Talent Consulting trust contract">
        <div className={styles.container}>{[
          ['verified_user', 'Your facts stay yours.', 'You own your data. We do not sell or share it.'],
          ['fact_check', 'Verified vs. inferred.', 'We label what is verified, inferred, and missing.'],
          ['edit_note', 'Drafts require review.', 'Every draft is yours to edit and approve.'],
          ['lock', 'Nothing submitted without approval.', 'You review before any outreach or submission.'],
        ].map(([icon,title,copy]) => <div key={title}><Icon name={icon} /><p><strong>{title}</strong><span>{copy}</span></p></div>)}</div>
      </div>

      <section className={styles.journeySection} id="how-it-works">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><h2>Follow one career story.</h2><p>We guide your next step—one decision at a time.</p></div>
          <div className={styles.journeyLayout}>
            <div className={styles.journeySteps} role="tablist" aria-orientation="vertical" aria-label="Career journey steps">{JOURNEY_STEPS.map((step,index) => <button key={step.id} id={`journey-tab-${step.id}`} ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" tabIndex={activeJourney === index ? 0 : -1} aria-selected={activeJourney === index} aria-controls="journey-preview" className={activeJourney === index ? styles.activeJourneyStep : ''} onClick={() => selectJourney(index, index >= activeJourney ? 1 : -1, false)} onKeyDown={(event) => handleJourneyKeyDown(event,index)}><span>{index + 1}</span><p><strong>{step.title}</strong><small>{step.description}</small></p></button>)}</div>
            <AnimatePresence mode="wait" initial={false}><JourneyPreview key={JOURNEY_STEPS[activeJourney].id} step={JOURNEY_STEPS[activeJourney]} direction={journeyDirection} /></AnimatePresence>
          </div>
          <div className={styles.journeyControls}><div>{JOURNEY_STEPS.map((step,index) => <button key={step.id} type="button" aria-label={`Show ${step.title}`} aria-current={activeJourney === index ? 'step' : undefined} onClick={() => selectJourney(index, index >= activeJourney ? 1 : -1, false)} />)}</div><button type="button" aria-label="Previous journey step" onClick={() => selectJourney(activeJourney - 1, -1)}><Icon name="chevron_left" /></button><button type="button" aria-label="Next journey step" onClick={() => selectJourney(activeJourney + 1, 1)}><Icon name="chevron_right" /></button></div>
          <details ref={lifecycleExplorerRef} className={`${styles.toolExplorer} ${lifecycleShimmered ? styles.toolExplorerShimmer : ''}`} id="tools">
            <summary><span><Icon name="view_quilt" /><b>Explore every tool across the career lifecycle</b></span><span>18 connected tools <Icon name="expand_more" /></span></summary>
            <div className={styles.lifecycleRows}>{LIFECYCLE_GROUPS.map((group) => <article className={styles.lifecycleRow} data-tone={group.tone} key={group.name}><div className={styles.groupIdentity}><Icon name={group.icon} /><p><strong>{group.name}</strong><span>{group.description}</span></p></div><ul>{group.tools.map(([tool,description,icon]) => <li key={tool}><Icon name={icon} /><p><strong>{tool}</strong><span>{description}</span></p></li>)}</ul></article>)}</div>
          </details>
        </div>
      </section>

      <section className={styles.freeToolsSection}>
        <div className={`${styles.container} ${styles.freeTools}`}>
          <div className={styles.freeToolsHeading}>
            <div><h2>Free tools to start—no account needed.</h2><p>Move at your pace. The rail pauses when you interact.</p></div>
            <button
              type="button"
              className={styles.motionPill}
              aria-label={prefersReducedMotion ? 'Motion off because reduced motion is enabled' : `${freeToolsUserPaused ? 'Enable' : 'Disable'} free tools motion`}
              aria-pressed={!freeToolsUserPaused && !prefersReducedMotion}
              disabled={prefersReducedMotion === true}
              onClick={() => setFreeToolsUserPaused((paused) => !paused)}
            ><Icon name="motion_mode" /><span>Motion</span><b>{!freeToolsUserPaused && !prefersReducedMotion ? 'On' : 'Off'}</b></button>
          </div>
          <div className={styles.freeToolsRail} data-autoplay={freeToolsInView && !freeToolsPaused && !freeToolsUserPaused && !prefersReducedMotion ? 'true' : 'false'} ref={freeToolsRailRef} role="region" aria-label="Free career tools" tabIndex={0} onMouseEnter={pauseFreeTools} onMouseLeave={resumeFreeToolsAfterDelay} onFocusCapture={pauseFreeTools} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resumeFreeToolsAfterDelay(); }} onWheel={() => { pauseFreeTools(); resumeFreeToolsAfterDelay(); }} onPointerDown={pauseFreeTools} onPointerUp={resumeFreeToolsAfterDelay} onPointerCancel={resumeFreeToolsAfterDelay}>{[0, 1].flatMap((copy) => FREE_TOOLS.map(([label,description,icon,href]) => <Link href={href} key={`${copy}-${label}`} aria-hidden={copy === 1 ? true : undefined} tabIndex={copy === 1 ? -1 : 0}><Icon name={icon} /><span><strong>{label}</strong><small>{description}</small></span><Icon name="arrow_outward" /></Link>))}</div>
        </div>
      </section>

      <section className={styles.evidenceSection}><div className={`${styles.container} ${styles.evidenceLayout}`}>
        <article className={styles.recommendationCard}><h2>Proof behind every recommendation.</h2><div className={styles.recommendationEvidence}><div><strong><Icon name="verified" />Verified evidence</strong><span>Led cross-functional roadmap delivery for a SaaS platform.</span><span>Improved activation by 24% through product experiments.</span></div><div><strong><Icon name="error" />Uncertainty</strong><span>Scale of customer or revenue impact is still missing.</span><strong className={styles.nextActionLabel}><Icon name="flag" />Next action</strong><EntryAction isAuthenticated={isAuthenticated} destination="/suite/agent" onOpenAuth={onOpenAuth} className={styles.inlineAction}>Add one scale metric</EntryAction></div></div><footer>Evidence first. Uncertainty visible. You decide the next move.</footer></article>
        <article className={styles.packetCard}><h2>Review packet—every draft is yours to approve.</h2><div className={styles.packetGrid}>{[['Tailored resume','description'],['Cover letter','mail'],['Screening answers','quiz'],['Interview themes','clinical_notes'],['Follow-up draft','send']].map(([label,icon]) => <div key={label}><Icon name={icon} /><strong>{label}</strong><span>Draft · review required</span></div>)}</div><div className={styles.claimBlock}><Icon name="warning" /><p><strong>Unsupported claim blocked</strong><span>We won’t include claims without evidence.</span></p><EntryAction isAuthenticated={isAuthenticated} destination="/suite/applications" onOpenAuth={onOpenAuth} className={styles.packetAction}>View packet</EntryAction></div></article>
      </div>
      <div className={`${styles.container} ${styles.handoffCard}`}>
        <header><h2>The public story ends. Your workspace begins.</h2><p>Move from a guided preview to your saved career system.</p></header>
        <div className={styles.workspaceHandoff}>
          <div className={styles.publicSiteCard}><strong>Explore in public</strong>{['Learn the workflow','Try tools with sample data','No personal data required'].map((item) => <span key={item}><Icon name="radio_button_checked" />{item}</span>)}</div>
          <div
            ref={workspaceDeckRef}
            className={styles.workspaceDeck}
            data-open={workspaceDeckOpen ? 'true' : 'false'}
            onMouseEnter={() => { if (!workspaceUsesToggle) setWorkspaceDeckOpen(true); }}
            onMouseLeave={(event) => { if (!workspaceUsesToggle && !event.currentTarget.contains(document.activeElement)) setWorkspaceDeckOpen(false); }}
            onFocusCapture={() => { if (!workspaceUsesToggle) setWorkspaceDeckOpen(true); }}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setWorkspaceDeckOpen(false); }}
            onKeyDown={handleWorkspaceDeckKeyDown}
          >
            <div className={styles.workspaceDeckTop}>
              <div><span><Icon name="verified_user" /></span><p><strong>Continue in your workspace</strong><small>{workspaceUsesToggle ? 'Tap below to choose exactly where you want to begin.' : 'Hover or focus to open your four shortcuts.'}</small></p></div>
              <button ref={workspaceDeckToggleRef} type="button" className={styles.workspaceDeckToggle} aria-expanded={workspaceDeckOpen} aria-controls="workspace-shortcuts" onClick={() => setWorkspaceDeckOpen((open) => !open)}>{workspaceDeckOpen ? 'Hide starting points' : 'Choose a starting point'} <Icon name="expand_more" /></button>
            </div>
            <div className={styles.workspaceDeckSignals}>{['Saved context','Private by default','Outcome learning'].map((item) => <span key={item}><Icon name="verified_user" />{item}</span>)}</div>
            <div id="workspace-shortcuts" className={styles.workspaceShortcuts} aria-hidden={workspaceUsesToggle && !workspaceDeckOpen ? true : undefined}>
              {WORKSPACE_SHORTCUTS.map((shortcut) => <WorkspaceShortcutAction key={shortcut.label} isAuthenticated={isAuthenticated} onOpenAuth={onOpenAuth} onBeforeAuth={prepareWorkspaceShortcutAuth} shortcut={shortcut} tabIndex={workspaceUsesToggle && !workspaceDeckOpen ? -1 : 0} />)}
            </div>
            <div className={styles.workspaceDeckFooter}><span>Your facts and approvals stay attached.</span><EntryAction isAuthenticated={isAuthenticated} destination="/suite" onOpenAuth={onOpenAuth} className={styles.workspaceDeckAction}>{entryLabel}</EntryAction></div>
          </div>
        </div>
      </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.container}>
          <div className={styles.pricingHeading}><h2>Three plans. One operating system.</h2><p>Start free. Choose Standard for tools and control or Max for deeper Taco preparation.</p><div className={styles.billingToggle} aria-label="Billing interval"><button type="button" aria-pressed={billingInterval === 'month'} onClick={() => setBillingInterval('month')}>Monthly</button><button type="button" aria-pressed={billingInterval === 'year'} onClick={() => setBillingInterval('year')}>Annual</button></div></div>
          <div className={styles.planGrid}>{PLAN_CARDS.map((plan) => {
            const price = plan.billingPlan ? prices.plans[plan.billingPlan][billingInterval] : null;
            const checkoutReady = plan.billingPlan ? prices.checkout.options[plan.billingPlan][billingInterval] && price?.sourceStatus === 'verified' && price?.active === true : true;
            const destination = plan.billingPlan ? `${plan.destination}&interval=${billingInterval}` : plan.destination;
            const action = plan.billingPlan && !checkoutReady ? 'View plan details' : plan.action;
            return <article key={plan.name} className={styles.planCard} data-plan={plan.name.toLowerCase()}><div className={styles.planTitle}><div><h3>{plan.name}</h3><p>{plan.description}</p></div>{plan.name === 'Standard' && <span>Tools + control</span>}{plan.name === 'Max' && <span>Taco + preparation</span>}</div>{plan.billingPlan ? <PriceDisplay plan={plan.billingPlan} price={price} interval={billingInterval} loading={billingLoading} /> : <div className={styles.planPrice}><strong>$0</strong><span>No card required</span></div>}<ul>{plan.features.map((feature) => <li key={feature}><Icon name="check" />{feature}</li>)}</ul><EntryAction isAuthenticated={isAuthenticated} destination={destination} onOpenAuth={onOpenAuth} className={plan.name === 'Max' ? styles.planPrimary : styles.planSecondary}>{action}</EntryAction>{plan.name === 'Max' && <details className={styles.maxControls}><summary>See six Max controls <Icon name="expand_more" /></summary><div>{[['Collapse sidebar','left_panel_close'],['Default landing','space_dashboard'],['Module visibility','view_quilt'],['Density control','view_week'],['Reduced motion','motion_mode'],['Taco focus','tune']].map(([title,icon]) => <span key={title}><Icon name={icon} />{title}</span>)}</div><EntryAction isAuthenticated={isAuthenticated} destination={maxSettingsDestination} onOpenAuth={onOpenAuth} className={styles.maxSettingsAction}>Open personalization</EntryAction></details>}</article>;
          })}</div>
          <details className={styles.planComparison}><summary>Compare every plan feature <Icon name="expand_more" /></summary><p>See limits, exports, Taco preparation, customization, and support before you choose.</p><Link href="/suite/upgrade">Open the full plan comparison</Link></details>
        </div>
      </section>

      <section className={styles.reassuranceSection}><div className={`${styles.container} ${styles.trustByDesign}`}><div className={styles.trustStatement}><Icon name="verified_user" /><p><strong>Human judgment stays in the loop.</strong><span>Taco prepares the work; you review every consequential action.</span></p><Link href="/privacy">Read our privacy principles <Icon name="arrow_forward" /></Link></div></div><div className={`${styles.container} ${styles.faqSection}`}><h2>Questions? We’ve got answers.</h2><div>{FAQS.map(([question,answer]) => <details key={question}><summary>{question}<Icon name="expand_more" /></summary><p>{answer}</p></details>)}</div></div></section>

      <section className={styles.finalCta}><div className={styles.container}><p><strong>Bring your career into one system.</strong><span>One workspace. Every next step. Always under your control.</span></p><div><EntryAction isAuthenticated={isAuthenticated} destination="/suite" onOpenAuth={onOpenAuth} className={styles.headerCta}>{entryLabel}</EntryAction><EntryAction isAuthenticated={isAuthenticated} destination="/suite" onOpenAuth={onOpenAuth} className={styles.footerSecondary} mode="login">Open workspace</EntryAction></div></div></section>

      <footer className={styles.footer}><div className={`${styles.container} ${styles.footerGrid}`}><div className={styles.footerBrand}><TalentConsultingWordmark darkSurface /><p>The career operating system built for proof, preparation, and progress—never autopilot.</p><form className={styles.newsletterForm} onSubmit={submitNewsletter}><label htmlFor="landing-newsletter">One useful career note each week.</label><div><input id="landing-newsletter" type="email" required autoComplete="email" value={newsletterEmail} disabled={newsletterStatus === 'submitting' || newsletterStatus === 'success'} onChange={(event) => { setNewsletterEmail(event.target.value); if (newsletterStatus !== 'idle') setNewsletterStatus('idle'); }} placeholder="you@example.com" /><button type="submit" disabled={newsletterStatus === 'submitting' || newsletterStatus === 'success'}>{newsletterStatus === 'submitting' ? 'Joining…' : newsletterStatus === 'success' ? 'You’re in' : 'Join free'}</button></div><p aria-live="polite">{newsletterStatus === 'success' ? 'Thanks—watch your inbox for the next note.' : newsletterStatus === 'error' ? 'We could not save that email. Please try again.' : 'Practical guidance. No spam.'}</p></form></div><div><strong>Product</strong><a href="#how-it-works">Overview</a><a href="#pricing">Pricing</a><Link href="/suite">Workspace</Link></div><div><strong>Tools</strong><a href="#tools">All tools</a><Link href="/tools/ats-analyzer">Free tools</Link><Link href="/suite/agent">Taco intelligence</Link></div><div><strong>Resources</strong><Link href="/help">Guides</Link><Link href="/templates">Templates</Link><Link href="/blog">Insights</Link></div><div><strong>Company</strong><Link href="/for-teams">For teams</Link><Link href="/help">Help center</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div><div className={`${styles.container} ${styles.footerBottom}`}><span>© 2026 Talent Consulting, Inc. All rights reserved.</span><span>Built for human judgment, not autopilot.</span></div></footer>
    </main>
  );
}
