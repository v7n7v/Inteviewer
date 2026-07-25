# Hirely.ai-era documentation (archived)

These ten setup guides were written when the project targeted **Supabase/Postgres** under the name **Hirely.ai**. That stack was never shipped — the live system is Next.js + Firebase (Auth, Firestore, Storage) + Stripe + Resend on Cloud Run.

They were archived on 25 July 2026 because they sat at the repository root under names a new contributor reads first (`QUICKSTART.md`, `GETTING_STARTED.md`, `README_NEXTJS.md`) and would have led them to configure a database the product does not use.

**Current setup instructions live in [`README.md`](../../../README.md).**

## Security note

Several of these files contain a live-looking Supabase project reference (`qsriqbphmvnnbterqnsv`) and example environment variable names. Treat any credential appearing here as **exposed and to be revoked**, not as configuration.

## Contents

| File | Was |
| --- | --- |
| QUICKSTART.md | 5-minute Supabase setup |
| GETTING_STARTED.md | project welcome and Supabase integration |
| NEXTJS_SETUP.md | full Next.js + Supabase setup |
| README_NEXTJS.md | Hirely.ai Next.js README |
| FINAL_SETUP_STEPS.md | Supabase project completion steps |
| QUICK_FIX.md | "Supabase URL is required" troubleshooting |
| CONFIG_TEMPLATE.md | Supabase configuration template |
| LOGIN_FIX.md | Supabase email-confirmation login fix |
| DISABLE_EMAIL_STEPS.md | Supabase Auth email settings |
| EMAIL_CONFIGURATION_FIX.md | Supabase email branding fix |
