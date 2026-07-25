> 🛑 **OBSOLETE SETUP GUIDE — DO NOT FOLLOW.**
> Written for the Hirely.ai era, when the project targeted Supabase/Postgres. That stack was never shipped.
> The live system is **Next.js + Firebase (Auth, Firestore, Storage) + Stripe + Resend**, deployed to Cloud Run.
> Any `NEXT_PUBLIC_SUPABASE_*` variable here is dead, and any Supabase project reference is stale — treat it as a credential to revoke, not to use.
> **Current setup instructions: [`README.md`](../../../README.md). Architecture: [`TALENT_SUITE_ARCHITECTURE.md`](../../../TALENT_SUITE_ARCHITECTURE.md).**
> Superseded 25 July 2026. Archived for history only.

# 🧠 Hirely.ai - Next.js Version

**Modern, scalable interview intelligence platform built with Next.js 14, TypeScript, and Supabase**

![Version](https://img.shields.io/badge/version-2.0.0-cyan)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Supabase](https://img.shields.io/badge/Supabase-enabled-green)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp env.example .env.local
```

Edit `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Set Up Database
Follow `SUPABASE_SETUP.md` to create your database.

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ✨ Features

### Implemented ✅
- **Authentication System**: Complete signup/login/logout flow
- **CV Intelligence**: PDF parsing with AI analysis
- **Battle Plan Generator**: AI-powered question generation
- **Risk Analysis**: Automatic gap detection
- **User Management**: Personal workspaces with Supabase

### Coming Soon 🚧
- **Live Transcription**: Real-time speech-to-text
- **Calibration Engine**: Hybrid human + AI grading
- **Analytics Dashboard**: Candidate comparison & reports

See `IMPLEMENTATION_GUIDE.md` for development roadmap.

---

## 📁 Project Structure

```
Intetviewer/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── Header.tsx
│   ├── Navigation.tsx
│   ├── Toast.tsx
│   ├── modals/
│   │   └── AuthModal.tsx
│   └── tabs/
│       ├── DetectiveTab.tsx     # ✅ Implemented
│       ├── CoPilotTab.tsx       # 🚧 Placeholder
│       ├── CalibrationTab.tsx   # 🚧 Placeholder
│       └── AnalyticsTab.tsx     # 🚧 Placeholder
├── lib/                          # Core utilities
│   ├── supabase.ts              # Supabase client & auth
│   ├── database.ts              # Database operations
│   ├── gemini.ts                # Gemini AI integration
│   └── store.ts                 # Zustand state management
├── types/                        # TypeScript definitions
│   └── index.ts
├── public/                       # Static assets
└── docs/                         # Documentation
    ├── NEXTJS_SETUP.md
    ├── SUPABASE_SETUP.md
    └── IMPLEMENTATION_GUIDE.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.3 |
| **Styling** | Tailwind CSS 3.4 |
| **State** | Zustand 4.5 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **AI** | Google Gemini 2.0 |
| **Charts** | Chart.js + react-chartjs-2 |
| **PDF** | PDF.js 3.11 |

---

## 📜 Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm start           # Start production server
npm run lint        # Run ESLint
npm run type-check  # TypeScript type checking
```

---

## 🌐 Deployment

### Recommended: Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

### Environment Variables (Production)
```env
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Alternative Platforms
- **Netlify**: Automatic Next.js support
- **Railway**: Simple deployment
- **AWS Amplify**: Enterprise hosting

---

## 🔐 Security

- Row Level Security (RLS) in Supabase
- Encrypted data at rest and in transit
- Environment variables for sensitive data
- No API keys in client code
- HTTPS only in production

---

## 🧪 Development Workflow

### Adding New Features

1. **Create Component**: Add to `components/` directory
2. **Add Types**: Update `types/index.ts` if needed
3. **Implement Logic**: Use hooks and state management
4. **Style**: Use Tailwind CSS classes
5. **Test**: Verify in browser
6. **Type Check**: Run `npm run type-check`

### Example Component
```typescript
'use client';

import { useStore } from '@/lib/store';
import { showToast } from '@/components/Toast';

export default function MyComponent() {
  const { user } = useStore();

  const handleClick = () => {
    showToast('Hello!', '👋');
  };

  return (
    <button onClick={handleClick} className="btn-primary">
      Click Me
    </button>
  );
}
```

---

## 📊 Current Implementation Status

### Phase 1: Pre-Interview Detective ✅ 100%
- [x] CV PDF upload and parsing
- [x] Job description input
- [x] Gemini AI battle plan generation
- [x] Risk factor analysis
- [x] Core questions generation
- [x] Trap questions for expertise validation

### Phase 2: Live Co-Pilot 🚧 0%
- [ ] Web Speech API integration
- [ ] Real-time transcription
- [ ] Keyword detection
- [ ] Audio snippet recording
- [ ] AI nudges

### Phase 3: Calibration Engine 🚧 0%
- [ ] Human grading sliders
- [ ] AI assessment from transcript
- [ ] Radar chart visualization
- [ ] Interview notes
- [ ] Save to database

### Phase 4: Analytics Hub 🚧 0%
- [ ] Candidate leaderboard
- [ ] Score comparison charts
- [ ] Statistics dashboard
- [ ] PDF report export

---

## 🐛 Troubleshooting

### Build Errors

**"Module not found"**
```bash
# Clear .next and reinstall
rm -rf .next node_modules
npm install
```

**TypeScript errors**
```bash
npm run type-check
```

### Runtime Errors

**"Supabase client error"**
- Check `.env.local` file exists
- Verify environment variables are prefixed with `NEXT_PUBLIC_`

**"PDF.js worker error"**
- Ensure CDN worker URL is accessible
- Check browser console for specific error

---

## 📚 Documentation

- **Setup**: `NEXTJS_SETUP.md` - Complete setup guide
- **Database**: `SUPABASE_SETUP.md` - Supabase configuration
- **Development**: `IMPLEMENTATION_GUIDE.md` - Feature implementation
- **Quick Start**: `QUICKSTART.md` - 5-minute guide

---

## 🤝 Contributing

1. Read `IMPLEMENTATION_GUIDE.md` for development standards
2. Follow TypeScript best practices
3. Use Tailwind CSS for styling
4. Add types for all functions
5. Test thoroughly before committing

---

## 📝 License

Proprietary - Hirely.ai

---

## 🔗 Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs)

---

**Built with ❤️ for smarter hiring** | Version 2.0.0 | 2026
