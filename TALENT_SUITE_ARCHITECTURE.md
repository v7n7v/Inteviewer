# 🚀 Hirely.ai Talent Intelligence Suite - Architecture

## Vision
Transform Hirely.ai from an interview platform into a complete end-to-end Talent Intelligence Suite with AI-powered tools for both candidates and employers.

---

## 🎯 Core Modules

### 1. **Liquid Resume Architect** (Resume Builder)
**The Problem:** Static PDFs that don't adapt to roles  
**The Solution:** Reactive, JD-morphing resumes

**Features:**
- JD-Morphing: AI re-prioritizes bullets based on target JD
- Skill-Graph Export: Interactive SVG skill maps
- Context Toggle: Switch between "Technical" and "Leadership" modes
- Multiple versions saved per JD

**Aesthetic:** Ghost Paper effect (frosted white glass)

### 2. **Persona-JD Engine** (Job Description Generator)
**The Problem:** Boring, biased JDs  
**The Solution:** Mission Blueprints with AI enhancement

**Features:**
- Success Prediction: First 90 days roadmap
- Culture Pulse section
- Bias-Neutralizer: Real-time language flagging
- Talent Density Score: Rarity meter (Green to Violet)

**Aesthetic:** Typewriter Flux animation

### 3. **Shadow Interviewer** (Mock Simulator)
**The Problem:** No practice partners  
**The Solution:** 24/7 AI interview coach

**Features:**
- Voice-enabled AI personas (Skeptical Lead, Visionary CEO)
- Personalized questions from user's resume
- Stress Testing: Strategic interruptions
- Voice pitch/volume analysis

**Aesthetic:** Neural Sphere that reacts to voice

### 4. **Market Oracle** (Salary & Career Intelligence)
**The Problem:** Unknown market value  
**The Solution:** Data-driven career predictor

**Features:**
- Market Value Heatmap
- Salary predictions
- Next Logical Skill recommendations
- Opportunity Radar: 3D job starfield

**Aesthetic:** WebGL starfield visualization

### 5. **Interview Co-Pilot** (Existing Feature - Enhanced)
**Status:** Already implemented in Phase 1
**Enhancements:** Integrate with Shadow Interviewer data

---

## 🎨 Design System Enhancements

### Command Bar (Global Navigation)
**Position:** Bottom-docked  
**Style:** Frosted glass with blur(40px)  
**Behavior:** Quick-switch between all modules  
**Shortcuts:** Cmd+K to open command palette

### Visual Language
- **Background:** #020202 (deeper obsidian)
- **Blur:** backdrop-filter: blur(40px) (increased from 20px)
- **Accents:** 
  - Cyber Cyan: #00f5ff (primary)
  - Neon Violet: #bf00ff (secondary)
  - Deep Red: #ff0055 (stress/danger)
  - Neon Green: #00ff88 (success/common)

### Animations
- **Framer Motion:** Layout morphing for expanding sections
- **React Spring:** Smooth value transitions
- **React Three Fiber:** 3D visualizations (Neural Sphere, Starfield)

---

## 🗄️ Database Schema Extensions

### New Tables

```sql
-- Resume versions
CREATE TABLE resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  jd_id UUID REFERENCES job_descriptions(id),
  version_name TEXT,
  content JSONB, -- Full resume data
  skill_graph JSONB, -- SVG data
  mode TEXT DEFAULT 'technical', -- 'technical' or 'leadership'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job descriptions
CREATE TABLE job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  content TEXT,
  talent_density_score FLOAT, -- 0-10 scale
  first_90_days JSONB,
  culture_pulse JSONB,
  bias_flags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock interview sessions
CREATE TABLE mock_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  persona TEXT, -- 'skeptical_lead', 'visionary_ceo', etc.
  transcript TEXT,
  stress_level INT DEFAULT 0,
  voice_analysis JSONB,
  performance_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market intelligence cache
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_set VECTOR(384), -- pgvector for similarity search
  job_title TEXT,
  salary_range JSONB,
  location TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- User skills and preferences
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  skills JSONB,
  experience_years INT,
  target_salary_min INT,
  target_salary_max INT,
  preferred_locations TEXT[],
  skill_vector VECTOR(384), -- For similarity matching
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📐 Component Architecture

```
app/
├── (suite)/
│   ├── layout.tsx          # Suite wrapper with Command Bar
│   ├── resume/
│   │   ├── page.tsx        # Liquid Resume main
│   │   └── components/
│   │       ├── ResumeCanvas.tsx
│   │       ├── ContextToggle.tsx
│   │       └── SkillGraph.tsx
│   ├── jd-generator/
│   │   ├── page.tsx        # Persona-JD Engine
│   │   └── components/
│   │       ├── TalentDensityGauge.tsx
│   │       ├── BiasDetector.tsx
│   │       └── TypewriterText.tsx
│   ├── shadow-interview/
│   │   ├── page.tsx        # Mock Simulator
│   │   └── components/
│   │       ├── NeuralSphere.tsx
│   │       ├── VoiceRecorder.tsx
│   │       └── StressVisualizer.tsx
│   └── market-oracle/
│       ├── page.tsx        # Career Intelligence
│       └── components/
│           ├── SalaryHeatmap.tsx
│           ├── OpportunityRadar.tsx
│           └── SkillRecommendations.tsx
│
├── interview/              # Existing interview features
│   └── [existing structure]
│
components/
├── command-bar/
│   ├── CommandBar.tsx      # Global navigation
│   ├── CommandPalette.tsx  # Cmd+K search
│   └── QuickSwitcher.tsx
│
├── shared/
│   ├── GhostPaper.tsx      # Resume paper effect
│   ├── NeonGauge.tsx       # Talent Density meter
│   └── StressIndicator.tsx # Red mesh overlay
│
lib/
├── ai/
│   ├── resume-morpher.ts   # JD morphing logic
│   ├── jd-generator.ts     # JD creation
│   ├── bias-detector.ts    # Language analysis
│   └── market-predictor.ts # Salary intelligence
│
├── voice/
│   ├── speech-recognition.ts
│   └── voice-analyzer.ts
│
└── 3d/
    ├── neural-sphere.ts
    └── starfield.ts
```

---

## 🎯 Implementation Phases

### Phase 1: Foundation (Week 1)
**Status:** Ready to build
- [x] Command Bar navigation
- [x] Suite layout structure
- [ ] Database schema deployment
- [ ] Navigation transitions

### Phase 2: Liquid Resume (Week 2)
- [ ] Resume builder UI
- [ ] JD-morphing AI integration
- [ ] Context Toggle functionality
- [ ] Skill Graph SVG generation
- [ ] Ghost Paper aesthetic

### Phase 3: Persona-JD Engine (Week 3)
- [ ] JD generator interface
- [ ] Talent Density Score calculator
- [ ] Bias detection AI
- [ ] Typewriter animation
- [ ] 90-day roadmap generator

### Phase 4: Shadow Interviewer (Week 4)
- [ ] Neural Sphere (React Three Fiber)
- [ ] Web Speech API integration
- [ ] AI persona system
- [ ] Voice analysis
- [ ] Stress testing mode

### Phase 5: Market Oracle (Week 5)
- [ ] pgvector setup
- [ ] Salary data aggregation
- [ ] Opportunity Radar (WebGL)
- [ ] Market Value Heatmap
- [ ] Skill recommendations

---

## 🔥 Unique Features (The "Hirely Twist")

### Context Toggle
**Implementation:** Framer Motion layout animations
```tsx
<AnimatePresence mode="wait">
  {mode === 'technical' ? <TechnicalView /> : <LeadershipView />}
</AnimatePresence>
```

### Talent Density Score
**Algorithm:**
```typescript
// Rarity score based on:
// 1. Skill combination uniqueness
// 2. Experience level requirements
// 3. Market demand vs supply
// Output: 0 (common) to 10 (unicorn)
```

### Stress Testing
**Mechanics:**
- AI interrupts mid-answer
- Asks "Why?" 3 times in succession
- Background turns red
- Measures recovery time and composure

### Opportunity Radar
**Technology:** Three.js via React Three Fiber
```tsx
<Canvas>
  <Stars count={500} />
  {jobs.map(job => (
    <JobStar
      position={calculateFitPosition(job)}
      color={getFitColor(job.match_score)}
    />
  ))}
</Canvas>
```

---

## 🎨 Visual Specifications

### Command Bar
```css
position: fixed;
bottom: 24px;
left: 50%;
transform: translateX(-50%);
background: rgba(0, 0, 0, 0.4);
backdrop-filter: blur(40px);
border: 1px solid rgba(0, 245, 255, 0.2);
border-radius: 20px;
padding: 16px 24px;
```

### Ghost Paper (Resume)
```css
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(40px);
border: 1px solid rgba(255, 255, 255, 0.1);
box-shadow: 0 8px 32px rgba(255, 255, 255, 0.1);
```

### Neural Sphere
- Radius: 150px
- Material: MeshPhongMaterial with emissive
- Color: Responds to voice (green → cyan → purple)
- Particles: 1000 floating points

### Stress Visualizer
```css
.stress-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(
    circle,
    transparent 0%,
    rgba(255, 0, 85, var(--stress-level)) 100%
  );
  pointer-events: none;
  transition: --stress-level 0.5s ease;
}
```

---

## 🚀 Tech Stack Additions

### New Dependencies
```json
{
  "framer-motion": "^11.0.0",
  "react-three-fiber": "^8.15.0",
  "@react-three/drei": "^9.96.0",
  "three": "^0.160.0",
  "zustand": "^4.5.0",
  "react-spring": "^9.7.3",
  "d3": "^7.8.5",
  "svg.js": "^3.2.0"
}
```

### API Integrations
- OpenAI API (resume morphing, JD generation)
- Gemini API (existing - interview analysis)
- Web Speech API (voice recognition)
- Market data APIs (salary benchmarks)

---

## 📊 Success Metrics

### User Engagement
- Time spent in Resume Builder
- Number of JD variations created
- Mock interview sessions completed
- Skills added after Oracle recommendations

### Business Value
- User retention (30-day)
- Feature adoption rate
- Premium conversion (future)
- User satisfaction (NPS)

---

## 🎯 Next Steps

1. **Review and approve architecture**
2. **Deploy database schema**
3. **Build Command Bar (Phase 1)**
4. **Implement one complete module as reference**
5. **Iterate based on feedback**

---

**Ready to build the future of talent intelligence!** 🚀
