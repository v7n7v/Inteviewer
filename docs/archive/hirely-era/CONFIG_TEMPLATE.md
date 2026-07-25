> 🛑 **OBSOLETE SETUP GUIDE — DO NOT FOLLOW.**
> Written for the Hirely.ai era, when the project targeted Supabase/Postgres. That stack was never shipped.
> The live system is **Next.js + Firebase (Auth, Firestore, Storage) + Stripe + Resend**, deployed to Cloud Run.
> Any `NEXT_PUBLIC_SUPABASE_*` variable here is dead, and any Supabase project reference is stale — treat it as a credential to revoke, not to use.
> **Current setup instructions: [`README.md`](../../../README.md). Architecture: [`TALENT_SUITE_ARCHITECTURE.md`](../../../TALENT_SUITE_ARCHITECTURE.md).**
> Superseded 25 July 2026. Archived for history only.

# 🔐 Configuration Template for Hirely.ai

Copy these values and paste into **Settings (⚙️)** in the application.

## Supabase Configuration

**Where to get these:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**

```
Supabase URL: https://xxxxx.supabase.co
Supabase Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Gemini API Configuration

**Where to get this:**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with Google
3. Click **Create API Key**

```
Gemini API Key: AIzaSy...
```

## 🔒 Security Notes

- These values are stored in your browser's **localStorage**
- They are **never sent** to any server except:
  - Supabase (for database operations)
  - Google Gemini (for AI features)
- Clear your browser data to remove them
- Keep your keys private and never share them publicly

## 📋 Quick Setup Checklist

- [ ] Created Supabase account
- [ ] Created new Supabase project
- [ ] Ran `schema.sql` in SQL Editor
- [ ] Copied Supabase URL
- [ ] Copied Supabase Anon Key
- [ ] Generated Gemini API Key
- [ ] Pasted all credentials into Hirely.ai Settings
- [ ] Created user account
- [ ] Tested by uploading a CV

## 🆘 Troubleshooting

**Settings won't save?**
- Check browser console (F12) for errors
- Try a different browser (Chrome/Edge recommended)
- Clear browser cache and try again

**Still having issues?**
- See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for detailed guide
- See [`QUICKSTART.md`](./QUICKSTART.md) for step-by-step tutorial

---

**Ready to hire smarter? Let's go! 🚀**
