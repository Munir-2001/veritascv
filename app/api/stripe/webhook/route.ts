/**
 * Stripe Webhook Handler
 * Handles subscription and payment events from Stripe
 * POST /api/stripe/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/config";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  // Check if user already has premium access (prevent duplicate payments)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_id")
    .eq("id", userId)
    .single();

  if (existingProfile?.subscription_tier === "premium") {
    // Check if this is a duplicate payment
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", session.payment_intent as string)
      .single();

    if (!existingPayment) {
      // User already has premium but this is a new payment - log it but don't upgrade again
      console.log(`[Webhook] User ${userId} already has premium, skipping upgrade for payment ${session.payment_intent}`);
      // Still record the payment for accounting purposes
      if (session.payment_intent) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent as string
        );
        await handlePaymentSucceeded(paymentIntent);
      }
    }
    return; // Don't process upgrade if already premium
  }

  // Handle one-time payments
  if (session.mode === "payment" && session.payment_status === "paid") {
    // Get payment intent
    if (session.payment_intent) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string
      );
      await handlePaymentSucceeded(paymentIntent);
    }

    // Update user profile for early adopter pack
    if (session.metadata?.planType === "early_adopter") {
      // Get or create subscription to get subscription_id
      let subscriptionId: string | null = null;
      
      if (session.customer) {
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        const subscriptionData = {
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string || null,
          stripe_price_id: null,
          status: "active",
          plan_type: "early_adopter",
          current_period_start: new Date().toISOString(),
          current_period_end: null,
          cancel_at_period_end: false,
        };

        if (existingSub) {
          const { data: updatedSub } = await supabase
            .from("subscriptions")
            .update(subscriptionData)
            .eq("id", existingSub.id)
            .select()
            .single();
          subscriptionId = updatedSub?.id || existingSub.id;
        } else {
          const { data: newSub } = await supabase
            .from("subscriptions")
            .insert(subscriptionData)
            .select()
            .single();
          subscriptionId = newSub?.id || null;
        }
      }

      // Update profile with premium access and 10 CVs per day (not unlimited)
      await supabase
        .from("profiles")
        .update({
          subscription_tier: "premium",
          unlimited_access: false, // Not unlimited, 10 CVs per day
          cv_generations_remaining: 10, // 10 CVs per day quota
          subscription_id: subscriptionId,
          user_status: "active", // Update status to active
        })
        .eq("id", userId);
    }
  }

  // Handle subscriptions
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await handleSubscriptionUpdate(subscription);
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.userId;

  if (!userId) {
    console.error("No userId in customer metadata");
    return;
  }

  // Determine plan type and tier
  const priceId = subscription.items.data[0]?.price.id;
  const planType = subscription.items.data[0]?.price.recurring?.interval || "monthly";
  const tier = planType === "annual" ? "premium" : "basic";

  // Update or create subscription in database
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    plan_type: planType,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  if (existingSub) {
    await supabase
      .from("subscriptions")
      .update(subscriptionData)
      .eq("id", existingSub.id);
  } else {
    const { data: newSub } = await supabase
      .from("subscriptions")
      .insert(subscriptionData)
      .select()
      .single();

    if (newSub) {
      // Update profile with subscription
      await supabase
        .from("profiles")
        .update({
          subscription_id: newSub.id,
          subscription_tier: tier,
          unlimited_access: tier === "premium",
          cv_generations_remaining: tier === "premium" ? -1 : 50,
        })
        .eq("id", userId);
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.userId;

  if (!userId) return;

  // Update subscription status
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
    })
    .eq("stripe_subscription_id", subscription.id);

  // Update profile to free tier
  await supabase
    .from("profiles")
    .update({
      subscription_tier: "free",
      unlimited_access: false,
      cv_generations_remaining: 3, // Give 3 free CVs
      subscription_id: null,
    })
    .eq("id", userId);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  if (!userId) return;

  // Update payment status
  await supabase
    .from("payments")
    .update({
      status: "succeeded",
      stripe_charge_id: paymentIntent.latest_charge as string,
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  // If it's a pay-per-use payment, add CV generations
  if (paymentIntent.metadata?.paymentType === "one_time") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_generations_remaining")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          cv_generations_remaining: (profile.cv_generations_remaining || 0) + 1,
        })
        .eq("id", userId);
    }
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  await supabase
    .from("payments")
    .update({
      status: "failed",
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);
}

