# 🚀 Next.js Setup Guide for Hirely.ai

Complete setup instructions for the Next.js version of Hirely.ai.

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (see `SUPABASE_SETUP.md`)
- Gemini API key

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd /path/to/Intetviewer
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSy...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Database

Follow the instructions in `SUPABASE_SETUP.md` to create your database schema.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
Intetviewer/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Header.tsx
│   ├── Navigation.tsx
│   ├── Toast.tsx
│   ├── modals/           # Modal components
│   │   └── AuthModal.tsx
│   └── tabs/             # Tab components
│       ├── DetectiveTab.tsx
│       ├── CoPilotTab.tsx
│       ├── CalibrationTab.tsx
│       └── AnalyticsTab.tsx
├── lib/                   # Utilities & helpers
│   ├── supabase.ts       # Supabase client
│   ├── database.ts       # Database operations
│   ├── gemini.ts         # Gemini AI integration
│   └── store.ts          # Zustand state management
├── types/                 # TypeScript types
│   └── index.ts
├── utils/                 # Utility functions
├── public/               # Static assets
├── next.config.js        # Next.js configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

## 🎨 Key Technologies

- **Next.js 14**: App Router with React Server Components
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Zustand**: Lightweight state management
- **Supabase**: Backend as a service
- **Chart.js**: Data visualization
- **PDF.js**: PDF parsing

## 🔧 Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check
npm run type-check
```

## 🌐 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in project settings
4. Deploy!

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Other Platforms

- **Netlify**: Supports Next.js with minimal configuration
- **Railway**: Easy deployment with automatic SSL
- **AWS Amplify**: Enterprise-grade hosting

## 🐛 Troubleshooting

### Build Errors

**Issue**: `Module not found: Can't resolve '@/...'`
- **Fix**: Check `tsconfig.json` paths configuration

**Issue**: PDF.js worker errors
- **Fix**: Verify `next.config.js` webpack configuration

### Runtime Errors

**Issue**: Supabase client errors
- **Fix**: Ensure `.env.local` variables are prefixed with `NEXT_PUBLIC_`

**Issue**: Hydration errors
- **Fix**: Make sure client components use `'use client'` directive

### Authentication Issues

**Issue**: Can't login/signup
- **Fix**: Check Supabase RLS policies and email settings

## 📚 Development Tips

### Hot Reload

Next.js automatically reloads when you make changes. No need to restart the server.

### Type Safety

Use TypeScript types from `types/index.ts`:

```typescript
import type { Candidate, Question } from '@/types';
```

### State Management

Access global state with Zustand:

```typescript
import { useStore } from '@/lib/store';

const { user, currentTab, setCurrentTab } = useStore();
```

### Database Operations

Use the database helper:

```typescript
import { database } from '@/lib/database';

const candidates = await database.getCandidates();
```

## 🔐 Security Best Practices

1. **Never commit `.env.local`** - Added to `.gitignore`
2. **Use RLS policies** - Set up in Supabase
3. **Validate user input** - Always sanitize
4. **HTTPS only** - Use in production
5. **Regular updates** - Keep dependencies current

## 🚀 Performance Optimization

- Images optimized with Next.js Image component
- Code splitting automatic with App Router
- Lazy load components when needed
- Memoize expensive calculations
- Use server components where possible

## 📖 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

**Need help?** Check `QUICKSTART.md` or `SUPABASE_SETUP.md`
