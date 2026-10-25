(function () {
  "use strict";
  const productsEl = document.getElementById("payment-products");
  const emailEl = document.getElementById("buyer-email");
  const statusEl = document.getElementById("payment-status");

  function status(message, kind) {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind || "info";
  }
  function formatMoney(amount, currency) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(Number(amount) / 100);
  }
  function button(text, handler) {
    const el = document.createElement("button");
    el.className = "payment-button";
    el.type = "button";
    el.textContent = text;
    el.addEventListener("click", handler);
    return el;
  }
  function validEmail() {
    const email = emailEl.value.trim();
    if (!emailEl.checkValidity() || !email) {
      emailEl.focus();
      status("Enter a valid email address before continuing.", "error");
      return null;
    }
    return email;
  }
  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
    return data;
  }
  async function verifyPayment(payload) {
    status("Verifying your payment securely…", "info");
    const result = await postJson("/api/verify-payment", payload);
    if (!result.verified) throw new Error("The server could not verify this payment.");
    status(result.message || "Payment verified.", "success");
  }

  async function buy(product) {
    const email = validEmail();
    if (!email) return;
    try {
      status("Preparing secure checkout…", "info");
      const isSubscription = product.type === "subscription";
      const data = await postJson(isSubscription ? "/api/create-subscription" : "/api/create-order", {
        productId: product.id,
        email
      });
      if (typeof window.Razorpay !== "function") throw new Error("Razorpay Checkout could not load. Check your connection and try again.");

      const options = {
        key: data.keyId,
        name: "Tiny Tiffin",
        description: data.productName || product.name,
        prefill: { email },
        theme: { color: "#2B4E32" },
        modal: { ondismiss: function () { status("Checkout was closed. No confirmation was received.", "info"); } },
        handler: async function (response) {
          try {
            if (isSubscription) {
              await verifyPayment({
                kind: "subscription",
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id || data.subscriptionId,
                razorpay_signature: response.razorpay_signature
              });
            } else {
              await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });
            }
          } catch (error) {
            status(error.message + " If money was deducted, keep the Razorpay payment ID and contact support.", "error");
          }
        }
      };
      if (isSubscription) options.subscription_id = data.subscriptionId;
      else {
        options.order_id = data.orderId;
        options.amount = data.amount;
        options.currency = data.currency;
      }
      const checkout = new window.Razorpay(options);
      checkout.on("payment.failed", function (response) {
        const description = response.error && response.error.description;
        status("Payment was not completed. " + (description || "Please try again."), "error");
      });
      checkout.open();
    } catch (error) {
      status(error.message || "Could not start checkout.", "error");
    }
  }

  async function init() {
    try {
      const response = await fetch("/api/payment-config", { cache: "no-store" });
      const config = await response.json();
      productsEl.replaceChildren();
      if (!response.ok || !config.ready || !Array.isArray(config.products) || config.products.length === 0) {
        const message = document.createElement("p");
        message.className = "payment-muted";
        message.textContent = "Checkout is not configured yet. The site owner must configure Razorpay test keys, product prices or plan IDs, and the private payment database in Vercel.";
        productsEl.appendChild(message);
        status("Test and live payments remain disabled until server configuration is complete.", "info");
        return;
      }
      config.products.forEach(function (product) {
        const card = document.createElement("article");
        card.className = "payment-card";
        const title = document.createElement("h2");
        title.className = "payment-title";
        title.textContent = product.name;
        const price = document.createElement("div");
        price.className = "payment-price";
        price.textContent = formatMoney(product.amount, product.currency) + (product.type === "subscription" ? (product.id === "premium_monthly" ? " / month" : " / year") : " one time");
        const detail = document.createElement("p");
        detail.className = "payment-muted";
        detail.textContent = product.type === "subscription" ? "Recurring billing managed by Razorpay. Cancelation and renewal terms should be reviewed before purchase." : "One-time purchase.";
        card.append(title, price, detail, button("Continue to secure checkout", function () { buy(product); }));
        productsEl.appendChild(card);
      });
    } catch (error) {
      productsEl.textContent = "Could not load payment options. Please try again later.";
      status("Payment configuration could not be loaded.", "error");
    }
  }
  init();
})();
