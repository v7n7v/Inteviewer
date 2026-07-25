const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

function walk(relativeDirectory) {
  const directory = path.join(repoRoot, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return walk(relative);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

test('Taco has one canonical identity, acronym, and trust foundation', () => {
  const brand = read('lib/assistant/brand.ts');
  const personality = read('lib/assistant/personality.ts');
  assert.match(brand, /displayName: 'Taco'/);
  assert.match(brand, /formalName: 'TACO'/);
  assert.match(brand, /TA \+ CO/);
  assert.match(personality, /Never fabricate employers/);
  assert.match(personality, /explicit user approval/);
  assert.doesNotMatch(`${brand}\n${personality}`, /gold\/golden|Sanskrit|happy\/fortunate|most important person/i);
});

test('customer source has no former display name, feature title, or asset reference', () => {
  const files = ['app', 'components', 'hooks'].flatMap(walk);
  const source = files.map(file => `${file}\n${read(file)}`).join('\n');
  assert.doesNotMatch(source, /\b(?:Sona|SONA)\b/);
  assert.doesNotMatch(source, /Taco Picks|Taco Live Room|Taco Agent/);
  assert.doesNotMatch(source, /sona-(?:icon|avatar)/i);
  assert.match(source, /Ask Taco/);
  assert.match(source, /Career Picks by Taco/);
  assert.match(source, /Live Interview with Taco/);
});

test('new browser contracts retain bounded legacy fallbacks', () => {
  const compatibility = read('lib/assistant/browser-compatibility.ts');
  const orb = read('components/SonaFloatingOrb.tsx');
  assert.match(compatibility, /ASSISTANT_OPEN_EVENT = 'assistant:open'/);
  assert.match(compatibility, /LEGACY_ASSISTANT_OPEN_EVENT = 'sona:open'/);
  assert.match(compatibility, /personality: 'taco-personality'/);
  assert.match(compatibility, /legacyPersonality: 'sona-personality'/);
  assert.match(orb, /addEventListener\(ASSISTANT_OPEN_EVENT/);
  assert.match(orb, /addEventListener\(LEGACY_ASSISTANT_OPEN_EVENT/);
});

test('legacy server modules are compatibility exports to canonical assistant modules', () => {
  const legacyFiles = fs.readdirSync(path.join(repoRoot, 'lib', 'sona')).filter(file => file.endsWith('.ts'));
  assert.ok(legacyFiles.length >= 30);
  for (const file of legacyFiles) {
    const source = read(path.join('lib', 'sona', file));
    assert.match(source, /@deprecated Import from @\/lib\/assistant\//);
    assert.match(source, /export \* from '@\/lib\/assistant\//);
  }
  assert.match(read('lib/sona-tools.ts'), /@\/lib\/assistant\/tools/);
  assert.match(read('lib/sona-context.ts'), /@\/lib\/assistant\/context/);
  assert.match(read('lib/ai/sona-toolkit.ts'), /@\/lib\/assistant\/toolkit/);
});

test('Taco visual route, asset, and legacy redirect are wired', () => {
  const brandLogo = read('components/BrandLogo.tsx');
  assert.match(brandLogo, /TACO_MARK = '\/taco-icon-512\.png'/);
  assert.match(brandLogo, /function TacoMark/);
  assert.match(brandLogo, /alt = 'Taco AI assistant'/);
  assert.match(read('components/sona/SonaMark.tsx'), /src=\{TACO_MARK\}/);
  assert.match(read('components/assistant/AssistantMarkMotion.tsx'), /<AssistantMark/);
  assert.match(read('public/brand/taco-mark.svg'), /canonical blue A from the TalentConsulting company mark/);
  assert.doesNotMatch(read('public/brand/taco-mark.svg'), /literal T from Talent and C|TC monogram/i);
  assert.match(read('scripts/render-taco-brand.js'), /talentconsulting-mark-512\.png/);
  assert.match(read('scripts/render-taco-brand.js'), /talentconsulting-logo-dark-surface\.png/);
  assert.match(read('app/suite/gallery/taco/page.tsx'), /TacoMotionLab/);
  assert.match(read('app/suite/gallery/sona/page.tsx'), /permanentRedirect\('\/suite\/gallery\/taco'\)/);
  const canonicalAssets = [
    'public/taco-icon.png',
    'public/taco-icon-192.png',
    'public/taco-icon-512.png',
    'public/taco-icon-1024.png',
    'public/taco-avatar.png',
    'public/brand/taco-mark.svg',
    'public/brand/taco-mark-white.svg',
    'public/brand/taco-mark-monochrome.svg',
    'public/brand/taco-wordmark.svg',
    'public/brand/taco-wordmark-white.svg',
    'public/brand/talentconsulting-logo-dark-surface.png',
    ...[16, 24, 32, 48, 64, 192, 512, 1024].map(size => `public/brand/taco-mark-${size}.png`),
  ];
  for (const asset of canonicalAssets) {
    assert.ok(fs.statSync(path.join(repoRoot, asset)).size > 0, `${asset} must be non-empty`);
  }
});

test('canonical Taco raster preserves a visible blue A on transparency', async () => {
  const { data, info } = await sharp(path.join(repoRoot, 'public', 'taco-icon.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let visiblePixels = 0;
  let bluePixels = 0;
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    const alpha = data[offset + 3];
    if (alpha < 12) transparentPixels += 1;
    if (alpha > 180) {
      visiblePixels += 1;
      if (data[offset + 2] > data[offset] * 1.4 && data[offset + 2] > data[offset + 1] * 1.2) bluePixels += 1;
    }
  }
  assert.ok(transparentPixels > info.width * info.height * 0.25, 'Taco mark must retain a transparent field');
  assert.ok(visiblePixels > info.width * info.height * 0.05, 'Taco A must remain visible');
  assert.ok(bluePixels > visiblePixels * 0.7, 'Taco A must retain its blue brand color');
});

test('dark-surface wordmark preserves every intentional blue accent', async () => {
  const wordmarkPath = path.join(repoRoot, 'public', 'brand', 'talentconsulting-logo-dark-surface.png');
  const { data, info } = await sharp(wordmarkPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bluePixelsByRegion = { a: 0, n: 0, io: 0 };

  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    const x = index % info.width;
    const alpha = data[offset + 3];
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const isBlueAccent = alpha > 48 && blue > 130 && blue > red * 1.3 && blue > green * 1.15;
    if (!isBlueAccent) continue;
    if (x >= 70 && x <= 205) bluePixelsByRegion.a += 1;
    if (x >= 325 && x <= 390) bluePixelsByRegion.n += 1;
    if (x >= 1090 && x <= 1160) bluePixelsByRegion.io += 1;
  }

  assert.ok(bluePixelsByRegion.a > 3_500, 'dark wordmark must retain the blue A');
  assert.ok(bluePixelsByRegion.n > 650, 'dark wordmark must retain the blue cut-in on the n');
  assert.ok(bluePixelsByRegion.io > 100, 'dark wordmark must retain the blue .io accent');
});

test('signing and analytics preserve historical continuity with Taco precedence', () => {
  const compatibility = read('lib/assistant/compatibility.ts');
  const receipt = read('lib/assistant/activation-receipt.ts');
  const analytics = read('lib/analytics.ts');
  assert.match(compatibility, /env\.TACO_PREFLIGHT_SECRET \|\| env\.SONA_PREFLIGHT_SECRET/);
  assert.match(receipt, /sona-preflight-receipt:v1/);
  assert.match(analytics, /ASSISTANT_ANALYTICS_CONTEXT/);
  assert.match(analytics, /event\.startsWith\('sona_'\)/);
});
