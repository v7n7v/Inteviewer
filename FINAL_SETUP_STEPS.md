# 🎯 Final Setup Steps - Almost Done!

## ✅ What's Already Done:
- ✅ Supabase project created
- ✅ Your credentials received
- ✅ `.env.local` file created

## 🚀 3 Steps to Complete Setup:

---

### Step 1: Update .env.local (1 minute)

1. Open the file `.env.local` in your code editor
2. Open the file `YOUR_CREDENTIALS.txt` (I just created it)
3. Copy EVERYTHING from `YOUR_CREDENTIALS.txt`
4. Replace ALL content in `.env.local`
5. Save the file

**Your `.env.local` should now contain:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://qsriqbphmvnnbterqnsv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSy...GET_THIS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Step 2: Set Up Database Schema (2 minutes)

1. Go to your Supabase project: https://app.supabase.com/project/qsriqbphmvnnbterqnsv
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"** button
4. Open the file `schema.sql` from your project folder
5. Copy **ALL** the content
6. Paste into Supabase SQL Editor
7. Click **"Run"** (or Cmd/Ctrl + Enter)
8. You should see: ✅ **"Success. No rows returned"**

**To verify it worked:**
- Click **"Table Editor"** in left sidebar
- You should see a table called **"candidates"**

---

### Step 3: Get Gemini API Key (2 minutes) - OPTIONAL

**For AI features to work, you need this:**

1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIzaSy...`)
5. Open `.env.local`
6. Replace `AIzaSy...GET_FROM...` with your actual key
7. Save the file

**Example:**
```env
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyABC123def456GHI789jkl
```

---

### Step 4: Restart & Test (30 seconds)

```bash
# Stop your current server (Ctrl+C in terminal)
npm run dev
```

Then open: http://localhost:3000

---

## ✅ Success Checklist

You're done when:
- [ ] `.env.local` has your Supabase URL and key
- [ ] Ran `schema.sql` in Supabase SQL Editor
- [ ] See "candidates" table in Supabase Table Editor
- [ ] (Optional) Added Gemini API key to `.env.local`
- [ ] Restarted dev server
- [ ] App loads at http://localhost:3000
- [ ] See green "Connected" status in header
- [ ] Can click "Sign Up" button

---

## 🎮 Quick Test

Once the app loads:

1. Click **"✨ Sign Up"**
2. Create an account:
   - Name: Test User
   - Email: test@test.com
   - Password: test123
3. You should be logged in automatically!
4. Try going to **"🔍 Pre-Interview Detective"** tab
5. Upload a PDF CV if you have one

---

## 🐛 Troubleshooting

### "Supabase URL is required" - Still?
- Check that `.env.local` has NO quotes around values
- Make sure you saved the file
- Restart dev server

### "Failed to fetch"
- Double-check you copied the ENTIRE anon key (it's very long)
- Verify your Supabase project is active (not paused)

### "RLS policy violation"
- You forgot Step 2! Run `schema.sql` in Supabase

### "Invalid login credentials"
- If you get this when signing up, it means:
  - Email confirmation might be enabled
  - Check your email for verification link
  - OR disable it: Supabase → Authentication → Settings → Turn OFF "Confirm email"

---

## 📁 File Locations

- **Environment file**: `.env.local` (in project root)
- **Your credentials**: `YOUR_CREDENTIALS.txt` (in project root)
- **Database schema**: `schema.sql` (in project root)

---

## 🎉 What You'll Be Able to Do

Once setup is complete:
- ✅ Create user accounts
- ✅ Upload CV PDFs
- ✅ Generate AI-powered interview questions
- ✅ See risk factors and skill gaps
- ✅ All data saved securely to your Supabase database

---

**You're almost there! Just 3 steps to go!** 🚀

1. Update `.env.local` with credentials from `YOUR_CREDENTIALS.txt`
2. Run `schema.sql` in Supabase
3. Restart server: `npm run dev`
