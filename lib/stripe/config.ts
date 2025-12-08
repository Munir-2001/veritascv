/**
 * Stripe Configuration
 * Automatically uses test keys in development mode and live keys in production
 */

import Stripe from "stripe";

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === "development";

// Select keys based on environment
// In development: use test keys (STRIPE_SECRET_KEY_TEST, etc.)
// In production: use live keys (STRIPE_SECRET_KEY, etc.)
const STRIPE_SECRET_KEY = isDevelopment
  ? process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY
  : process.env.STRIPE_SECRET_KEY;

const STRIPE_PUBLISHABLE_KEY = isDevelopment
  ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_SECRET_KEY) {
  const keyType = isDevelopment ? "STRIPE_SECRET_KEY_TEST (or STRIPE_SECRET_KEY)" : "STRIPE_SECRET_KEY";
  throw new Error(`${keyType} is not set in environment variables`);
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia" as any, // Use latest API version
  typescript: true,
});

// Price IDs from environment variables (test or live based on environment)
export const STRIPE_PRICE_IDS = {
  MONTHLY: isDevelopment
    ? process.env.STRIPE_PRICE_ID_MONTHLY_TEST || process.env.STRIPE_PRICE_ID_MONTHLY || ""
    : process.env.STRIPE_PRICE_ID_MONTHLY || "",
  ANNUAL: isDevelopment
    ? process.env.STRIPE_PRICE_ID_ANNUAL_TEST || process.env.STRIPE_PRICE_ID_ANNUAL || ""
    : process.env.STRIPE_PRICE_ID_ANNUAL || "",
  PAY_PER_USE: isDevelopment
    ? process.env.STRIPE_PRICE_ID_PAY_PER_USE_TEST || process.env.STRIPE_PRICE_ID_PAY_PER_USE || ""
    : process.env.STRIPE_PRICE_ID_PAY_PER_USE || "",
  EARLY_ADOPTER: isDevelopment
    ? process.env.STRIPE_PRICE_ID_EARLY_ADOPTER_TEST || process.env.STRIPE_PRICE_ID_EARLY_ADOPTER || ""
    : process.env.STRIPE_PRICE_ID_EARLY_ADOPTER || "",
};

// Export the publishable key for client-side use
export const STRIPE_PUBLISHABLE_KEY_EXPORT = STRIPE_PUBLISHABLE_KEY;

// Log which mode we're using (only in development)
if (isDevelopment) {
  const usingTestKeys = STRIPE_SECRET_KEY?.startsWith("sk_test_");
  console.log(`[Stripe] Using ${usingTestKeys ? "TEST" : "LIVE"} keys (NODE_ENV=development)`);
  if (!usingTestKeys) {
    console.warn("[Stripe] ⚠️ WARNING: Using LIVE keys in development mode! Consider setting STRIPE_SECRET_KEY_TEST");
  }
}

// Subscription tiers
export type SubscriptionTier = "free" | "basic" | "premium";

export const SUBSCRIPTION_LIMITS = {
  free: {
    cvGenerations: 3, // 3 free CVs
    unlimited: false,
  },
  basic: {
    cvGenerations: 50, // 50 CVs per month
    unlimited: false,
  },
  premium: {
    cvGenerations: -1, // Unlimited
    unlimited: true,
  },
};

