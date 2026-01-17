# ⚡ Quick Start Guide - 5 Minutes to Hirely.ai

Get Hirely.ai running in 5 minutes or less!

## Step 1: Create Supabase Project (2 min)

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New Project**
3. Fill in:
   - Project name: `hirely`
   - Database Password: (generate strong password)
   - Region: (closest to you)
4. Click **Create new project**
5. Wait ~2 minutes for provisioning ☕

## Step 2: Setup Database (1 min)

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open [`schema.sql`](./schema.sql) from this repo
4. **Copy the entire contents** and paste into SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Setup Complete!" ✅

## Step 3: Get Your Credentials (30 sec)

1. Go to **Project Settings** → **API** (gear icon in sidebar)
2. Copy these two values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long token)

## Step 4: Get Gemini API Key (1 min)

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with Google
3. Click **Create API Key**
4. Copy the key

## Step 5: Configure Hirely.ai (30 sec)

1. Open `index.html` in Chrome or Edge
2. Click **⚙️ Settings**
3. Paste:
   - Supabase URL
   - Supabase Anon Key
   - Gemini API Key
4. Click **Save Configuration**

## Step 6: Create Account & Start! (30 sec)

1. Click **✨ Sign Up**
2. Enter your:
   - Full Name
   - Email
   - Password (min 6 chars)
3. Click **Create Account**
4. If email confirmation is enabled, check your email
5. Otherwise, you're logged in automatically! 🎉

## 🎯 You're Ready!

Now you can:
- Upload CVs and generate battle plans
- Start live interviews with transcription
- Grade candidates with AI assistance
- Export professional reports

## 🆘 Something Not Working?

### "Failed to fetch" error
- Double-check your Supabase URL and Key
- Make sure you clicked "Save Configuration"

### Can't create account
- Check that `schema.sql` ran successfully
- Verify no errors in browser console (F12)

### Battle Plan not generating
- Make sure Gemini API key is entered
- Upload CV (PDF) AND paste Job Description

## 📚 Need More Help?

- **Full Setup Guide**: [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)
- **Main README**: [`README.md`](./README.md)

---

**Ready to transform your interview process? Let's go! 🚀**
