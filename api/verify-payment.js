const {
  razorpayRequest, dbRequest, verifyCheckoutSignature,
  verifySubscriptionSignature, jsonError
} = require("../lib/payments");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed");
  try {
    const body = req.body || {};
    if (body.kind === "subscription") {
      const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = body;
      if (!paymentId || !subscriptionId || !signature) return jsonError(res, 400, "Missing subscription verification fields.");

      const rows = await dbRequest("payment_subscriptions", "?subscription_id=eq." + encodeURIComponent(subscriptionId) + "&select=subscription_id,product_id,plan_id,buyer_email,status");
      const record = rows[0];
      if (!record) return jsonError(res, 404, "Subscription not found.");
      if (!verifySubscriptionSignature(paymentId, subscriptionId, signature)) return jsonError(res, 400, "Payment signature is invalid.");

      const [subscription, payment] = await Promise.all([
        razorpayRequest("/subscriptions/" + encodeURIComponent(subscriptionId)),
        razorpayRequest("/payments/" + encodeURIComponent(paymentId))
      ]);
      if (subscription.plan_id !== record.plan_id) return jsonError(res, 400, "Subscription plan mismatch.");
      if (payment.status !== "captured" && payment.status !== "authorized") return jsonError(res, 400, "Initial subscription payment is not verified.");
      if (payment.subscription_id && payment.subscription_id !== subscriptionId) return jsonError(res, 400, "Payment does not belong to this subscription.");

      await dbRequest("payment_subscriptions", "?subscription_id=eq." + encodeURIComponent(subscriptionId), {
        method: "PATCH",
        body: { status: subscription.status || "authenticated", last_payment_id: paymentId, updated_at: new Date().toISOString() }
      });
      return res.status(200).json({ verified: true, kind: "subscription", status: subscription.status || "authenticated", message: "Payment verified. Subscription access will follow the provider's activation status." });
    }

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (!orderId || !paymentId || !signature) return jsonError(res, 400, "Missing payment verification fields.");
    const rows = await dbRequest("payment_orders", "?order_id=eq." + encodeURIComponent(orderId) + "&select=order_id,product_id,amount_paise,currency,buyer_email,status,payment_id");
    const record = rows[0];
    if (!record) return jsonError(res, 404, "Order not found.");
    if (record.status === "paid" && record.payment_id === paymentId) {
      return res.status(200).json({ verified: true, kind: "one_time", productId: record.product_id, message: "Payment already verified." });
    }
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) return jsonError(res, 400, "Payment signature is invalid.");

    const [order, payment] = await Promise.all([
      razorpayRequest("/orders/" + encodeURIComponent(orderId)),
      razorpayRequest("/payments/" + encodeURIComponent(paymentId))
    ]);
    if (order.id !== record.order_id || order.amount !== Number(record.amount_paise) || order.currency !== record.currency) {
      return jsonError(res, 400, "Order details do not match our records.");
    }
    if (payment.order_id !== orderId || payment.amount !== Number(record.amount_paise) || payment.currency !== record.currency || payment.status !== "captured") {
      return jsonError(res, 400, "Payment is not captured or does not match this order.");
    }

    await dbRequest("payment_orders", "?order_id=eq." + encodeURIComponent(orderId), {
      method: "PATCH",
      body: { status: "paid", payment_id: paymentId, updated_at: new Date().toISOString() }
    });
    return res.status(200).json({ verified: true, kind: "one_time", productId: record.product_id, message: "Payment verified successfully." });
  } catch (error) {
    console.error("verify-payment failed:", error.message);
    return jsonError(res, 500, "Could not verify the payment. If money was deducted, contact support before trying again.");
  }
};
