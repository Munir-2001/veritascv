/**
 * Create Stripe Checkout Session
 * Supports both subscriptions and one-time payments
 * POST /api/stripe/create-checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, priceId, planType, paymentMode = "payment" } = body; // paymentMode: "payment" or "subscription"

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user already has premium access (prevent duplicate payments)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_id")
      .eq("id", userId)
      .single();

    if (existingProfile?.subscription_tier === "premium") {
      return NextResponse.json(
        { 
          error: "User already has premium access",
          message: "You already have an active premium subscription. No additional payment needed.",
        },
        { status: 400 }
      );
    }

    // If no priceId provided, use early adopter price
    const finalPriceId = priceId || STRIPE_PRICE_IDS.EARLY_ADOPTER;

    // Validate price ID
    const validPriceIds = Object.values(STRIPE_PRICE_IDS).filter(Boolean);
    if (!finalPriceId || !validPriceIds.includes(finalPriceId)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      const envVarName = isDevelopment 
        ? "STRIPE_PRICE_ID_EARLY_ADOPTER_TEST" 
        : "STRIPE_PRICE_ID_EARLY_ADOPTER";
      return NextResponse.json(
        { 
          error: `Invalid price ID. Please set ${envVarName} in environment variables.`,
          hint: isDevelopment 
            ? "You're in development mode - make sure you're using a TEST price ID (starts with price_... from Test mode in Stripe Dashboard)"
            : "You're in production mode - make sure you're using a LIVE price ID (starts with price_... from Live mode in Stripe Dashboard)"
        },
        { status: 400 }
      );
    }

    // Check if price ID matches the current mode (test vs live)
    const isDevelopment = process.env.NODE_ENV === "development";
    const isTestKey = process.env.STRIPE_SECRET_KEY_TEST?.startsWith("sk_test_") || 
                      (!process.env.STRIPE_SECRET_KEY_TEST && process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
    const isTestPrice = finalPriceId.startsWith("price_") && finalPriceId.length > 20; // Test prices typically have longer IDs
    
    // Try to retrieve the price to verify it exists in the current mode
    try {
      const price = await stripe.prices.retrieve(finalPriceId);
      // If we get here, the price exists - but we should still warn if there's a mismatch
      if (isDevelopment && !isTestKey && finalPriceId.includes("test")) {
        console.warn(`[Stripe] ⚠️ Using test price ID with live keys in development mode`);
      }
    } catch (priceError: any) {
      // Price doesn't exist or is in wrong mode
      if (priceError.message?.includes("similar object exists in live mode")) {
        return NextResponse.json(
          { 
            error: "Price ID mismatch: You're using a LIVE price ID with TEST keys.",
            hint: "In development mode, you need to use a TEST price ID. Get it from Stripe Dashboard → Products → Your Product → Test mode → Copy Price ID",
            solution: "Set STRIPE_PRICE_ID_EARLY_ADOPTER_TEST in your .env.local with a test price ID (starts with price_... from Test mode)"
          },
          { status: 400 }
        );
      } else if (priceError.message?.includes("similar object exists in test mode")) {
        return NextResponse.json(
          { 
            error: "Price ID mismatch: You're using a TEST price ID with LIVE keys.",
            hint: "In production mode, you need to use a LIVE price ID. Get it from Stripe Dashboard → Products → Your Product → Live mode → Copy Price ID"
          },
          { status: 400 }
        );
      }
      // Re-throw other errors
      throw priceError;
    }

    // Get or create Stripe customer
    let customerId: string;
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (subscription?.stripe_customer_id) {
      // Try to retrieve the existing customer
      // If it fails (e.g., customer exists in different mode), create a new one
      try {
        const existingCustomer = await stripe.customers.retrieve(subscription.stripe_customer_id);
        customerId = existingCustomer.id;
      } catch (customerError: any) {
        // Customer doesn't exist in current mode (test/live mismatch)
        // Create a new customer in the current mode
        console.log(`[Stripe] Customer ${subscription.stripe_customer_id} not found in current mode, creating new customer`);
        
        // Get user email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .single();

        // Create new Stripe customer in current mode
        const customer = await stripe.customers.create({
          email: profile?.email || undefined,
          metadata: {
            userId,
          },
        });

        customerId = customer.id;

        // Update database with new customer ID
        await supabase
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId);
      }
    } else {
      // Get user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: profile?.email || undefined,
        metadata: {
          userId,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await supabase.from("subscriptions").insert({
        user_id: userId,
        stripe_customer_id: customerId,
        status: "incomplete",
      });
    }

    // Fetch the price to check if it's recurring or one-time
    let priceMode: "payment" | "subscription" = "payment"; // Default to one-time
    try {
      const price = await stripe.prices.retrieve(finalPriceId);
      // If price has recurring property, it's a subscription
      if (price.recurring) {
        priceMode = "subscription";
      } else {
        priceMode = "payment";
      }
    } catch (priceError) {
      console.error("Error fetching price:", priceError);
      // Fallback: use explicit paymentMode or default to payment
      priceMode = paymentMode === "subscription" ? "subscription" : "payment";
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: priceMode,
      success_url: `${request.headers.get("origin") || "http://localhost:3000"}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get("origin") || "http://localhost:3000"}/dashboard?canceled=true`,
      metadata: {
        userId,
        planType: planType || (priceMode === "payment" ? "early_adopter" : "early_adopter"), // Always use early_adopter for Early Adopter Pack
        paymentType: priceMode === "payment" ? "one_time" : "subscription",
        priceId: finalPriceId, // Include price ID for reference
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

