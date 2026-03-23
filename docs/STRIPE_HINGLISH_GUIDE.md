# Stripe Integration Guide (Hinglish) — Next.js (App Router)

Ye document aapke project (`next@16.x`, `app/` router) me **Stripe** ko integrate karne ka end‑to‑end roadmap hai: Stripe kya hai, kyun use hota hai, kaunsi cheezen chahiye, aur project se connect kaise hoga.

---

## Stripe kya hai? (Simple words me)

**Stripe = payment infrastructure**.
Matlab aapki app ko:
- card payments lena (Visa/MasterCard),
- wallets (Apple Pay / Google Pay),
- subscriptions (monthly/yearly),
- invoices / one‑time payments,
- refunds, tax, receipts,
- aur payment security/compliance

ye sab “bank-level” cheezon ke saath handle karne me help karta hai.

### Stripe kyun? (Project me value)

Payments ka “hard part” ye hota hai:
- **Security** (card data ko safely handle karna)
- **Compliance** (PCI, etc.)
- **3D Secure / SCA** (EU rules)
- **Fraud** + chargebacks
- **Webhooks** (payment success/failed ka reliable signal)

Stripe aapko ye sab built-in deta hai, so aap apni product logic par focus karte ho.

---

## Aapke current project me Stripe ka use-case

`app/page.tsx` me aapke paas **Pricing Plans** ka UI already hai (Basic/Pro/Enterprise). Stripe yahan typically 2 tarah se fit hota hai:

- **One-time payment**: “Pay once, get access”
- **Subscription**: “Monthly/Yearly plan, auto-renew”

Zyada common SaaS ke liye **Subscription** hota hai.

---

## Stripe ke main concepts (table)

| Term | Simple meaning | Aapke project me role |
|---|---|---|
| **Product** | Plan/offer ka name + identity | Basic/Pro/Enterprise |
| **Price** | Actual amount + currency + recurring/non-recurring | $19/month, $49/month, etc. |
| **Customer** | User ka Stripe account record | User mapping (email/userId) |
| **Checkout Session** | Stripe hosted payment page ka “session” | Button click → Stripe Checkout |
| **Payment Intent** | Card charge ka internal object | Mostly Stripe handles in Checkout |
| **Subscription** | Recurring billing contract | Plan-based access |
| **Webhook** | Stripe → aapke server ko event call | “payment success” ka source of truth |
| **Portal (Billing Portal)** | Stripe hosted manage-subscription UI | User plan cancel/update |
| **Test Mode** | Dummy payments for development | Local testing without real charges |

---

## “Family tree” (mental model) — Stripe objects ka relation

Isko family tree ki tarah samjho:

```
Your App (Next.js)
└─ User (your DB)
   ├─ Stripe Customer (stripe)
   │  ├─ Subscription (stripe)   [optional, if recurring]
   │  │  └─ Price (stripe)
   │  │     └─ Product (stripe)
   │  └─ Payments (stripe)       [optional, if one-time]
   └─ Your Entitlements/Access (your DB)
      ├─ plan = basic/pro/enterprise
      ├─ status = active/canceled/past_due
      └─ validUntil / renewalDate
```

**Golden rule**: UI button sirf “start payment” karta hai.  
Final truth **Webhook** se update hoti hai (kyun ke browser close ho sakta hai, redirect fail ho sakta hai).

---

## Integration approach (recommended) — Stripe Checkout + Webhooks

### Flow (high level)

| Step | Kahan? | Kya hota hai? |
|---|---|---|
| 1 | Client (Pricing page) | User plan select karta hai |
| 2 | Server (API/Route) | Aap Stripe Checkout Session create karte ho |
| 3 | Stripe | Hosted checkout page open hota hai |
| 4 | Stripe → Your webhook | Payment/Subscription success event send hota hai |
| 5 | Server (webhook) | Aap DB me user ka plan “active” mark karte ho |
| 6 | Client | User ko success page pe redirect (optional) |

---

## Setup checklist (aapko kya chahiye)

### 1) Stripe account
- Stripe Dashboard me login
- **Test mode** use karein development me

### 2) Products/Prices create
Stripe Dashboard → Products:
- Product: **Basic** → Price: **$19 / month**
- Product: **Pro** → Price: **$49 / month**
- Product: **Enterprise** → (subscription or “contact sales” — aapka business decision)

**Important**: Code me usually aap `priceId` use karte ho (e.g. `price_123...`).

### 3) Local env variables
Project root me `.env.local` (git me commit na karein):

```bash
# Stripe keys (Test mode)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook secret (Stripe CLI se aata hai)
STRIPE_WEBHOOK_SECRET=whsec_...

# App base url
NEXT_PUBLIC_APP_URL=http://localhost:5000

# Firebase Admin (Stripe plan/store ke liye) — Service Account JSON se
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
(FIREBASE_PRIVATE_KEY me `\n` ko real newline bhi kar sakte ho; code me `\\n` replace ho kar use hota hai.)

---

## Next.js (App Router) me “connect” kaise hoga

### A) Server-side route: Checkout Session create

App Router me typical file:
- `app/api/stripe/checkout/route.ts`

Is route ka kaam:
- client se `planId` leke (basic/pro/enterprise)
- us plan ka Stripe `priceId` pick karna
- Stripe me **Checkout Session** create karna
- response me `url` dena jahan user redirect hoga

#### Plan → Stripe PriceId mapping (table)

| Your Plan Id | Stripe Price Id (example) | Notes |
|---|---|---|
| `basic` | `price_...basicMonthly` | recurring monthly |
| `pro` | `price_...proMonthly` | recurring monthly |
| `enterprise` | `price_...enterpriseMonthly` | ya “contact sales” (no checkout) |

**Best practice**: `priceId` ko code me hardcode na karein.  
Option A: env vars me rakhein. Option B: DB/config table me.

Example env style:

```bash
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Optional: "subscription" (recurring prices) or "payment" (one-time prices)
STRIPE_CHECKOUT_MODE=subscription
```

#### Minimal pseudo-code (server)

```ts
// app/api/stripe/checkout/route.ts (idea)
// POST { planId: "basic" }
// -> returns { url: "https://checkout.stripe.com/..." }
```

**Important security point**: Price/amount **client se accept mat karo**.  
Client sirf `planId` bheje; server decide kare `priceId`.

---

### B) Client-side: “Get started” button click → redirect to Stripe

`app/page.tsx` me aapke buttons already hain:
- `onCtaClick={() => console.log("Selected plan:", plan.id)}`

Isko update karke:
- POST to `/api/stripe/checkout` with `planId`
- response `url` pe `window.location.href = url`

**User experience**:
- button click ke baad loading state
- error toast/message if session creation fail

---

### C) Success/Cancel pages (optional but recommended)

Stripe checkout ke baad user ko aap yahan bhejte ho:
- `success_url` / `cancel_url`: pehle `NEXT_PUBLIC_APP_URL` / `APP_URL`; warna Vercel preview/production par default `https://stripe-integrate.vercel.app`; local par `http://localhost:5000`

Files:
- `app/billing/success/page.tsx`
- `app/billing/cancel/page.tsx`

**Note**: Success page pe “thank you” dikhana ok hai, but access unlock **webhook** ke basis pe karo.

---

### D) Webhook route (MOST IMPORTANT)

Webhook ka matlab:
Stripe aapko server-to-server event bhejta hai:
- `checkout.session.completed`
- `invoice.paid` (subscriptions)
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

App Router me typical file:
- `app/api/stripe/webhook/route.ts`

Webhook me aap:
- signature verify karte ho (`STRIPE_WEBHOOK_SECRET`)
- event type check karte ho
- apni DB me user/plan status update karte ho

#### Webhook events → Aapke DB actions (table)

| Event | Meaning | Aap kya update karoge |
|---|---|---|
| `checkout.session.completed` | first time checkout success | user plan `active` + store `customerId` |
| `invoice.paid` | subscription renewal success | next renewal date / keep `active` |
| `invoice.payment_failed` | payment fail | `past_due` / restrict access |
| `customer.subscription.deleted` | canceled | `canceled` / revoke access |

---

## “Family tree” — Request flow (end-to-end)

```
Browser (Pricing Page)
└─ POST /api/stripe/checkout (server)
   └─ Stripe Checkout Session created
      └─ Redirect to Stripe hosted checkout
         ├─ User pays (Stripe)
         ├─ Redirect back to /billing/success (optional)
         └─ Stripe sends webhook to /api/stripe/webhook (server)
            └─ Your DB updated (plan active)
               └─ User gets access in app
```

---

## Local testing (Stripe CLI) — recommended

Webhook test karne ka best way:
- Stripe CLI install
- `stripe login`
- `stripe listen --forward-to localhost:5000/api/stripe/webhook`

CLI aapko `whsec_...` dega → same `.env.local` me set karo.

Phir test event:
- `stripe trigger checkout.session.completed`

---

## Common mistakes (avoid)

| Mistake | Problem | Fix |
|---|---|---|
| client se amount/price accept karna | user tamper kar sakta hai | server-only `planId -> priceId` |
| webhook verify skip karna | fake requests possible | signature verification must |
| success page ko “source of truth” banana | redirect fail ho sakta hai | DB updates only webhook se |
| keys expose karna | secret key leak | `STRIPE_SECRET_KEY` server only |

---

## Next steps (jab aap ready ho code integrate karne ke liye)

Agar aap bolo to main aapke repo me ye implement kar dunga:
- Stripe SDK add (`stripe`)
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- pricing buttons ko checkout se connect
- optional success/cancel pages

Bas aap mujhe ye 2 cheezen de do (safe way):
- Basic/Pro ke actual `price_...` IDs (test mode)
- aap subscription chahte ho ya one‑time?

