const { dbRequest, verifyWebhookSignature, jsonError } = require("../lib/payments");

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed");
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || !verifyWebhookSignature(rawBody, signature)) return jsonError(res, 400, "Invalid webhook signature.");

    const eventId = req.headers["x-razorpay-event-id"];
    const payload = JSON.parse(rawBody.toString("utf8"));
    const event = payload.event || "unknown";
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    const subscription = payload.payload?.subscription?.entity;
    const entityId = payment?.id || order?.id || subscription?.id || null;

    if (eventId) {
      await dbRequest("payment_webhook_events", "?on_conflict=event_id", {
        method: "POST",
        prefer: "resolution=ignore-duplicates,return=minimal",
        body: [{ event_id: eventId, event_name: event, entity_id: entityId }]
      });
    }

    if (event === "payment.captured" && payment?.order_id) {
      const rows = await dbRequest("payment_orders", "?order_id=eq." + encodeURIComponent(payment.order_id) + "&select=order_id,amount_paise,currency,status");
      const record = rows[0];
      if (record && Number(record.amount_paise) === Number(payment.amount) && record.currency === payment.currency && payment.status === "captured") {
        await dbRequest("payment_orders", "?order_id=eq." + encodeURIComponent(payment.order_id), {
          method: "PATCH",
          body: { status: "paid", payment_id: payment.id, updated_at: new Date().toISOString() }
        });
      }
    }

    if (subscription?.id && [
      "subscription.authenticated", "subscription.activated", "subscription.charged",
      "subscription.pending", "subscription.halted", "subscription.cancelled",
      "subscription.completed", "subscription.paused", "subscription.resumed"
    ].includes(event)) {
      const status = subscription.status || event.split(".")[1];
      await dbRequest("payment_subscriptions", "?subscription_id=eq." + encodeURIComponent(subscription.id), {
        method: "PATCH",
        body: { status, last_payment_id: payment?.id || undefined, updated_at: new Date().toISOString() }
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("razorpay-webhook failed:", error.message);
    return jsonError(res, 500, "Webhook processing failed.");
  }
};
