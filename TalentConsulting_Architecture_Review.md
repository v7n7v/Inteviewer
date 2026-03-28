# TalentConsulting.io — Senior Architecture Review
### Platform Overview, Feature Portfolio, Monetization & Build Roadmap
**Prepared:** March 17, 2026  
**Version:** 2.0  
**Live URL:** [talent-consulting-acf16.web.app](https://talent-consulting-acf16.web.app)

---

## 1. Executive Summary

TalentConsulting.io is an **AI-powered career intelligence platform** that transforms job seekers from passive applicants into strategic candidates. The platform combines resume optimization, interview preparation, market intelligence, and application tracking into a unified suite — all driven by a cost-efficient dual-AI pipeline (Gemini 3.0 Flash + GPT OSS 120B via Groq).

**Target Market:** All professionals — not limited to tech. The platform serves healthcare workers, finance professionals, educators, legal professionals, marketers, engineers, and any career domain.

**Core Value Proposition:**  
> *"We don't just dress up your resume. We make you the candidate it says you are."*

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router, SSR) | 14.2.35 |
| **Frontend** | React + TypeScript | 18.2 |
| **Styling** | Tailwind CSS + CSS Variables | 3.x |
| **Animations** | Framer Motion | 11.x |
| **Auth** | Firebase Authentication | 12.10 |
| **Database** | Cloud Firestore | (Firebase SDK) |
| **AI (Primary)** | Google Gemini 3.0 Flash | API |
| **AI (Secondary)** | GPT OSS 120B (open-source, via Groq) | API |
| **Voice (STT)** | Deepgram | API |
| **Voice (TTS)** | ElevenLabs | API |
| **Payments** | Stripe Embedded Checkout | 20.4 |
| **Hosting** | Firebase Hosting + Cloud Run (SSR) | GCP |
| **State Mgmt** | Zustand | Local |
| **Document Gen** | docx.js (DOCX export) | Client |

### AI Cost Advantage

| Model | Provider | Cost | Throughput |
|-------|----------|------|-----------|
| **Gemini 3.0 Flash** | Google | ~$0.00004/1K tokens | Ultra-fast, ideal for primary pass |
| **GPT OSS 120B** | Groq (open-source) | Free / near-zero | Open-weight model, no vendor lock-in |

> **Why this matters:** The dual-AI cross-validation pipeline — which would cost $0.05+ per morph on GPT-4o + Claude — costs effectively **< $0.001 per morph** with our stack. This makes running two full AI passes on every resume economically trivial, even at scale.

### Deployment Architecture

```
┌──────────────────────────────────────────────┐
│             Firebase Hosting (CDN)           │
│         Static assets + SPA routing          │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│         Cloud Run (SSR Function)             │
│   Next.js server-side rendering + API routes │
│   └── /api/resume/*   (AI resume ops)        │
│   └── /api/gauntlet/* (interview sim)        │
│   └── /api/chat       (Sona AI companion)    │
│   └── /api/voice/*    (STT/TTS)              │
│   └── /api/stripe/*   (payment processing)   │
│   └── /api/jobs/*     (job search proxy)     │
│   └── /api/oracle     (market intelligence)  │
│   └── /api/dashboard  (AI insights)          │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│            Cloud Firestore                   │
│   users/{uid}/                               │
│   ├── profile          (user data)           │
│   ├── resumes          (resume versions)     │
│   ├── applications     (job tracking)        │
│   ├── subscription/    (Stripe status)       │
│   └── usage/lifetime   (free tier counters)  │
└──────────────────────────────────────────────┘
```

---

## 3. Feature Portfolio

### 3.1 Liquid Resume — AI Resume Engine
**Route:** `/suite/resume`  
**API Routes:** `/api/resume/parse`, `/api/resume/morph`, `/api/resume/ai`, `/api/resume/auto-fix`, `/api/resume/check`, `/api/resume/cover-letter`, `/api/resume/linkedin`

| Capability | Description |
|-----------|-------------|
| **Resume Parsing** | Upload PDF/DOCX/TXT → structured JSON extraction via AI |
| **JD-Targeted Morphing** | AI rewrites resume to match specific job description — keyword injection, skill reordering, ATS optimization |
| **Build from Scratch** | Step-by-step AI-guided resume creation with summary generation, achievement bullets, skill suggestions |
| **Dual-AI Enhancement** | Cross-validates morphed resume with Gemini 3.0 Flash and GPT OSS 120B (Groq), resolves disagreements, shows consensus score |
| **ATS Score Check** | Grades resume for ATS compliance (keyword density, formatting, section completeness) |
| **Auto-Fix** | One-click AI repair of issues found in resume check |
| **Cover Letter Generator** | AI generates tailored cover letters with tone selection (professional/friendly/bold) |
| **LinkedIn Profile Generator** | Converts resume into optimized LinkedIn headline, summary, and experience bullets |
| **Resume Vault** | Stores multiple resume versions in Firestore, load/edit/delete any time |
| **18 Templates** | Executive, Harvard, Creative, Minimal, Elegant, Compact, Nordic, Technical, Modern, Cascade, Double-Column, Federal, plus premium templates |
| **Multi-format Export** | Download as DOCX with full template styling via docx.js |
| **Match Score** | Real-time JD match percentage with keyword gap analysis |
| **Morph Intensity Slider** | User controls how aggressively AI rewrites (25%–100%) |

---

### 3.2 The Gauntlet — AI Interview Simulator
**Route:** `/suite/flashcards`  
**API Routes:** `/api/gauntlet/generate`, `/api/gauntlet/grade`, `/api/gauntlet/parse-resume`

| Capability | Description |
|-----------|-------------|
| **AI Question Generation** | Generates role-specific interview questions from resume + JD context |
| **Structured Categories** | Behavioral, Technical, Situational, Culture Fit |
| **Voice Mode** | Real-time speech-to-text for verbal answers (Deepgram STT) + AI voice responses (ElevenLabs TTS) |
| **AI Grading** | Each answer graded on content, structure, relevance with specific feedback |
| **STAR Method Coaching** | AI teaches Situation-Task-Action-Result framework |
| **Session History** | Track practice sessions and improvement over time |
| **Flashcard Study Mode** | Quick-fire Q&A cards for rapid interview prep |

---

### 3.3 Market Oracle — Career Intelligence
**Route:** `/suite/market-oracle`  
**API Route:** `/api/oracle`

| Capability | Description |
|-----------|-------------|
| **JD Decoder** | Paste any job description → AI extracts hidden requirements, red flags, and culture signals |
| **Salary Intelligence** | AI estimates salary ranges based on role, location, and experience level |
| **Market Positioning** | Benchmarks user's profile against market demand |
| **Skill Gap Analysis** | Identifies missing skills compared to target roles |
| **Demand Trends** | Shows trending skills and hiring velocity in target domain |

---

### 3.4 Application Tracker
**Route:** `/suite/applications`  
**Database:** `users/{uid}/applications`

| Capability | Description |
|-----------|-------------|
| **Full Pipeline Tracking** | Applied → Phone Screen → Interview → Offer → Rejected/Accepted |
| **Company & Role Tagging** | Store company name, job title, location, URL, notes |
| **Follow-up Reminders** | Visual indicators for stale applications needing follow-up |
| **Status-based Analytics** | Dashboard cards showing conversion rates and pipeline health |
| **Bulk Management** | Add, edit, archive, delete applications |

---

### 3.5 Skill Bridge — Gap Closer (PRO)
**Route:** `/suite/skill-bridge`

| Capability | Description |
|-----------|-------------|
| **AI Skill Gap Detection** | Analyzes resume vs. morphed resume to identify AI-added skills the user actually lacks |
| **Learning Recommendations** | Suggests courses, certifications, and resources for each gap |
| **Progress Tracking** | Mark skills as learned/in-progress/planned |
| **Integration** | Feeds directly from Liquid Resume auto-fix results |

---

### 3.6 Job Search (Coming Soon)
**Route:** `/suite/job-search`  
**API Route:** `/api/jobs/search`

| Capability | Description |
|-----------|-------------|
| **Aggregated Search** | Proxied job search across multiple boards |
| **AI-Ranked Results** | Jobs ranked by match score against user's resume |
| **Quick Apply** | One-click morph + apply workflow |

---

### 3.7 Sona — AI Career Companion
**Component:** `AIAssistant.tsx`  
**API Route:** `/api/chat`

| Capability | Description |
|-----------|-------------|
| **Context-Aware Chat** | Sona reads user's applications, resumes, and profile from Firestore for personalized advice |
| **Streaming Responses** | Real-time SSE streaming from Gemini for natural conversation flow |
| **Career Coaching** | Interview prep tips, salary negotiation advice, follow-up strategies |
| **Mobile-Optimized** | Full-screen chat on mobile, floating panel on desktop |
| **Persistent FAB** | Always-available chat bubble with rotating hint prompts |

---

### 3.8 Dashboard — Command Center
**Route:** `/suite` (main page)  
**API Route:** `/api/dashboard/insights`

| Capability | Description |
|-----------|-------------|
| **AI Daily Briefing** | AI-generated insights based on application pipeline and market trends |
| **Quick Stats Cards** | Applications count, interviews scheduled, response rate, match score avg |
| **Animated Resume Preview** | Live morphing animation showing how resume adapts to different roles |
| **Quick Navigation** | Feature cards with direct links to all suite modules |
| **Sliding Tips** | Rotating career tips and feature highlights |

---

### 3.9 Landing Page & Marketing
**Route:** `/` (root)  
**Component:** `HeroSection.tsx` (1850+ lines)

| Element | Description |
|---------|-------------|
| **Animated Hero** | Gradient mesh backgrounds, particle effects, scroll-driven parallax |
| **Workflow Animation** | 4-step "How It Works" with live step-by-step panels |
| **TalentConstellation** | Orbiting skill nodes (cross-industry: Leadership, Finance, Healthcare, etc.) with density score |
| **Live AI Terminal** | Simulated terminal showing resume scanning in real-time |
| **Feature Carousel** | 5-panel interactive carousel with Liquid Resume, Gauntlet, Market Oracle previews |
| **Animated Motto** | Word-by-word stagger reveal with shimmering gradient punchline |
| **Testimonials** | Social proof section with user reviews |
| **Pricing Section** | Side-by-side Free vs Pro comparison |
| **Dark/Light Theme** | Animated toggle with sun/moon morphing, instant theme switch |
| **SEO Optimized** | Meta tags, semantic HTML, structured headings |

---

## 4. Monetization Model

### 4.1 Pricing Structure

| Plan | Monthly | Annual | Effective Monthly |
|------|---------|--------|-------------------|
| **Free** | $0 | $0 | $0 |
| **Pro** | $2.99 | $24.99 | $2.08 (30% savings) |

### 4.2 Payment Integration
- **Processor:** Stripe (Embedded Checkout)
- **Routes:** `/api/stripe/checkout`, `/api/stripe/subscribe`, `/api/stripe/portal`, `/api/stripe/webhook`
- **Subscription Management:** Stripe Customer Portal for self-service cancellation/plan changes
- **Webhook Events:** Handles `checkout.session.completed`, `customer.subscription.updated/deleted`
- **Firestore Sync:** Subscription status stored at `users/{uid}/subscription/current`

### 4.3 Free Tier Caps (Lifetime)

| Feature | Free | Pro |
|---------|------|-----|
| Resume Morphs | 3 | Unlimited |
| Gauntlet Sessions | 3 | Unlimited |
| Flashcard Decks | 2 | Unlimited |
| JD Generations | 3 | Unlimited |
| Cover Letters | 2 | Unlimited |
| Resume Checks | 3 | Unlimited |
| LinkedIn Profiles | 2 | Unlimited |

### 4.4 Rate Limits (Requests/Minute)

| Route | Free | Pro |
|-------|------|-----|
| Resume Morph | 1 | 3 |
| Resume Parse/AI | 5 | 15 |
| Gauntlet Generate/Grade | 7 | 21 |
| Voice Transcribe/Speak | 5 | 15 |
| Chat (Sona) | 10 | 30 |
| Job Search | 10 | 30 |
| Dashboard Insights | 5 | 15 |

### 4.5 Unit Economics

| Metric | Value |
|--------|-------|
| **AI cost per morph** | ~$0.001 (Gemini Flash + Groq OSS) |
| **AI cost per GPT-4o morph (avoided)** | ~$0.05 |
| **Cost savings vs premium AI** | **98% reduction** |
| **Break-even subscribers** | ~5 Pro users covers Firestore + hosting |
| **Gross margin at 100 Pro users** | ~95% ($299/mo revenue, ~$15/mo infra) |

### 4.6 Revenue Projections

| Metric | Conservative | Target | Optimistic |
|--------|-------------|--------|-----------|
| Monthly Users | 1,000 | 5,000 | 20,000 |
| Conversion Rate | 3% | 5% | 8% |
| Pro Subscribers | 30 | 250 | 1,600 |
| Monthly Revenue | $90 | $748 | $4,784 |
| Annual Revenue | $1,080 | $8,970 | $57,408 |

---

## 5. System Architecture Patterns

### 5.1 Authentication Flow
```
User → Firebase Auth (Email/Password + Google OAuth)
  └── JWT Token → Next.js Middleware validates on every /suite/* route
       └── authFetch() wrapper injects Authorization header on all API calls
            └── API routes extract UID from token → Firestore user doc
```

### 5.2 Dual-AI Pipeline (Resume Morph)
```
User submits Resume + JD
  ├── [Pass 1] Gemini 3.0 Flash → Morphed Resume v1
  ├── [Pass 2] GPT OSS 120B (Groq) → Morphed Resume v2
  └── [Cross-validation] Compare v1 & v2
       ├── Agreement ≥ 80% → Merge best elements
       └── Disagreement → AI mediator resolves conflicts
            └── Final output with consensus score
```

**Why dual open-source/low-cost AI?**
- **No vendor lock-in** — GPT OSS 120B is open-weight; can self-host later
- **Near-zero marginal cost** — Groq offers free/near-free inference
- **Gemini 3.0 Flash** — Google's cheapest model, optimized for speed
- **Quality through diversity** — two different model architectures catch different errors
- **Economically enables the dual-pass** — wouldn't be viable at $0.05/call with premium models

### 5.3 Usage Enforcement
```
API Request → Middleware
  ├── getUserTier(uid, email) → 'free' | 'pro'
  ├── checkUsageAllowed(uid, feature, tier)
  │    ├── Pro → Always allowed (unlimited)
  │    └── Free → Check Firestore usage/lifetime counters vs FREE_CAPS
  └── On success → incrementUsage(uid, feature)
```

### 5.4 State Management
- **Server State:** Firestore (user data, applications, resumes, subscriptions, usage)
- **Client State:** Zustand store (user session, UI state)
- **Theme State:** React Context (`ThemeProvider`) with localStorage persistence
- **Form State:** React `useState` per page component

---

## 6. Security Profile

| Domain | Implementation |
|--------|---------------|
| **Auth** | Firebase Auth JWT tokens validated server-side on every API route |
| **API Protection** | `authFetch()` wrapper enforces auth headers; all `/api/*` routes check `Authorization: Bearer <token>` |
| **Rate Limiting** | Per-route, per-tier rate limits enforced server-side |
| **Payment Security** | Stripe handles all card data (PCI-DSS compliant); webhook signature verification |
| **Master Accounts** | `MASTER_EMAILS` array for admin bypass (development/testing only) |
| **Environment Secrets** | `.env.local` for all API keys; never exposed client-side except `NEXT_PUBLIC_*` prefixed |
| **CORS** | Next.js API routes are same-origin by default |

---

## 7. Build Roadmap

### Phase 1 — Foundation ✅ (Complete)
- [x] Next.js 14 App Router setup with Firebase Auth
- [x] Firestore database schema (users, resumes, applications)
- [x] Landing page with premium animations and dark/light theme
- [x] Authentication flow (email/password + Google OAuth)
- [x] Suite layout with collapsible sidebar
- [x] Zustand global state management

### Phase 2 — Core AI Features ✅ (Complete)
- [x] Resume parser (PDF/DOCX → structured JSON)
- [x] AI resume morphing with JD matching
- [x] 18 resume templates with DOCX export
- [x] ATS score checking and auto-fix
- [x] Cover letter generator (3 tones)
- [x] LinkedIn profile generator
- [x] Dual-AI cross-validation pipeline (Gemini Flash + Groq OSS)
- [x] Application tracker with full pipeline

### Phase 3 — Interview & Intelligence ✅ (Complete)
- [x] The Gauntlet interview simulator
- [x] AI question generation from resume + JD
- [x] Voice mode (Google Cloud STT/TTS)
- [x] AI grading with STAR method coaching
- [x] Market Oracle (JD decoder, salary intel, gap analysis)
- [x] Dashboard with AI daily briefing

### Phase 4 — Monetization & Polish ✅ (Complete)
- [x] Stripe integration (Embedded Checkout, Customer Portal, Webhooks)
- [x] Free/Pro tier system with lifetime usage caps
- [x] Rate limiting per route per tier
- [x] Upgrade page with plan comparison
- [x] Sona AI companion (context-aware, streaming)
- [x] Mobile optimization (sidebar, chat, responsive layouts)
- [x] Dark/Light theme with animated toggle
- [x] Animated motto section (selling point)
- [x] Firebase Hosting + Cloud Run deployment

### Phase 5 — Growth & Scale (Planned)
- [ ] **Job Search Aggregation** — Proxied multi-board search with AI ranking
- [ ] **Skill Bridge Expansion** — Curated learning paths with progress tracking
- [ ] **Email Notifications** — Follow-up reminders, application status updates
- [ ] **Team/Enterprise Tier** — Bulk resume processing, team analytics
- [ ] **Chrome Extension** — One-click morph from job listing pages
- [ ] **Analytics Dashboard** — Conversion funnels, feature usage heatmaps
- [ ] **A/B Testing Framework** — Optimize pricing, CTAs, landing page
- [ ] **Referral Program** — Invite-based growth with free Pro credits
- [ ] **Multi-language Support** — Resume morphing in 10+ languages
- [ ] **Mobile App (PWA)** — Installable progressive web app
- [ ] **API Access** — Developer tier for B2B resume processing

### Phase 6 — Enterprise & B2B (Future)
- [ ] **University Partnerships** — Career center white-label integration
- [ ] **Recruiter Dashboard** — Candidate pipeline management tools
- [ ] **Bulk Processing API** — Enterprise resume standardization
- [ ] **Custom AI Training** — Company-specific interview question banks
- [ ] **SOC 2 Compliance** — Enterprise security certification
- [ ] **SSO Integration** — SAML/OAuth for enterprise customers

---

## 8. File Structure Overview

```
talentconsulting-io/
├── app/
│   ├── page.tsx                    # Landing page (root)
│   ├── globals.css                 # Global styles + theme variables
│   ├── suite/
│   │   ├── page.tsx                # Dashboard
│   │   ├── layout.tsx              # Suite layout with sidebar
│   │   ├── resume/page.tsx         # Liquid Resume (3300+ LOC)
│   │   ├── applications/page.tsx   # Application Tracker
│   │   ├── flashcards/page.tsx     # The Gauntlet
│   │   ├── market-oracle/page.tsx  # Market Oracle
│   │   ├── skill-bridge/page.tsx   # Skill Bridge (PRO)
│   │   ├── job-search/page.tsx     # Job Search (Soon)
│   │   ├── settings/page.tsx       # User Settings
│   │   ├── upgrade/page.tsx        # Upgrade to Pro
│   │   └── help/page.tsx           # Help & FAQ
│   └── api/
│       ├── resume/                 # 7 resume endpoints
│       ├── gauntlet/               # 3 interview endpoints
│       ├── voice/                  # 2 voice endpoints
│       ├── stripe/                 # 4 payment endpoints
│       ├── chat/                   # Sona AI endpoint
│       ├── jobs/                   # Job search proxy
│       ├── oracle/                 # Market intelligence
│       ├── dashboard/              # AI insights
│       ├── ai/                     # General AI endpoint
│       └── usage/                  # Usage tracking
├── components/
│   ├── HeroSection.tsx             # Landing page (1850+ LOC)
│   ├── SuiteSidebar.tsx            # Navigation sidebar
│   ├── AIAssistant.tsx             # Sona chat companion
│   ├── ThemeProvider.tsx           # Dark/light theme context
│   ├── ThemeToggle.tsx             # Animated sun/moon toggle
│   ├── SlidingTips.tsx             # Rotating tip cards
│   ├── UpgradeModal.tsx            # Upgrade prompt modal
│   └── modals/                     # Shared modal components
├── lib/
│   ├── firebase.ts                 # Firebase client init
│   ├── auth-fetch.ts               # Authenticated fetch wrapper
│   ├── store.ts                    # Zustand global store
│   ├── database-suite.ts           # Firestore CRUD operations
│   ├── pricing-tiers.ts            # Tier config + rate limits
│   └── usage-tracker.ts            # Free tier cap enforcement
├── hooks/
│   └── use-user-tier.ts            # Client-side tier awareness
├── middleware.ts                    # Auth + route protection
├── firebase.json                   # Hosting + functions config
├── firestore.rules                 # Security rules
└── .env.local                      # API keys (not committed)
```

---

## 9. Key Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **Next.js 14 (not 15)** | Stability; v15 has breaking async params changes |
| **Client-side DOCX generation** | Avoids server-side document processing load; docx.js runs in browser |
| **Dual-AI: Gemini Flash + Groq OSS** | Cross-validation between two different model architectures reduces hallucination while keeping inference costs near-zero (~$0.001/morph vs $0.05+ with premium models). Open-source GPT OSS 120B eliminates vendor lock-in and can be self-hosted later. This cost structure makes dual-pass economically viable at any scale. |
| **Lifetime caps (not monthly)** | Simpler to enforce; avoids timezone/billing-cycle complexity |
| **Embedded Stripe Checkout** | User stays on-site; better conversion than redirect-based checkout |
| **Firebase Hosting + Cloud Run** | SSR support via Cloud Run functions; zero-config scaling |
| **Zustand over Redux** | Lighter, simpler API for the scope of client state needed |
| **CSS Variables for theming** | Enables runtime theme switching without CSS-in-JS overhead |
| **Groq for inference** | Sub-100ms latency on open-source models; faster than OpenAI API for the same quality tier |

---

## 10. Open Questions for Review

1. **Dual-AI at extreme scale**: The Gemini Flash + Groq OSS stack costs ~$0.001/morph. Even at 100k morphs/month, AI cost is ~$100. Should we still optimize with conditional second-pass, or does the cost structure make that premature optimization?

2. **Database migration path**: Currently Firestore-only. As data complexity grows (analytics, team features), should we plan a Supabase/PostgreSQL migration for relational queries?

3. **CDN + Edge caching**: Landing page is fully SSR'd. Should we move it to static generation (`generateStaticParams`) for faster global TTFB?

4. **Rate limit enforcement**: Currently in-memory per instance. For multi-instance Cloud Run, should we move to Redis-based distributed rate limiting?

5. **Testing gap**: No automated test suite exists. Priority should be E2E tests for payment flow and resume morph pipeline. Recommendation: Playwright + Vitest.

6. **Bundle size**: The resume page is 240 KB first-load. Should we code-split the template renderer and DOCX export into dynamic imports?

---

*Document generated for senior architecture review. For live demo, visit [talent-consulting-acf16.web.app](https://talent-consulting-acf16.web.app).*
