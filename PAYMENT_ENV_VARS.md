# LightSpeed Ghost — Payment Gateway Environment Variables
# Add all of these to your Render backend service.
# Start with just Stripe + Paystack, then add others as you go.
# Gateway routing is automatic — unconfigured gateways are skipped.

# ─────────────────────────────────────────────────────────────────────────────
# GENERAL
# ─────────────────────────────────────────────────────────────────────────────

# Your Vercel frontend URL (used for success/cancel redirect URLs after payment)
FRONTEND_URL=https://lightspeedghost.com


# ─────────────────────────────────────────────────────────────────────────────
# STRIPE  (routes: US, CA, GB, AU, EU, JP, SG, KR, and all other "first-world")
# ─────────────────────────────────────────────────────────────────────────────
# Dashboard: https://dashboard.stripe.com

# Secret key — Stripe Dashboard → Developers → API keys
STRIPE_SECRET_KEY=sk_live_...

# Publishable key — Stripe Dashboard → Developers → API keys
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Webhook signing secret
# Create endpoint at: Stripe Dashboard → Developers → Webhooks → Add endpoint
# URL: https://YOUR-RENDER-URL.onrender.com/api/payments/webhook/stripe
# Events to select: checkout.session.completed, customer.subscription.deleted
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs — create products/prices in Stripe Dashboard → Products
# Pro Monthly: $14.99/month recurring
STRIPE_PRICE_PRO_MONTHLY=price_...

# Pro Annual: $99/year recurring
STRIPE_PRICE_PRO_ANNUAL=price_...

# Campus Annual: $6/seat/month recurring (or handle as one-time)
STRIPE_PRICE_CAMPUS_ANNUAL=price_...


# ─────────────────────────────────────────────────────────────────────────────
# PAYSTACK  (routes: all of Africa + high-risk users globally)
# ─────────────────────────────────────────────────────────────────────────────
# Dashboard: https://dashboard.paystack.com

# Secret key — Paystack Dashboard → Settings → API Keys
PAYSTACK_SECRET_KEY=sk_live_...

# Public key — Paystack Dashboard → Settings → API Keys
PAYSTACK_PUBLIC_KEY=pk_live_...

# Webhook: add in Paystack Dashboard → Settings → Webhooks
# URL: https://YOUR-RENDER-URL.onrender.com/api/payments/webhook/paystack


# ─────────────────────────────────────────────────────────────────────────────
# INTASEND  (routes: Kenya, Uganda, Tanzania — mobile money)
# ─────────────────────────────────────────────────────────────────────────────
# Dashboard: https://payment.intasend.com  (sandbox: https://sandbox.intasend.com)

# API secret key — IntaSend Dashboard → Settings → API Keys (starts with ISSecretKey_)
INTASEND_API_KEY=ISSecretKey_...

# Publishable key — IntaSend Dashboard → Settings → API Keys (starts with ISPubKey_)
INTASEND_PUBLISHABLE_KEY=ISPubKey_...

# Webhook: add in IntaSend Dashboard → Settings → Webhooks
# URL: https://YOUR-RENDER-URL.onrender.com/api/payments/webhook/intasend


# ─────────────────────────────────────────────────────────────────────────────
# PADDLE  (routes: rest of world not covered above — handles VAT automatically)
# ─────────────────────────────────────────────────────────────────────────────
# Dashboard: https://vendors.paddle.com  (sandbox: https://sandbox-vendors.paddle.com)

# API key — Paddle Dashboard → Developer Tools → Authentication
PADDLE_API_KEY=...

# Webhook signing secret
# Create endpoint at: Paddle Dashboard → Developer Tools → Notifications → Add destination
# URL: https://YOUR-RENDER-URL.onrender.com/api/payments/webhook/paddle
# Events: transaction.completed, subscription.canceled
PADDLE_WEBHOOK_SECRET=...

# Price IDs — create in Paddle Dashboard → Catalog → Prices (format: pri_xxx)
# Pro Monthly: $14.99/month
PADDLE_PRICE_PRO_MONTHLY=pri_...

# Pro Annual: $99/year
PADDLE_PRICE_PRO_ANNUAL=pri_...

# Campus Annual: billed per seat
PADDLE_PRICE_CAMPUS_ANNUAL=pri_...


# ─────────────────────────────────────────────────────────────────────────────
# LEMON SQUEEZY  (fallback for any remaining unrouted regions)
# ─────────────────────────────────────────────────────────────────────────────
# Dashboard: https://app.lemonsqueezy.com

# Personal access token — LemonSqueezy Dashboard → Settings → API
LEMONSQUEEZY_API_KEY=...

# Store ID — LemonSqueezy Dashboard → Settings → Stores (numeric ID)
LEMONSQUEEZY_STORE_ID=...

# Webhook signing secret
# Create at: LemonSqueezy Dashboard → Settings → Webhooks → Add webhook
# URL: https://YOUR-RENDER-URL.onrender.com/api/payments/webhook/lemon-squeezy
# Events: order_created, subscription_created
LEMONSQUEEZY_WEBHOOK_SECRET=...

# Variant IDs — create products in LemonSqueezy Dashboard → Products
# Pro Monthly variant ID
LEMONSQUEEZY_VARIANT_PRO_MONTHLY=...

# Pro Annual variant ID
LEMONSQUEEZY_VARIANT_PRO_ANNUAL=...

# PAYG one-time purchase variant ID (single generic product for all PAYG)
LEMONSQUEEZY_VARIANT_PAYG=...


# ─────────────────────────────────────────────────────────────────────────────
# GATEWAY ROUTING SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
#
# KE, UG, TZ          → IntaSend  (M-Pesa, Airtel Money)
# NG, GH, ZA + Africa → Paystack  (card + mobile money, 3D Secure)
# US, CA, GB, AU, EU,
# JP, SG, AE, etc.    → Stripe    (card, Apple Pay, Google Pay)
# Rest of world        → Paddle    (auto VAT, global reach)
# Fallback             → Lemon Squeezy
# High-risk users      → Paystack  (3D Secure forced, regardless of location)
#
# Unconfigured gateways are automatically skipped.
# You can pause any gateway instantly from the Admin panel → Gateways tab.
