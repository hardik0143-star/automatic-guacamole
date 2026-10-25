# Tiny Tiffin — Razorpay payment setup

This branch adds a server-side Razorpay checkout prototype for one-time purchases and monthly/yearly subscriptions. It is intentionally test-first. Do not enable live payments until the product terms, customer identity/access rules, refund process, and compliance requirements have been reviewed.

## What is included

- \`payments.html\` — checkout/pricing page; linked from the app header.
- \`payments.js\` — browser checkout using Razorpay Checkout; no secret keys in browser code.
- \`api/payment-config.js\` — exposes only public product display configuration.
- \`api/create-order.js\` — creates a one-time order using a server-configured amount.
- \`api/create-subscription.js\` — creates subscriptions against plan IDs created in Razorpay Dashboard.
- \`api/verify-payment.js\` — verifies HMAC signatures and checks order/payment/subscription data with Razorpay.
- \`api/razorpay-webhook.js\` — verifies webhook signatures over the raw request body and processes captured payments/subscription status events.
- \`payments-schema.sql\` — private Supabase tables for payment records and webhook deduplication.
- \`lib/payments.js\` — shared server-only helpers.

## 1. Configure Supabase

1. Create a Supabase project.
2. Open SQL Editor and run \`payments-schema.sql\`.
3. Copy the project URL and the **service_role** key from Project Settings → API.
4. The service-role key bypasses Row Level Security. Keep it only in Vercel server environment variables; never put it in frontend JavaScript, a public config file, or GitHub.

## 2. Configure Razorpay in Test Mode

1. Create/activate your Razorpay account and use **Test Mode**.
2. Copy the Test Key ID and Test Key Secret.
3. In Razorpay Dashboard, create two Plans for subscriptions: monthly and yearly. Use the intended pricing and billing interval. Copy each plan ID.
4. Configure a webhook URL after deploying the preview: \`https://YOUR-DOMAIN/api/razorpay-webhook\`.
5. Subscribe to at least \`payment.captured\`, \`subscription.authenticated\`, \`subscription.activated\`, \`subscription.charged\`, \`subscription.pending\`, \`subscription.halted\`, \`subscription.cancelled\`, \`subscription.completed\`, \`subscription.paused\`, and \`subscription.resumed\`.
6. Set a strong webhook secret. The webhook secret is separate from the Razorpay API Key Secret.

## 3. Add Vercel environment variables

In Vercel → Project → Settings → Environment Variables, set these for **Preview** first:

- \`RAZORPAY_KEY_ID\` — Test Key ID
- \`RAZORPAY_KEY_SECRET\` — Test Key Secret (server only)
- \`RAZORPAY_WEBHOOK_SECRET\` — webhook secret configured in Razorpay
- \`SUPABASE_URL\` — Supabase project URL
- \`SUPABASE_SERVICE_ROLE_KEY\` — Supabase service_role key (server only)
- \`TT_RECIPE_PACK_PRICE_PAISE\` — one-time recipe pack price in paise; for example, ₹99 is \`9900\`. Choose the actual price before enabling.
- \`RAZORPAY_PLAN_ID_MONTHLY\` — Razorpay monthly plan ID
- \`RAZORPAY_PLAN_ID_YEARLY\` — Razorpay yearly plan ID

Redeploy the Preview deployment after setting variables. The config endpoint reads subscription prices from Razorpay Plan records. The one-time product amount is always read from the server environment; the browser cannot set the amount.

## 4. Test

1. Open \`https://YOUR-PREVIEW-DOMAIN/payments.html\`.
2. Confirm the configured product prices match Razorpay Dashboard.
3. Use Razorpay's official test payment methods. Never use real card data in test mode.
4. Confirm a successful one-time payment returns a verified result and updates \`payment_orders.status\` to \`paid\`.
5. Confirm subscription events reach the webhook and update \`payment_subscriptions.status\`.
6. In Razorpay Dashboard, inspect webhook delivery attempts and retry failed deliveries.
7. Test canceled checkout, failed payment, invalid signature, wrong order, duplicate webhook, and missing environment variables.

## 5. Move to Live Mode

Only after tests pass, replace the Test Key ID/Secret with Live credentials, configure a Live webhook and separate Live webhook secret, and redeploy. Confirm your account is activated for the intended business model and payment methods.

## Important limitations before selling gated content

- This implementation records payments and subscription statuses but does **not** yet implement authenticated customer accounts or enforce entitlement checks for premium content. Do not advertise premium access as automatically unlocked until that is built.
- The checkout email is a contact/receipt field, not authentication. Do not use email alone as proof of account ownership.
- Subscription plan IDs and amounts must match the prices and terms displayed to customers. Review renewal, cancellation, refund, taxes, and customer support processes.
- The webhook is designed to be idempotent for event IDs and validates the Razorpay HMAC signature. Monitor webhook delivery and reconcile records with Razorpay.
- Add rate limiting/bot protection before production, and consider a support/admin reconciliation workflow.
