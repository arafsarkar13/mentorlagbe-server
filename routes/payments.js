const express = require("express");
const Stripe = require("stripe");
const { getDb } = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Pro plan prices (in US dollars) for each role
const PLANS = {
  tutor: { name: "Pro Tutor Plan", amount: 15, description: "Unlimited tuition posts and a verified tutor badge" },
  student: { name: "Pro Student Plan", amount: 10, description: "Priority booking for tuition applications" },
};

// Creates the Stripe connection the first time it is needed
let stripeClient;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

// The first URL in CLIENT_URL is where Stripe sends the user back
function clientUrl() {
  return (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/+$/, "");
}

// Saves a paid checkout session and upgrades the user.
// It is safe to call twice (webhook + success page), so a payment is never saved twice.
async function recordPayment(session) {
  const db = await getDb();
  const meta = session.metadata || {};

  const payment = {
    userEmail: meta.userEmail,
    userName: meta.userName,
    userRole: meta.userRole,
    planName: meta.planName,
    amount: session.amount_total / 100,
    currency: session.currency,
    transactionId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id,
    stripeSessionId: session.id,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  // Insert only if this session has not been saved yet
  await db
    .collection("payments")
    .updateOne({ stripeSessionId: session.id }, { $setOnInsert: payment }, { upsert: true });

  await db.collection("users").updateOne({ email: meta.userEmail }, { $set: { plan: "pro" } });
  return payment;
}

// POST /api/payments/checkout -> start a Stripe Checkout for the Pro plan
router.post("/checkout", verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: req.user.email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Admins do not need a plan" });
    if (user.plan === "pro") return res.status(400).json({ message: "You are already on the Pro plan" });

    const plan = PLANS[user.role];
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.amount * 100, // Stripe uses cents
            product_data: { name: plan.name, description: plan.description },
          },
        },
      ],
      metadata: {
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        planName: plan.name,
      },
      success_url: `${clientUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl()}/payment/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not start the payment. Please try again." });
  }
});

// GET /api/payments/verify?session_id=... -> called by the success page.
// Works even if the webhook is slow, because it asks Stripe directly.
router.get("/verify", verifyToken, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ message: "Missing session id" });

    const session = await getStripe().checkout.sessions.retrieve(session_id);

    if (session.metadata?.userEmail !== req.user.email) {
      return res.status(403).json({ message: "This payment belongs to another account" });
    }
    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment is not completed" });
    }

    await recordPayment(session);
    res.json({ message: "Payment confirmed", planName: session.metadata.planName });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not verify the payment" });
  }
});

// Stripe webhook. It needs the RAW request body, so index.js attaches it before express.json().
async function webhook(req, res) {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    // Wrong signature: the request did not come from Stripe
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    try {
      if (event.data.object.payment_status === "paid") {
        await recordPayment(event.data.object);
      }
    } catch (error) {
      console.error(error);
      return res.status(500).send("Could not save the payment");
    }
  }

  res.json({ received: true });
}

module.exports = { router, webhook, getStripe };
