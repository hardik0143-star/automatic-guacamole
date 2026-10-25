const crypto = require("node:crypto");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function razorpayAuth() {
  const keyId = requiredEnv("RAZORPAY_KEY_ID");
  const keySecret = requiredEnv("RAZORPAY_KEY_SECRET");
  return {
    keyId,
    keySecret,
    authorization: "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64")
  };
}

async function razorpayRequest(path, options = {}) {
  const { authorization } = razorpayAuth();
  const response = await fetch("https://api.razorpay.com/v1" + path, {
    ...options,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.description || "Razorpay request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function supabaseConfig() {
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    key: requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

async function dbRequest(table, query = "", options = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(url + "/rest/v1/" + table + query, {
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error("Payment database request failed (" + response.status + "): " + text.slice(0, 300));
  }
  return text ? JSON.parse(text) : [];
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { keySecret } = razorpayAuth();
  return safeEqualHex(hmacHex(keySecret, orderId + "|" + paymentId), signature);
}

function verifySubscriptionSignature(paymentId, subscriptionId, signature) {
  const { keySecret } = razorpayAuth();
  return safeEqualHex(hmacHex(keySecret, paymentId + "|" + subscriptionId), signature);
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = requiredEnv("RAZORPAY_WEBHOOK_SECRET");
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

function validEmail(email) {
  return typeof email === "string" && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = {
  requiredEnv, razorpayAuth, razorpayRequest, dbRequest,
  verifyCheckoutSignature, verifySubscriptionSignature, verifyWebhookSignature,
  validEmail, jsonError
};
