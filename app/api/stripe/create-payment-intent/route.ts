/**
 * Create Stripe Payment Intent for One-Time Payments
 * POST /api/stripe/create-payment-intent
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
    const { userId, amount, description } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Default amount if not provided (e.g., pay-per-use CV generation)
    const paymentAmount = amount || 500; // $5.00 in cents

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

      // Save customer ID
      await supabase.from("subscriptions").insert({
        user_id: userId,
        stripe_customer_id: customerId,
        status: "incomplete",
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: "usd",
      customer: customerId,
      description: description || "CV Generation",
      metadata: {
        userId,
        paymentType: "one_time",
      },
    });

    // Save payment intent to database
    await supabase.from("payments").insert({
      user_id: userId,
      stripe_payment_intent_id: paymentIntent.id,
      amount: paymentAmount,
      status: "pending",
      payment_type: "one_time",
      description: description || "CV Generation",
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

