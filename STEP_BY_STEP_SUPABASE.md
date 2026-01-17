# 🔧 Step-by-Step Supabase Setup for Hirely.ai

**Follow these exact steps to set up Supabase and fix the "Supabase URL is required" error**

---

## 📋 Part 1: Create Supabase Account & Project (5 minutes)

### Step 1: Sign Up for Supabase

1. Open your browser and go to: **https://supabase.com**
2. Click the **"Start your project"** button (top right)
3. Sign up using one of these options:
   - GitHub (recommended - fastest)
   - Google
   - Email/Password

### Step 2: Create a New Project

1. After signing in, you'll see the Supabase Dashboard
2. Click the **"New Project"** button
3. Fill in the project details:
   - **Name**: `hirely` (or whatever you prefer)
   - **Database Password**: Click "Generate a password" (SAVE THIS!)
   - **Region**: Choose the closest to you (e.g., `US East`, `Europe West`)
   - **Pricing Plan**: Select **"Free"** (perfect for development)

4. Click **"Create new project"**
5. ⏳ Wait 2-3 minutes while Supabase provisions your database
   - You'll see a loading screen
   - Grab a coffee ☕

---

## 📋 Part 2: Get Your API Credentials (2 minutes)

### Step 3: Find Your Project URL

1. Once your project is ready, you'll be on the project dashboard
2. Look at the left sidebar
3. Click the **⚙️ Settings** icon (at the bottom)
4. Click **"API"** in the settings menu
5. You'll see a section called **"Project URL"**
   - It looks like: `https://xxxxxxxxxxxxx.supabase.co`
   - **COPY THIS!** You'll need it soon

### Step 4: Get Your Anon Key

1. On the same page (Settings → API)
2. Scroll down to **"Project API keys"**
3. You'll see two keys:
   - `anon` `public` - **This is the one you need!**
   - `service_role` - Don't use this one
4. Click the **📋 Copy** icon next to the `anon public` key
   - It's a very long string starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **SAVE THIS!** You'll need it soon

---

## 📋 Part 3: Set Up the Database (3 minutes)

### Step 5: Open SQL Editor

1. In the left sidebar, click **"SQL Editor"** (looks like `</>`)
2. Click **"New query"** button (top right)
3. You'll see a blank SQL editor

### Step 6: Run the Database Schema

1. Open the file `schema.sql` from your project folder
2. **Copy ALL the contents** (Cmd/Ctrl + A, then Cmd/Ctrl + C)
3. Go back to Supabase SQL Editor
4. **Paste** everything into the editor (Cmd/Ctrl + V)
5. Click **"Run"** button (or press Cmd/Ctrl + Enter)
6. ✅ You should see "Success. No rows returned" at the bottom
7. If you see errors, double-check you copied the entire file

### Step 7: Verify Database Setup

1. In the left sidebar, click **"Table Editor"**
2. You should see a table called **"candidates"**
3. Click on it - it should be empty (no rows) but show columns like:
   - id
   - user_id
   - name
   - cv_text
   - jd_text
   - etc.

✅ **Database is ready!**

---

## 📋 Part 4: Configure Your Next.js App (2 minutes)

### Step 8: Create Environment File

1. Open your terminal
2. Navigate to your project folder:
   ```bash
   cd /Users/alulagebreegziabher/Documents/Intetviewer
   ```

3. Create the `.env.local` file:
   ```bash
   cp env.example .env.local
   ```

4. Open `.env.local` in your code editor

### Step 9: Add Your Credentials

Edit `.env.local` and replace the placeholder values:

```env
# Replace xxxxx with YOUR actual Supabase URL from Step 3
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Replace with YOUR actual Anon Key from Step 4
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNycGpubXZ2a2xrY2d3dGhhaHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ4ODY3MzIsImV4cCI6MjAyMDQ2MjczMn0.abcdefghijklmnopqrstuvwxyz...

# Get Gemini API Key from: https://aistudio.google.com/app/apikey
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSy...

# Keep this as is for local development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**IMPORTANT**: 
- Don't include any quotes around the values
- Don't add spaces before or after the `=`
- Make sure each value is on its own line

### Step 10: Get Gemini API Key (Optional but Recommended)

1. Go to: **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIzaSy...`)
5. Paste it in `.env.local` for `NEXT_PUBLIC_GEMINI_API_KEY`

---

## 📋 Part 5: Configure Supabase Authentication (2 minutes)

### Step 11: Set Up Email Authentication

1. In Supabase dashboard, go to **Authentication** (left sidebar)
2. Click **"Settings"** (under Authentication)
3. Find **"Email Auth"** section
4. You'll see these options:

**For Development (Easier, Faster):**
- ✅ Enable Email provider
- ❌ Disable "Confirm email" (turn OFF)
- ❌ Disable "Secure email change" (turn OFF)
- This lets you test without email verification

**For Production (More Secure):**
- ✅ Enable Email provider
- ✅ Enable "Confirm email" (turn ON)
- ✅ Enable "Secure email change" (turn ON)

5. Click **"Save"** at the bottom

---

## 📋 Part 6: Test Everything (3 minutes)

### Step 12: Restart Your Development Server

1. If your dev server is running, stop it (Ctrl + C in terminal)
2. Start it again:
   ```bash
   npm run dev
   ```

3. You should see:
   ```
   ✓ Ready in 2.1s
   ○ Local:   http://localhost:3000
   ```

### Step 13: Open the App

1. Open your browser
2. Go to: **http://localhost:3000**
3. ✅ You should see the Hirely.ai interface!
4. The header should show:
   - 🟢 "Connected" or "Ready (Not Logged In)" (green/yellow dot)

### Step 14: Create Your First Account

1. Click **"✨ Sign Up"** (top right)
2. Fill in:
   - Full Name: Your name
   - Email: your@email.com
   - Password: at least 6 characters
3. Click **"Create Account"**

**If email confirmation is DISABLED:**
- ✅ You'll be logged in immediately
- ✅ You'll see your email in the header

**If email confirmation is ENABLED:**
- 📧 Check your email inbox
- Click the verification link
- Come back and click **"🔐 Login"**

### Step 15: Test Phase 1 Features

1. Click on **"🔍 Pre-Interview Detective"** tab
2. Try uploading a PDF CV (if you have one)
3. Paste a job description
4. Enter a candidate name
5. Click **"🧠 Generate Interview Battle-Plan"**
6. ✅ You should see risk factors and questions!

---

## ✅ Success Checklist

Make sure ALL of these are ✅:

- [ ] Supabase account created
- [ ] Project created and provisioned
- [ ] Copied Project URL
- [ ] Copied Anon Key
- [ ] Ran `schema.sql` in SQL Editor
- [ ] Verified `candidates` table exists
- [ ] Created `.env.local` file
- [ ] Added Supabase URL to `.env.local`
- [ ] Added Anon Key to `.env.local`
- [ ] Added Gemini API Key to `.env.local`
- [ ] Configured email authentication
- [ ] Restarted dev server
- [ ] App loads without errors
- [ ] Can create an account
- [ ] Can log in
- [ ] Can generate battle plans

---

## 🐛 Troubleshooting

### Error: "Supabase URL is required"

**Cause**: `.env.local` file is missing or not configured

**Fix**:
1. Check that `.env.local` exists in your project root
2. Open it and verify you have:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```
3. Make sure there are NO quotes around the values
4. Restart dev server: Stop (Ctrl+C) then `npm run dev`

### Error: "Failed to fetch"

**Cause**: Wrong Supabase URL or Key

**Fix**:
1. Go back to Supabase → Settings → API
2. Copy the values again
3. Make sure you copied the ENTIRE key (it's very long)
4. Update `.env.local`
5. Restart dev server

### Error: "RLS policy violation"

**Cause**: Database schema not set up correctly

**Fix**:
1. Go to Supabase → SQL Editor
2. Re-run the entire `schema.sql` file
3. Make sure you see "Success" message
4. Check Table Editor to verify `candidates` table exists

### Error: "Invalid login credentials"

**Cause**: Wrong email/password or account not verified

**Fix**:
1. If email confirmation is ON, check your email
2. Click verification link
3. Try logging in again
4. Or disable email confirmation (Step 11) for development

### Can't see "candidates" table

**Fix**:
1. Go to Supabase → SQL Editor
2. Run this to check:
   ```sql
   SELECT * FROM candidates LIMIT 1;
   ```
3. If error, re-run `schema.sql`

### App still not working?

**Nuclear option (reset everything)**:
```bash
# Stop dev server (Ctrl + C)
rm -rf .next node_modules
npm install
npm run dev
```

---

## 📸 Visual Guide

### What Supabase Dashboard Should Look Like:

**After Creating Project:**
```
┌─────────────────────────────────────┐
│  🏠 Home                            │
│  ⚙️  Settings                       │
│     • General                       │
│     • API          ← Go here        │
│     • Database                      │
│  📊 Table Editor   ← Check here     │
│  💾 SQL Editor     ← Run schema     │
│  🔐 Authentication                  │
└─────────────────────────────────────┘
```

### What `.env.local` Should Look Like:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ4ODY3MzIsImV4cCI6MjAyMDQ2MjczMn0.1234567890abcdefghijklmnopqrstuvwxyz
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🎯 Quick Reference

| Need | Where to Find |
|------|---------------|
| **Supabase URL** | Settings → API → Project URL |
| **Anon Key** | Settings → API → Project API keys → anon public |
| **Run Schema** | SQL Editor → New query → Paste schema.sql |
| **Check Tables** | Table Editor → Should see "candidates" |
| **Email Settings** | Authentication → Settings → Email Auth |
| **Gemini Key** | https://aistudio.google.com/app/apikey |

---

## 📞 Still Stuck?

1. Check that `.env.local` is in the same folder as `package.json`
2. Make sure dev server is restarted after changing `.env.local`
3. Check browser console (F12) for specific error messages
4. Verify Supabase project is not paused (free tier auto-pauses after 1 week inactivity)

---

**That's it! You should now be up and running!** 🎉

If you followed all steps and it's still not working, share the exact error message from your browser console (F12 → Console tab).
