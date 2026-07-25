> 🛑 **OBSOLETE SETUP GUIDE — DO NOT FOLLOW.**
> Written for the Hirely.ai era, when the project targeted Supabase/Postgres. That stack was never shipped.
> The live system is **Next.js + Firebase (Auth, Firestore, Storage) + Stripe + Resend**, deployed to Cloud Run.
> Any `NEXT_PUBLIC_SUPABASE_*` variable here is dead, and any Supabase project reference is stale — treat it as a credential to revoke, not to use.
> **Current setup instructions: [`README.md`](../../../README.md). Architecture: [`TALENT_SUITE_ARCHITECTURE.md`](../../../TALENT_SUITE_ARCHITECTURE.md).**
> Superseded 25 July 2026. Archived for history only.

# ✅ Disable Email Confirmation - Simple Steps

## 🎯 Follow These Exact Steps:

### Step 1: Open Supabase Auth Settings
Click this link:
```
https://app.supabase.com/project/qsriqbphmvnnbterqnsv/auth/settings
```

### Step 2: Scroll Down
Look for the section called **"Email Confirmations"**

### Step 3: Toggle OFF
Find the toggle switch next to **"Enable email confirmations"**
- Currently it's **ON** (blue/green)
- Click it to turn it **OFF** (gray)

### Step 4: Save
Click the **"Save"** button at the bottom of the page

### Step 5: Done! ✨
That's it! Email confirmation is now disabled.

---

## 🧪 Test It Immediately

1. **Go back to Hirely.ai**: http://localhost:3000

2. **Refresh the page**: Press `Cmd+R` (Mac) or `Ctrl+R` (Windows)

3. **Click "Sign Up"**

4. **Create a new account**:
   - Name: Test User
   - Email: test@test.com (or any email)
   - Password: test123

5. **You should be logged in INSTANTLY!** 🎉
   - No email verification needed
   - No waiting
   - Dashboard appears immediately

---

## ✅ What You'll Notice

**Before (Email Confirmation ON):**
- Sign up → "Check your email" message
- Have to verify email
- Can't login until verified
- Annoying for testing

**After (Email Confirmation OFF):**
- Sign up → **Instant login!** ✨
- Dashboard appears immediately
- Can logout and login anytime
- Perfect for development

---

## 🎯 Confirmation

After you disable it, you should see:
- ✅ Toggle is **gray** (OFF state)
- ✅ "Enable email confirmations" is **disabled**
- ✅ Changes saved successfully

---

## 🚀 Ready to Test?

After saving, come back to Hirely.ai and:
1. Sign up with ANY email (doesn't need to be real)
2. You'll be logged in instantly
3. Dashboard works!
4. No more email issues!

---

**Click that link and toggle it off now!** 👆
