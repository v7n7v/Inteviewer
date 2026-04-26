---
name: Talent Studio
version: 1.0.0
framework: Next.js 15 (App Router)
styling: Tailwind CSS + CSS Custom Properties
theme: dual (light / dark)
font:
  family: Inter
  weights: [400, 500, 600, 700, 900]
  source: next/font/google
icon:
  family: Material Symbols Rounded
  fill: 0
  weight: 300
  optical-size: 24
---

# Talent Studio — Design System

> "Functional Elegance" — Inspired by Google AI Studio.
> Every surface is intentional. Every color has a purpose.

## 1. Color Tokens

### Dark Mode (default)

| Token              | Value                         | Usage                              |
|--------------------|-------------------------------|-------------------------------------|
| `--bg-deep`        | `#0b0b0b`                     | Page background                    |
| `--bg-surface`     | `#131314`                     | Card / section background          |
| `--bg-elevated`    | `#1a1a1b`                     | Elevated surfaces (modals, inputs) |
| `--bg-input`       | `#1e1e1f`                     | Input field bg                     |
| `--bg-hover`       | `#1f1f21`                     | Hover state bg                     |
| `--border`         | `#444746`                     | Primary border                     |
| `--border-subtle`  | `#2d2d2f`                     | Default card border                |
| `--text-primary`   | `#f1f1f1`                     | Headings, body text                |
| `--text-secondary` | `#9ca0a0`                     | Labels, descriptions               |
| `--text-muted`     | `#5f6368`                     | Tertiary/disabled text             |
| `--accent`         | `#a8c7fa`                     | Links, active elements             |
| `--card-bg`        | `#1a1a1b`                     | Card background (opaque)           |

### Light Mode

| Token              | Value                         | Usage                              |
|--------------------|-------------------------------|-------------------------------------|
| `--bg-deep`        | `#ffffff`                     | Page background                    |
| `--bg-surface`     | `#f8f9fa`                     | Card / section background          |
| `--bg-elevated`    | `#f1f3f4`                     | Elevated surfaces                  |
| `--bg-hover`       | `#e8eaed`                     | Hover state bg                     |
| `--border`         | `#dadce0`                     | Primary border                     |
| `--border-subtle`  | `#e8eaed`                     | Default card border                |
| `--text-primary`   | `#111111`                     | Headings, body text                |
| `--text-secondary` | `#444746`                     | Labels, descriptions               |
| `--text-muted`     | `#9aa0a6`                     | Tertiary/disabled text             |
| `--accent`         | `#1a73e8`                     | Links, active elements             |
| `--card-bg`        | `#ffffff`                     | Card background                    |

### Semantic Tags (used across both modes)

| Tag        | Dark bg/text                       | Light bg/text                        |
|------------|-------------------------------------|--------------------------------------|
| Amber      | `rgba(253,214,99,0.15)` / `#fdd663` | `rgba(249,171,0,0.12)` / `#e37400`  |
| Blue       | `rgba(168,199,250,0.15)` / `#a8c7fa`| `rgba(26,115,232,0.12)` / `#1a73e8` |
| Purple     | `rgba(210,168,255,0.15)` / `#d2a8ff`| `rgba(161,66,244,0.12)` / `#9334e6` |
| Green      | `rgba(129,201,149,0.15)` / `#81c995`| `rgba(24,128,56,0.12)` / `#188038`  |
| Rose       | `rgba(242,139,130,0.15)` / `#f28b82`| `rgba(217,48,37,0.12)` / `#d93025` |

---

## 2. Typography

| Role       | Classes                                    | Size    | Weight |
|------------|--------------------------------------------|---------|--------|
| Page Title | `text-2xl lg:text-3xl font-bold`           | 24–30px | 700    |
| Section    | `text-lg font-semibold`                    | 18px    | 600    |
| Body       | `text-sm`                                  | 14px    | 400    |
| Label      | `text-xs font-medium`                      | 12px    | 500    |
| Caption    | `text-[10px]`                              | 10px    | 400    |
| Stat Value | `text-3xl font-black tabular-nums`         | 30px    | 900    |

> **Always use `var(--text-primary)` for headings and `var(--text-secondary)` for body labels.**
> **Never hardcode `text-white` or `text-silver` in components — they break in light mode.**

---

## 3. Spacing

| Scale  | Value  | Usage                          |
|--------|--------|--------------------------------|
| xs     | 4px    | Icon gap, micro padding        |
| sm     | 8px    | Inner card padding, badge gap  |
| md     | 16px   | Section spacing                |
| lg     | 24px   | Card padding                   |
| xl     | 32px   | Page section gaps              |
| 2xl    | 48px   | Hero/header vertical spacing   |

---

## 4. Components

### Card (`.glass-card`)

```
background: var(--card-bg)
border: 1px solid var(--border-subtle)
border-radius: 12px
hover: border-color → var(--border)
```

- **Cards are OPAQUE.** Dark = `#1a1a1b`, Light = `#ffffff`.
- No backdrop-filter, no box-shadow, no gradient fills.
- **Never use `background: transparent` on cards** — it causes content bleed-through.
- Never apply `bg-white`, `bg-black`, or colored fills directly — use `var(--card-bg)`.

### Button (Primary)

```
background: linear-gradient(135deg, accent1, accent2)
border-radius: 12px (rounded-xl)
padding: 10px 20px
font: 14px / font-bold
color: white
```

### Status Badge

```
display: inline-flex
align-items: center
gap: 6px
padding: 4px 12px
border-radius: 8px (rounded-lg)
font-size: 12px / font-medium
border: 1px solid ${status.border}
background: ${status.bg}   (always 10-20% opacity tint)
color: ${status.text}
```

### Input

```
background: var(--bg-surface) | var(--bg-elevated)
border: 1px solid var(--border-subtle)
border-radius: 12px (rounded-xl)
padding: 10px 16px
font-size: 14px
color: var(--text-primary)
placeholder: var(--text-tertiary)
focus: border-color → accent/50, ring → accent/20
```

### Stat Card

```
border: 1px solid var(--border-subtle)
background: var(--bg-surface)
border-radius: 16px (rounded-2xl)
padding: 20px
icon: 24px in tinted 48px rounded-xl container
value: text-3xl font-black
label: text-xs text-[var(--text-secondary)]
```

---

## 5. Layout Rules

### Page Header Pattern

Every tool page follows this consistent header:

```
┌─────────────────────────────────────────────────────────┐
│  [Icon]  Title                          [Actions] [?]   │
│          Description                                    │
└─────────────────────────────────────────────────────────┘
```

- Container: `flex items-start justify-between`
- Left: Icon (rounded-2xl, gradient/tinted) + Title (`text-2xl font-bold`) + Subtitle
- Right: Action buttons + `<PageHelp>` **always last (far-right)**
- Background: `glass-card` with subtle gradient blurs

### Sidebar

- Width: `w-[200px]` collapsed `w-0`
- Background: `var(--sidebar-bg)`
- Items grouped: BUILD, SEARCH & APPLY, PREPARE, GROW
- Active item: `var(--sidebar-active)` bg + `var(--sidebar-text-active)` text
- Gap between items: `gap-0.5` (2px)

### Shared Components

| Component             | Location                           | Usage                              |
|-----------------------|------------------------------------|------------------------------------|
| `ResumeLibraryPicker` | `components/ResumeLibraryPicker.tsx`| Resume selection across all tools |
| `PageHelp`            | `components/PageHelp.tsx`          | Help tooltip on every page header |
| `Toast`               | `components/Toast.tsx`             | Success/error notifications       |

---

## 6. Do's and Don'ts

### ✅ DO

- Use `var(--text-primary)` for all heading text
- Use `var(--text-secondary)` for all label/description text
- Use `var(--text-muted)` or `var(--text-tertiary)` for tertiary info
- Use `var(--bg-surface)` for card backgrounds
- Use `var(--bg-hover)` for hover states
- Use `var(--bg-elevated)` for raised surfaces
- Place `<PageHelp>` as the **last element** in every header flex row
- Add `outline-none focus:outline-none` to clickable card containers
- Use `pointer-events-none` on decorative icons inside inputs

### ❌ DON'T

- Don't hardcode `text-white` or `text-silver` — breaks in light mode
- Don't use `bg-white/5` or `bg-white/10` — invisible in light mode
- Don't use `hover:bg-white/10` — use `hover:bg-[var(--bg-hover)]`
- Don't use raw `bg-black` or `bg-white` on surfaces
- Don't nest cards inside cards
- Don't use purple/violet as primary accent (brand is emerald green on landing)
- Don't fabricate certifications, credentials, or achievements in AI outputs
- Don't mix `glass-card` with inline `background` styles
- Don't place `<PageHelp>` anywhere other than far-right in the header

---

## 7. Accessibility

- Minimum contrast ratio: **4.5:1** (WCAG AA)
- All interactive elements: keyboard accessible with visible focus indicator
- Icons: always paired with text labels (or `aria-label`)
- Status colors: always paired with icon + text label (not color-alone)
- Motion: `prefers-reduced-motion` respected via Framer Motion
- Theme: respects `prefers-color-scheme` with manual override via `data-theme`

---

## 8. AI Guardrails

> **Anti-Fabrication Policy:** AI-generated content must never invent certifications, degrees, work experience, skills, or achievements that don't exist in the user's actual resume data. The system uses tool-assisted fetching from Firestore to populate context — not hallucination.

---

## 9. Motion

| Effect           | Library         | Duration   | Easing       |
|------------------|-----------------|------------|--------------|
| Page entry       | Framer Motion   | 300ms      | ease-out     |
| Card stagger     | Framer Motion   | 50ms delay | spring       |
| Button press     | `whileTap`      | instant    | scale(0.97)  |
| Hover lift       | `whileHover`    | 150ms      | y: -2px      |
| Dropdown         | AnimatePresence | 200ms      | ease-in-out  |
| Progress bar     | Framer Motion   | 1000ms     | ease-out     |
