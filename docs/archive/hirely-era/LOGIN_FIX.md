> 🛑 **OBSOLETE SETUP GUIDE — DO NOT FOLLOW.**
> Written for the Hirely.ai era, when the project targeted Supabase/Postgres. That stack was never shipped.
> The live system is **Next.js + Firebase (Auth, Firestore, Storage) + Stripe + Resend**, deployed to Cloud Run.
> Any `NEXT_PUBLIC_SUPABASE_*` variable here is dead, and any Supabase project reference is stale — treat it as a credential to revoke, not to use.
> **Current setup instructions: [`README.md`](../../../README.md). Architecture: [`TALENT_SUITE_ARCHITECTURE.md`](../../../TALENT_SUITE_ARCHITECTURE.md).**
> Superseded 25 July 2026. Archived for history only.

# 🔧 Quick Fix: Login Issue

## The Problem
You can't login because **email confirmation is enabled** in Supabase. After creating an account, you need to verify your email before logging in.

---

## ✅ Solution 1: Disable Email Confirmation (Recommended for Development)

### Step-by-Step:

1. **Go to your Supabase project:**
   ```
   https://app.supabase.com/project/qsriqbphmvnnbterqnsv
   ```

2. **Click "Authentication"** in the left sidebar

3. **Click "Settings"** (under Authentication)

4. **Find "Email Confirmations" section**

5. **Toggle OFF "Enable email confirmations"**

6. **Click "Save"** at the bottom

7. **Done!** Now you can signup and login instantly without email verification

---

## ✅ Solution 2: Verify Your Email (If You Want to Keep Confirmation Enabled)

### Step-by-Step:

1. **Check your email inbox** (the one you used to sign up)

2. **Look for email from Supabase** (subject: "Confirm Your Email")
   - Check spam/junk folder if you don't see it

3. **Click the verification link** in the email

4. **Come back to Hirely.ai** and click "Sign In"

5. **Login with your credentials**

---

## 🎯 What I Just Fixed

I updated the AuthModal to:
- ✅ Show a beautiful "Check Your Email" screen after signup
- ✅ Provide better error messages for login issues
- ✅ Detect if email confirmation is required
- ✅ Guide you through next steps

---

## 🧪 Test It Now

### After Disabling Email Confirmation:

1. **Refresh your browser:** `Cmd+R` or `Ctrl+R`
2. **Click "Sign Up"** again (or use existing account)
3. **Create new account** with different email
4. **You should be logged in instantly!** ✨

### If You Verified Email:

1. **Click "Sign In"**
2. **Enter your credentials**
3. **You should be logged in!** ✨

---

## 📸 Visual Guide: Disable Email Confirmation

```
Supabase Dashboard
    ↓
Authentication (left sidebar)
    ↓
Settings
    ↓
Email Confirmations section
    ↓
Toggle OFF "Enable email confirmations"
    ↓
Click "Save"
```

---

## 🐛 Still Having Issues?

### Error: "Invalid login credentials"
**Cause:** Wrong email or password
**Fix:** 
- Double-check your email and password
- Try resetting password in Supabase
- Create a new account with different email

### Error: "Email not confirmed"
**Cause:** Email confirmation still enabled
**Fix:** 
- Go to Supabase → Authentication → Settings
- Disable email confirmations
- OR check your email for verification link

### Can't receive verification email?
**Fix:**
1. Check spam/junk folder
2. Add `noreply@mail.app.supabase.io` to contacts
3. Or disable email confirmation (easier for development)

---

## 💡 Pro Tips

### For Development:
- ✅ **Disable email confirmations** (fastest)
- ✅ Use simple test emails like `test@test.com`
- ✅ Use simple passwords like `test123`

### For Production:
- ✅ **Enable email confirmations** (more secure)
- ✅ Set up custom email templates
- ✅ Use strong passwords
- ✅ Consider adding 2FA later

---

## 🚀 Quick Action

**Right now, do this:**

1. Open: https://app.supabase.com/project/qsriqbphmvnnbterqnsv/auth/settings

2. Find "Enable email confirmations" and turn it **OFF**

3. Click **Save**

4. Refresh Hirely.ai in your browser

5. Try signing up again - you'll be logged in instantly!

---

## ✨ After the Fix

You should see:
- ✅ Signup → Instant login (no email needed)
- ✅ Beautiful success message
- ✅ Dashboard loads automatically
- ✅ Your email shown in header
- ✅ Can logout and login anytime

---

**Need help?** The app now has better error messages that will guide you! 🎯
