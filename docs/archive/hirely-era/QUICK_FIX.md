> 🛑 **OBSOLETE SETUP GUIDE — DO NOT FOLLOW.**
> Written for the Hirely.ai era, when the project targeted Supabase/Postgres. That stack was never shipped.
> The live system is **Next.js + Firebase (Auth, Firestore, Storage) + Stripe + Resend**, deployed to Cloud Run.
> Any `NEXT_PUBLIC_SUPABASE_*` variable here is dead, and any Supabase project reference is stale — treat it as a credential to revoke, not to use.
> **Current setup instructions: [`README.md`](../../../README.md). Architecture: [`TALENT_SUITE_ARCHITECTURE.md`](../../../TALENT_SUITE_ARCHITECTURE.md).**
> Superseded 25 July 2026. Archived for history only.

# 🚨 Quick Fix: Supabase URL Error

## What Happened?
You're seeing "Supabase URL is required" because the app needs Supabase credentials to work.

## ✅ I've Already Done This For You:
- ✅ Created `.env.local` file in your project

## 🎯 What YOU Need to Do (10 minutes):

### Step 1: Create Supabase Account (3 min)
1. Go to: **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with GitHub/Google (fastest)

### Step 2: Create Project (2 min)
1. Click **"New Project"**
2. Name: `hirely`
3. Password: Click "Generate" (save it somewhere)
4. Region: Choose closest to you
5. Plan: **Free**
6. Click **"Create new project"**
7. ⏳ Wait 2-3 minutes while it sets up

### Step 3: Get Your Credentials (2 min)
1. In Supabase dashboard, click **⚙️ Settings** (bottom left)
2. Click **"API"**
3. Copy these TWO things:

**Project URL** (looks like):
```
https://abcdefgh.supabase.co
```

**anon public key** (very long, starts with):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Set Up Database (2 min)
1. Click **"SQL Editor"** in left sidebar
2. Click **"New query"**
3. Open the file `schema.sql` from your project
4. Copy ALL the content
5. Paste into Supabase SQL Editor
6. Click **"Run"**
7. Should see "Success" ✅

### Step 5: Add Credentials to Your App (1 min)
1. Open the file `.env.local` in your code editor
2. Replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...YOUR_ACTUAL_KEY...
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSy...GET_FROM_GOOGLE...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get Gemini Key**: https://aistudio.google.com/app/apikey

### Step 6: Restart & Test
```bash
# Stop your dev server (Ctrl+C)
npm run dev
```

Then open http://localhost:3000

---

## 🎯 File Locations

- **Environment file**: `/Users/alulagebreegziabher/Documents/Intetviewer/.env.local`
- **Database schema**: `/Users/alulagebreegziabher/Documents/Intetviewer/schema.sql`

---

## 📖 Detailed Guide

For detailed step-by-step instructions with screenshots and troubleshooting:
👉 **Open `STEP_BY_STEP_SUPABASE.md`**

---

## ⚡ Super Quick (If You Know What You're Doing)

```bash
# 1. Create Supabase project at supabase.com
# 2. Get URL and Key from Settings → API
# 3. Run schema.sql in SQL Editor
# 4. Edit .env.local with your credentials
# 5. Restart: npm run dev
```

---

## 🆘 Still Getting Errors?

**Check these:**
1. `.env.local` file exists in project root
2. No quotes around the values in `.env.local`
3. Copied the ENTIRE anon key (it's very long)
4. Ran `schema.sql` in Supabase successfully
5. Dev server restarted after editing `.env.local`

**Common Mistake:**
```env
# ❌ WRONG (has quotes)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"

# ✅ CORRECT (no quotes)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
```
