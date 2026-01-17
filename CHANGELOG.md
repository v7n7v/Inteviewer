# 📋 Changelog

## Version 2.0.0 - Supabase Integration (Current)

### 🎉 Major Features

#### Multi-User Authentication
- ✅ User signup with email/password
- ✅ Secure login system
- ✅ Session management
- ✅ Logout functionality
- ✅ Email verification support (optional)

#### Cloud Database
- ✅ Supabase PostgreSQL integration
- ✅ Row Level Security (RLS) for data isolation
- ✅ Each user has private candidate workspace
- ✅ Real-time data sync across devices
- ✅ Automatic timestamps (created_at, updated_at)

#### Enhanced UI
- ✅ Login/Signup modals
- ✅ User profile display in header
- ✅ Connection status indicator
- ✅ Unified settings modal (Supabase + Gemini)
- ✅ Better error handling and user feedback

### 🔒 Security Improvements
- Database-level security with RLS policies
- Encrypted data at rest
- HTTPS communication
- Secure credential storage in localStorage
- User data isolation (can't access other users' data)

### 📁 New Files
- `SUPABASE_SETUP.md` - Detailed database setup guide
- `QUICKSTART.md` - 5-minute getting started guide
- `schema.sql` - Copy-paste SQL schema for Supabase
- `CHANGELOG.md` - This file

### 🔄 Breaking Changes from v1.0.0
- **IndexedDB removed**: Data now stored in Supabase cloud database
- **Configuration required**: Must set up Supabase before using
- **Login required**: Must create account to save candidates
- **API keys**: Now stored separately (Supabase + Gemini)

### 📊 Database Schema
- `candidates` table with full interview data
- User relationships via `user_id` foreign key
- JSONB fields for flexible data structures
- Automatic RLS policies for security

### 🛠️ Technical Updates
- Added Supabase JavaScript SDK (v2)
- Replaced all IndexedDB operations with Supabase calls
- Added authentication state management
- Updated initialization flow
- Enhanced error handling

---

## Version 1.0.0 - Initial Release

### Features
- ✅ PDF CV parsing with PDF.js
- ✅ AI battle plan generation
- ✅ Live transcription with Web Speech API
- ✅ Audio snippet recording
- ✅ Keyword detection
- ✅ Calibration engine with radar charts
- ✅ Analytics dashboard
- ✅ PDF export
- ✅ IndexedDB storage (local only)
- ✅ Single-user mode

---

## Migration Guide: v1.0 → v2.0

### For Existing Users

Since v1.0 used local IndexedDB, your data will not automatically transfer. To migrate:

1. **Export your data from v1.0**:
   - Open browser DevTools (F12)
   - Go to Application → IndexedDB → Hirely.aiDB → candidates
   - Copy candidate data

2. **Set up v2.0**:
   - Follow `QUICKSTART.md`
   - Create Supabase database
   - Create account

3. **Manual import** (if needed):
   - You can manually re-enter candidate data
   - Or contact support for bulk import scripts

### Why the Change?

**Benefits of Supabase:**
- 📱 Access from multiple devices
- 👥 Multi-user support (teams)
- ☁️ Cloud backup (no data loss)
- 🔒 Better security (RLS)
- 📈 Scalable for growth
- 🔄 Real-time sync

---

## Roadmap

### v2.1 (Planned)
- [ ] Team workspaces
- [ ] Candidate sharing between users
- [ ] Advanced analytics (trends over time)
- [ ] Custom question templates
- [ ] Interview scheduling integration

### v2.2 (Planned)
- [ ] Video interview recording
- [ ] Automated transcript highlights
- [ ] AI interview coach mode
- [ ] Mobile app (React Native)
- [ ] Integration with ATS systems

### v3.0 (Future)
- [ ] Real-time collaboration
- [ ] Interview panel mode (multiple interviewers)
- [ ] Advanced AI insights
- [ ] Custom branding
- [ ] API access for integrations

---

**Last Updated**: January 2026
