const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('public landing keeps a bounded, progressively disclosed narrative', () => {
  const source = read('components/landing/GuidedCareerLanding.tsx');
  assert.equal((source.match(/<section className=\{styles\./g) || []).length, 7);
  assert.match(source, /<details ref=\{lifecycleExplorerRef\} className=\{`\$\{styles\.toolExplorer\} \$\{lifecycleShimmered \? styles\.toolExplorerShimmer : ''\}`\} id="tools">/);
  assert.doesNotMatch(source, /<section className=\{styles\.lifecycleSection\}/);
  assert.doesNotMatch(source, /<section className=\{styles\.personalizationSection\}/);
  assert.match(source, /Proof behind every recommendation/);
  assert.doesNotMatch(source, /recommendationSummary/);
  assert.match(source, /See six Max controls/);
});

test('free-tool rail is bounded, pausable, motion-aware, and seam-safe', () => {
  const source = read('components/landing/GuidedCareerLanding.tsx');
  const css = read('components/landing/GuidedCareerLanding.module.css');
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /const pixelsPerSecond = rail\.clientWidth <= 680 \? 36 : 44/);
  assert.match(source, /pixelsPerSecond \/ 1000/);
  assert.match(source, /className=\{styles\.motionPill\}/);
  assert.match(source, /<span>Motion<\/span><b>\{!freeToolsUserPaused && !prefersReducedMotion \? 'On' : 'Off'\}<\/b>/);
  assert.doesNotMatch(source, /Previous free tools|Next free tools|Pause free tools motion/);
  assert.match(source, /duplicate\.offsetLeft - first\.offsetLeft/);
  assert.match(source, /tabIndex=\{copy === 1 \? -1 : 0\}/);
  assert.match(source, /aria-hidden=\{copy === 1 \? true : undefined\}/);
  assert.match(css, /\.freeToolsRail a \{ --tool-accent:/);
  assert.match(css, /\.freeToolsRail a:hover, \.freeToolsRail a:focus-visible/);
});

test('workspace deck exposes four exact shortcuts across pointer and compact layouts', () => {
  const source = read('components/landing/GuidedCareerLanding.tsx');
  const css = read('components/landing/GuidedCareerLanding.module.css');
  for (const [label, route] of [
    ['Resume Studio', '/suite/resume'],
    ['Job Search', '/suite/job-search'],
    ['Taco', '/suite/agent'],
    ['Applications', '/suite/applications'],
  ]) {
    assert.match(source, new RegExp(`label: '${label}'.+href: '${route.replaceAll('/', '\\/')}'`));
  }
  assert.match(source, /onMouseEnter=\{\(\) => \{ if \(!workspaceUsesToggle\) setWorkspaceDeckOpen\(true\); \}\}/);
  assert.match(source, /onFocusCapture=\{\(\) => \{ if \(!workspaceUsesToggle\) setWorkspaceDeckOpen\(true\); \}\}/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /workspaceDeckToggleRef\.current\?\.focus\(\)/);
  assert.match(source, /aria-expanded=\{workspaceDeckOpen\}/);
  assert.match(source, /tabIndex=\{workspaceUsesToggle && !workspaceDeckOpen \? -1 : 0\}/);
  assert.match(source, /if \(isAuthenticated\) \{\s*return <Link href=\{shortcut\.href\}/);
  assert.match(source, /onClick=\{\(\) => \{ onBeforeAuth\(\); onOpenAuth\('signup', shortcut\.href\); \}\}/);
  assert.match(source, /workspaceDeckToggleRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /const focusWasInsideDeck = workspaceDeckRef\.current\?\.contains\(document\.activeElement\) === true/);
  assert.match(source, /if \(focusWasInsideDeck\) window\.requestAnimationFrame\(\(\) => workspaceDeckToggleRef\.current\?\.focus\(\{ preventScroll: true \}\)\)/);
  assert.match(source, /Choose a starting point/);
  assert.match(css, /container: workspace-handoff \/ inline-size/);
  assert.doesNotMatch(css, /@container workspace-deck \(max-width: 520px\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) and \(min-width: 681px\) and \(max-width: 1100px\)/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\), \(max-width: 680px\)/);
  assert.match(css, /\.workspaceDeck\[data-open='true'\] \.workspaceShortcuts > \.workspaceShortcut:nth-child\(n\) \{ left: auto; \}/);
  assert.match(css, /\.workspaceShortcut:hover, \.workspaceShortcut:focus-visible \{ outline-offset: -3px; transform: none !important; \}/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]+\.workspaceShortcut \{ padding: 12px;/);
  assert.match(css, /@media \(max-width: 340px\)[\s\S]+\.workspaceShortcuts \{ grid-template-columns: 1fr; \}/);
});

test('journey, lifecycle, match evidence, and safety marks have polished state cues', () => {
  const source = read('components/landing/GuidedCareerLanding.tsx');
  const css = read('components/landing/GuidedCareerLanding.module.css');
  assert.match(source, /import \{ AnimatePresence, motion, useReducedMotion \} from 'framer-motion'/);
  assert.match(source, /<AnimatePresence mode="wait" initial=\{false\}>/);
  assert.match(source, /<motion\.div/);
  assert.match(source, /direction: JourneyDirection/);
  assert.match(source, /x: direction \* 10/);
  assert.match(source, /x: direction \* -8/);
  assert.match(source, /aria-label=\{`Show \$\{step\.title\}`\}.+selectJourney\(index, index >= activeJourney \? 1 : -1, false\)/);
  assert.match(source, /duration: prefersReducedMotion \? 0 : 0\.18/);
  assert.match(source, /<div className=\{styles\.matchStrength\}><span className=\{styles\.matchBadge\}>Strong match<\/span>/);
  assert.ok((source.match(/verified_user/g) || []).length >= 3);
  assert.match(source, /lifecycleExplorerRef/);
  assert.match(css, /animation: lifecycleExplorerShimmer \.9s/);
  assert.match(css, /@keyframes lifecycleExplorerShimmer/);
  assert.match(css, /\.toolExplorer\[open\] \.lifecycleRow \{ animation: lifecycleCardEnter 300ms/);
  assert.match(css, /\.toolExplorer\[open\] \.lifecycleRow:nth-child\(4\) \{ animation-delay: 135ms; \}/);
  assert.match(css, /\.toolExplorer \.lifecycleRow:hover \{[^}]*transform: translateY\(-5px\) scale\(1\.008\)/);
  assert.match(css, /@keyframes lifecycleCardEnter/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.toolExplorer\[open\] \.lifecycleRow \{ animation: none; \}/);
  assert.doesNotMatch(source, /LifecyclePreview|PULSE_DATA|LineChart/);
  assert.doesNotMatch(css, /\.toolExplorer \.productPreview/);
});

test('pricing and newsletter fail closed around authoritative public contracts', () => {
  const source = read('components/landing/GuidedCareerLanding.tsx');
  const newsletterRoute = read('app/api/newsletter/lead/route.ts');
  assert.match(source, /useBillingPrices/);
  assert.match(source, /prices\.checkout\.options\[plan\.billingPlan\]\[billingInterval\]/);
  assert.match(source, /View plan details/);
  assert.match(source, /sourcePath: window\.location\.pathname \|\| '\/'/);
  assert.match(source, /readStoredAttribution\(\)/);
  assert.match(newsletterRoute, /MAX_REQUEST_BYTES = 8_192/);
  assert.match(newsletterRoute, /MAX_EMAIL_LENGTH = 254/);
  assert.match(newsletterRoute, /checkRateLimit\(rateLimitKey, 5, 10 \* 60_000\)/);
  assert.match(newsletterRoute, /status: 429/);
  assert.match(newsletterRoute, /db\.runTransaction/);
  assert.match(newsletterRoute, /existing\.exists \? \{\} : \{ createdAt: now \}/);
  assert.match(newsletterRoute, /product: LEGACY_ASSISTANT_IDENTIFIERS\.careerPicksSource/);
  assert.match(newsletterRoute, /assistantBrand: 'taco'/);
});

test('landing brand and type-floor contracts use dedicated assets and readable sizes', () => {
  const source = read('components/landing/GuidedCareerLanding.tsx');
  const css = read('components/landing/GuidedCareerLanding.module.css');
  assert.match(source, /<TacoMark className=\{styles\.tacoMark\}/);
  assert.doesNotMatch(source, /TalentConsultingMark/);
  assert.match(source, /<TalentConsultingWordmark darkSurface/);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9](?:\.[0-9]+)?|1[01](?:\.[0-9]+)?)px/);
  assert.match(css, /\.billingToggle button \{[^}]*min-height: 44px/);
  assert.match(css, /\.motionPill \{[^}]*min-height: 44px/);
  assert.match(css, /\.workspaceDeckToggle \{[^}]*min-height: 44px/);
  assert.match(css, /\.workspaceDeckAction \{[^}]*min-height: 44px/);
  assert.match(css, /\.faqSection details p \{ position: static; width: auto;/);
  assert.match(css, /\.trustByDesign \{ height: auto;/);
});
