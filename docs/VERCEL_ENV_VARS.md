# Vercel Environment Variables (Production)

Ye variables **Vercel Dashboard** → Project → **Settings** → **Environment Variables** me add karo  
(Environment: **Production**; optional: **Preview** bhi agar preview deploys chahiye).

> **GitHub Actions** ke liye alag: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` sirf **GitHub Repository Secrets** me rakho — Vercel project env me zaroori nahi (CLI deploy ke liye GitHub secrets kaafi hain).

---

## App + Stripe (required)

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_APP_URL` | Live URL, e.g. `https://your-app.vercel.app` ya custom domain |
| `STRIPE_SECRET_KEY` | `sk_live_...` ya `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret (`whsec_...`) — **production** endpoint ke liye |
| `STRIPE_CHECKOUT_MODE` | Usually `subscription` |

---

## Firebase Admin (server — API routes)

| Name | Notes |
|------|--------|
| `FIREBASE_PROJECT_ID` | GCP / Firebase project id |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` (single line with `\n`) |

---

## Firebase Web API (login proxy — server)

| Name | Notes |
|------|--------|
| `FIREBASE_API_KEY` | Firebase Console → Project settings → Web API key |

---

## Optional (local dev only — Vercel pe usually skip)

- `NGROK_AUTH_TOKEN` — sirf local tunnel
- `STRIPE_PUBLISHABLE_KEY` — is repo ke server flow me direct use nahi dikha; agar future client Stripe use karo tab add karna

---

## Vercel CLI se add karne ke commands

Pehle login + project link (ek baar local machine pe):

```bash
npm i -g vercel
vercel login
cd /path/to/stripe-integrate
vercel link
```

Phir har variable **Production** me (interactive — value paste karo):

```bash
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_CHECKOUT_MODE production
vercel env add FIREBASE_PROJECT_ID production
vercel env add FIREBASE_CLIENT_EMAIL production
vercel env add FIREBASE_PRIVATE_KEY production
vercel env add FIREBASE_API_KEY production
```

Non-interactive (PowerShell — value apni file se):

```powershell
Get-Content .env.production.local -Raw | vercel env add NEXT_PUBLIC_APP_URL production
```

Git Bash / bash (stdin pipe):

```bash
printf '%s' "https://your-app.vercel.app" | vercel env add NEXT_PUBLIC_APP_URL production
```

> `FIREBASE_PRIVATE_KEY` multiline hai — Dashboard se paste karna zyada safe hai, ya `printf` se exact `\n` escape string.

---

## Verify

```bash
vercel env ls
```

Redeploy: GitHub Actions se workflow run ya Vercel pe **Redeploy**.
