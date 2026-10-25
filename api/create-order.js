const { razorpayRequest, dbRequest, validEmail, jsonError } = require("../lib/payments");

const products = {
  recipe_pack: {
    name: "Tiny Tiffin Recipe Pack",
    amount: () => Number(process.env.TT_RECIPE_PACK_PRICE_PAISE || 0)
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed");
  try {
    const { productId, email } = req.body || {};
    if (!validEmail(email)) return jsonError(res, 400, "Enter a valid email address.");
    const product = products[productId];
    if (!product) return jsonError(res, 400, "Unknown one-time product.");
    const amount = product.amount();
    if (!Number.isSafeInteger(amount) || amount < 100) return jsonError(res, 503, "This product is not configured for purchase yet.");

    const order = await razorpayRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: "tt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
        notes: { app: "tiny-tiffin", product_id: productId, buyer_email: email }
      })
    });

    await dbRequest("payment_orders", "?on_conflict=order_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [{
        order_id: order.id,
        product_id: productId,
        amount_paise: amount,
        currency: "INR",
        buyer_email: email.toLowerCase(),
        status: "created"
      }]
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      productName: product.name
    });
  } catch (error) {
    console.error("create-order failed:", error.message);
    return jsonError(res, 500, "Could not start checkout. Please try again.");
  }
};
