const { razorpayRequest, dbRequest, validEmail, jsonError } = require("../lib/payments");

const planEnv = {
  premium_monthly: "RAZORPAY_PLAN_ID_MONTHLY",
  premium_yearly: "RAZORPAY_PLAN_ID_YEARLY"
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed");
  try {
    const { productId, email } = req.body || {};
    if (!validEmail(email)) return jsonError(res, 400, "Enter a valid email address.");
    const envName = planEnv[productId];
    if (!envName) return jsonError(res, 400, "Unknown subscription plan.");
    const planId = process.env[envName];
    if (!planId) return jsonError(res, 503, "This subscription plan is not configured yet.");

    const subscription = await razorpayRequest("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: productId === "premium_monthly" ? 120 : 10,
        quantity: 1,
        customer_notify: 1,
        notes: { app: "tiny-tiffin", product_id: productId, buyer_email: email.toLowerCase() }
      })
    });

    await dbRequest("payment_subscriptions", "?on_conflict=subscription_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [{
        subscription_id: subscription.id,
        product_id: productId,
        plan_id: planId,
        buyer_email: email.toLowerCase(),
        status: subscription.status || "created"
      }]
    });

    return res.status(200).json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      productName: productId === "premium_monthly" ? "Tiny Tiffin Premium — Monthly" : "Tiny Tiffin Premium — Yearly"
    });
  } catch (error) {
    console.error("create-subscription failed:", error.message);
    return jsonError(res, 500, "Could not start subscription checkout. Please try again.");
  }
};
