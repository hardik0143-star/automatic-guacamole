const { razorpayRequest, jsonError } = require("../lib/payments");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed");
  try {
    const oneTimePaise = Number(process.env.TT_RECIPE_PACK_PRICE_PAISE || 0);
    const monthlyPlanId = process.env.RAZORPAY_PLAN_ID_MONTHLY || "";
    const yearlyPlanId = process.env.RAZORPAY_PLAN_ID_YEARLY || "";
    const hasDatabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const hasKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    const products = [];

    if (oneTimePaise > 0 && Number.isSafeInteger(oneTimePaise)) {
      products.push({ id: "recipe_pack", type: "one_time", name: "Tiny Tiffin Recipe Pack", amount: oneTimePaise, currency: "INR" });
    }
    for (const [key, planId, name] of [
      ["premium_monthly", monthlyPlanId, "Tiny Tiffin Premium — Monthly"],
      ["premium_yearly", yearlyPlanId, "Tiny Tiffin Premium — Yearly"]
    ]) {
      if (!planId) continue;
      const plan = await razorpayRequest("/plans/" + encodeURIComponent(planId));
      const item = plan.item || {};
      if (!Number.isSafeInteger(Number(item.amount)) || Number(item.amount) <= 0) continue;
      products.push({
        id: key,
        type: "subscription",
        name,
        planId,
        amount: Number(item.amount),
        currency: item.currency || "INR",
        interval: plan.period || null,
        intervalCount: plan.interval || 1
      });
    }
    return res.status(200).json({
      keyId: hasKeys ? process.env.RAZORPAY_KEY_ID : null,
      ready: hasKeys && hasDatabase && products.length > 0,
      databaseConfigured: hasDatabase,
      products
    });
  } catch (error) {
    console.error("payment-config failed:", error.message);
    return jsonError(res, 503, "Payments are not configured yet. Please try again later.");
  }
};
