# 🧠 TalentConsulting.io - Interview Intelligence Platform

A premium, cloud-powered HTML5 application for autonomous interview strategy, transcription, and candidate calibration with multi-user support.

![Version](https://img.shields.io/badge/version-2.0.0-cyan)
![Database](https://img.shields.io/badge/database-supabase-green)
![Auth](https://img.shields.io/badge/auth-built--in-purple)

## ✨ Features

### 🤖 AI Assistant Chat (NEW!)
- **Always-Available Help**: Beautiful floating chat assistant in bottom-right corner
- **Powered by Groq GPT-OSS 120B ⚡**: Lightning-fast responses (<1 second)
- **Context-Aware Conversations**: Remembers your chat history for intelligent follow-ups
- **Career-Focused AI**: Specialized for interview prep, resume tips, and job search advice
- **Liquid Glass Design**: Stunning UI with smooth Framer Motion animations
- **Quick Prompts**: One-click starter questions to get help fast
- **Privacy First**: Ephemeral conversations, no data stored

### Phase 1: Pre-Interview Detective 🔍
- **CV Intelligence Loader**: Drag-and-drop PDF parsing with PDF.js
- **AI Battle-Plan Generation**: Groq GPT-OSS 120B analyzes CV vs JD to create customized interview questions
- **Risk Factor Analysis**: Identifies gaps and potential concerns
- **Trap Questions**: Expert-level validation questions for claimed expertise

### Phase 2: Live Co-Pilot 🎙️
- **Real-time Transcription**: Web Speech API for live interview transcription
- **Keyword Detection**: Automatic highlighting of technical terms
- **AI Nudges**: Smart prompts when candidate responses are vague
- **Audio Snippets**: Save key moments with MediaRecorder API

### Phase 3: Calibration Engine ⚖️
- **Hybrid Grading**: Human assessment sliders for soft skills
- **AI Assessment**: Automated technical scoring from transcript
- **Radar Visualization**: Chart.js overlay comparing human vs AI grades
- **Auto-Summary**: AI-generated interview notes

### Phase 4: Analytics Hub 📊
- **Candidate Leaderboard**: Compare all interviewed candidates
- **Score Comparison**: Bar charts for visual ranking
- **PDF Export**: Professional reports with signature line
- **Local Persistence**: All data stored in IndexedDB (never leaves your browser)

## 🚀 Quick Start

### 1. Setup Supabase Database
- Follow the detailed guide in [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)
- Create your free Supabase account
- Run the SQL schema
- Get your credentials

### 2. Open the Application
- Simply double-click `index.html` or open it in Chrome/Edge
- Or run a local server: `python -m http.server 8000`

### 3. Configure Settings
- Click ⚙️ Settings in the header
- Enter your **Supabase URL** and **Anon Key**
- Enter your [Groq API key](https://console.groq.com/keys)
- Click Save Configuration

### 4. Create Account & Login
- Click **Sign Up** to create your account
- Verify email (if enabled)
- **Login** to access the platform

### 5. Start Interviewing
- Upload a CV (PDF format)
- Paste the Job Description
- Generate your Interview Battle-Plan
- Use Live Co-Pilot during the interview
- Grade and save candidates to the cloud

## 🔐 Security & Privacy

- **User Authentication**: Secure account system with email/password
- **Row Level Security**: Database-level isolation - users only see their own data
- **Encrypted Storage**: All data encrypted at rest in Supabase
- **Local Config**: API keys stored in browser localStorage
- **HTTPS**: All communication encrypted in transit
- **GDPR Ready**: Data ownership and deletion controls built-in

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| UI Framework | Tailwind CSS |
| PDF Parsing | PDF.js |
| Charts | Chart.js |
| Speech | Web Speech API |
| Audio | MediaRecorder API |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Storage | Cloud + Local |
| AI Engine | Groq GPT-OSS 120B ⚡ |

## 🎨 Design Philosophy

- **2026 Silicon Valley Aesthetic**: Glassmorphism, dark mode, neon cyan accents
- **Premium SaaS Feel**: Blurred glass cards, smooth animations
- **Responsive**: Works on desktop and tablet

## ⚠️ Browser Requirements

- **Chrome** (recommended) - Full feature support
- **Edge** - Full feature support  
- **Firefox** - Limited speech recognition
- **Safari** - Limited speech recognition

## 👥 Multi-User Features

- **Personal Workspace**: Each user has their own private candidate database
- **Cloud Sync**: Access your data from any device
- **Secure Isolation**: Row Level Security ensures data privacy
- **Team Ready**: Multiple users can use the same Supabase instance
- **Export Anytime**: Generate PDF reports for any candidate

## 📝 Usage Tips

1. **For best transcription**: Use a quality microphone and speak clearly
2. **Battle Plan works best**: When both CV and JD are detailed
3. **Save snippets**: During important candidate responses
4. **Stay logged in**: Your data is securely stored in the cloud
5. **Export reports**: Generate professional PDFs for stakeholders
6. **Access anywhere**: Login from any device to view your candidates

## 🔑 Getting Your Credentials

### Supabase Credentials
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (or select existing)
3. Go to Project Settings → API
4. Copy your **Project URL** and **anon/public key**
5. See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for detailed database setup

### Groq API Key
1. Go to [Groq Console](https://console.groq.com/keys)
2. Sign in with your account
3. Click "Create API Key"
4. Copy and paste into TalentConsulting.io settings

## 🐛 Troubleshooting

**Can't login or signup?**
- Verify Supabase credentials in Settings
- Check browser console for errors
- Ensure database schema is created correctly

**Battle Plan not generating?**
- Verify Groq API key is configured in `.env.local`
- Check that CV and JD are both filled
- Check browser console for API errors

**Candidates not saving?**
- Ensure you're logged in
- Verify database permissions (RLS policies)
- Check network connectivity

**Transcription not working?**
- Allow microphone permissions in browser
- Use Chrome or Edge for best support
- Check that microphone is working in system settings

For detailed setup help, see [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)

---

**Built for Team Leads & Hiring Managers** | Secure & Scalable | Cloud-Powered

*TalentConsulting.io - Hire smarter with AI-powered interview intelligence*
# Interviewer-2
