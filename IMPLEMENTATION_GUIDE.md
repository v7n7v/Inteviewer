# 📋 Hirely.ai Implementation Guide

## Project Status

### ✅ Completed (Phase 1)

- [x] Next.js 14 project setup with App Router
- [x] TypeScript configuration
- [x] Tailwind CSS with custom theme
- [x] Supabase integration
- [x] Authentication system (login/signup/logout)
- [x] Database helpers
- [x] Gemini AI integration
- [x] Global state management (Zustand)
- [x] Header component with user status
- [x] Navigation tabs
- [x] Toast notifications
- [x] Detective Tab (CV parser + Battle Plan generator)

### 🚧 To Be Implemented

#### Phase 2: Co-Pilot Tab (Priority: High)
**File**: `components/tabs/CoPilotTab.tsx`

**Features to implement**:
1. **Web Speech API Integration**
   - Start/Stop transcription buttons
   - Real-time speech-to-text
   - Transcript display with timestamps
   - Handle browser permissions

2. **Audio Recording**
   - MediaRecorder API integration
   - Save audio snippets per question
   - Playback functionality
   - Local storage of audio blobs

3. **Keyword Detection**
   - Monitor transcript for technical keywords
   - Display detected keywords as badges
   - Highlight in real-time

4. **AI Nudges**
   - Call Gemini API when candidate is vague
   - Display suggestions to interviewer
   - Context-aware prompting

**Implementation Tips**:
```typescript
// Web Speech API
const recognition = new (window as any).webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.onresult = (event: any) => {
  // Handle transcript
};

// MediaRecorder API
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
```

#### Phase 3: Calibration Tab (Priority: High)
**File**: `components/tabs/CalibrationTab.tsx`

**Features to implement**:
1. **Human Grading Interface**
   - 6 slider inputs (communication, technical, etc.)
   - Real-time value display
   - Update global state

2. **AI Assessment**
   - Button to trigger AI analysis
   - Send transcript to Gemini API
   - Parse and store AI grades

3. **Radar Chart**
   - Use react-chartjs-2
   - Overlay human vs AI grades
   - Responsive design

4. **Notes & Save**
   - Textarea for interview notes
   - Auto-summary from transcript
   - Save candidate to Supabase

**Implementation Tips**:
```typescript
import { Radar } from 'react-chartjs-2';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const data = {
  labels: ['Communication', 'Technical', 'Problem Solving', 'Culture Fit', 'Leadership', 'Energy'],
  datasets: [
    {
      label: 'Human Grade',
      data: Object.values(humanGrades),
      backgroundColor: 'rgba(0, 245, 255, 0.2)',
      borderColor: 'rgba(0, 245, 255, 1)',
    },
    {
      label: 'AI Grade',
      data: Object.values(aiGrades),
      backgroundColor: 'rgba(191, 0, 255, 0.2)',
      borderColor: 'rgba(191, 0, 255, 1)',
    },
  ],
};
```

#### Phase 4: Analytics Tab (Priority: Medium)
**File**: `components/tabs/AnalyticsTab.tsx`

**Features to implement**:
1. **Fetch Candidates**
   - Use `database.getCandidates()`
   - Display loading state
   - Handle errors

2. **Statistics Cards**
   - Total candidates
   - Average scores
   - Top candidate

3. **Candidate Matrix**
   - Grid layout of candidate cards
   - Show key scores
   - Click to view details

4. **Comparison Chart**
   - Bar chart comparing candidates
   - Use react-chartjs-2
   - Sortable by different metrics

5. **PDF Export**
   - Generate printable report
   - Use window.print() with custom CSS
   - Include all candidate details

**Implementation Tips**:
```typescript
import { Bar } from 'react-chartjs-2';
import { database } from '@/lib/database';

const [candidates, setCandidates] = useState<Candidate[]>([]);

useEffect(() => {
  const fetchCandidates = async () => {
    const data = await database.getCandidates();
    setCandidates(data);
  };
  fetchCandidates();
}, []);
```

### 🔧 Additional Enhancements

#### Error Handling
- Add error boundaries
- Better error messages
- Retry mechanisms

#### Performance
- Add loading skeletons
- Memoize expensive computations
- Lazy load components

#### UX Improvements
- Add keyboard shortcuts
- Drag-and-drop for CVs
- Dark/light mode toggle

#### Testing
- Unit tests with Jest
- Component tests with React Testing Library
- E2E tests with Playwright

## Development Workflow

### 1. Start Development Server
```bash
npm run dev
```

### 2. Make Changes
Edit files in `components/tabs/` for new features

### 3. Test Locally
- Check browser console for errors
- Test authentication flow
- Verify database operations

### 4. Type Check
```bash
npm run type-check
```

### 5. Lint
```bash
npm run lint
```

### 6. Build
```bash
npm run build
```

## Code Organization

### Component Structure
```
Component
├── State (useState, useStore)
├── Effects (useEffect)
├── Handlers (onClick, onChange)
├── Render (JSX)
└── Styles (Tailwind classes)
```

### Best Practices

1. **Use TypeScript types**: Import from `@/types`
2. **Client components**: Use `'use client'` when needed
3. **Error handling**: Always try/catch async operations
4. **Loading states**: Show feedback during async operations
5. **Toast notifications**: Use `showToast()` for user feedback

## API Integration

### Supabase
```typescript
import { database } from '@/lib/database';

// Save candidate
await database.saveCandidate(candidateData);

// Get candidates
const candidates = await database.getCandidates();

// Delete candidate
await database.deleteCandidate(id);
```

### Gemini AI
```typescript
import { callGeminiAPI, parseJSONResponse } from '@/lib/gemini';

const response = await callGeminiAPI(prompt);
const data = parseJSONResponse<YourType>(response);
```

### State Management
```typescript
import { useStore } from '@/lib/store';

const { user, currentCandidate, setCurrentCandidate } = useStore();
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Authentication tested
- [ ] All features working
- [ ] Performance optimized
- [ ] SEO metadata added

## Troubleshooting

### Common Issues

**Issue**: "Module not found"
- **Fix**: Check import paths, ensure `@/` alias works

**Issue**: "Hydration error"
- **Fix**: Use `'use client'` for components with browser APIs

**Issue**: "Supabase RLS error"
- **Fix**: Check policies in Supabase dashboard

**Issue**: "PDF.js worker error"
- **Fix**: Verify worker path in component

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Chart.js Docs](https://www.chartjs.org/docs)
- [Zustand Docs](https://docs.pmnd.rs/zustand)

---

**Ready to build? Start with Phase 2!** 🚀
