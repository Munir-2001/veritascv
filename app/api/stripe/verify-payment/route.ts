/**
 * Verify Payment and Update Database
 * For local testing when webhooks aren't available
 * GET /api/stripe/verify-payment?session_id=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id");
    const userId = searchParams.get("user_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed", payment_status: session.payment_status },
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
      // User already has premium - check if this is a duplicate payment
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id, status")
        .eq("stripe_payment_intent_id", session.payment_intent as string)
        .single();

      if (existingPayment) {
        // Already processed this specific payment
        return NextResponse.json({
          success: true,
          message: "Payment already processed",
          session_id: sessionId,
          already_premium: true,
        });
      }

      // User already has premium from a different payment - prevent duplicate
      return NextResponse.json({
        success: false,
        error: "User already has premium access",
        message: "You already have an active premium subscription. No additional payment needed.",
        session_id: sessionId,
      }, { status: 400 });
    }

    // Check if we've already processed this specific checkout session
    // Use checkout_session_id from metadata to track duplicates (works for both payment and subscription modes)
    // Query all payments for this user and check metadata in JavaScript (more reliable than JSONB query)
    const { data: allUserPayments } = await supabase
      .from("payments")
      .select("id, status, metadata")
      .eq("user_id", userId);
    
    const existingPaymentBySession = allUserPayments?.find(
      (p: any) => p.metadata?.checkout_session_id === sessionId
    );

    if (existingPaymentBySession) {
      // Already processed this checkout session
      console.log("⚠️ Payment already processed for this checkout session:", sessionId);
      // Still update profile if it wasn't updated before
      if (existingProfile?.subscription_tier !== "premium") {
        console.log("⚠️ Profile not premium, attempting to update...");
        // Will be handled below in the profile update section
      } else {
        return NextResponse.json({
          success: true,
          message: "Payment already processed",
          session_id: sessionId,
          payment_id: existingPaymentBySession.id,
        });
      }
    }

    // Also check by payment_intent if available
    if (session.payment_intent) {
      const { data: existingPaymentByIntent } = await supabase
        .from("payments")
        .select("id")
        .eq("stripe_payment_intent_id", session.payment_intent as string)
        .single();

      if (existingPaymentByIntent) {
        console.log("⚠️ Payment already processed for this payment intent:", session.payment_intent);
        // Still update profile if needed
        if (existingProfile?.subscription_tier !== "premium") {
          // Will be handled below
        } else {
          return NextResponse.json({
            success: true,
            message: "Payment already processed",
            session_id: sessionId,
            payment_id: existingPaymentByIntent.id,
          });
        }
      }
    }

    // Get payment intent details
    let paymentIntent;
    if (session.payment_intent) {
      paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string
      );
    }

    // Only create payment record if it doesn't already exist
    let payment;
    if (!existingPaymentBySession) {
      // Get payment intent if available (for one-time payments)
      let paymentIntentId = null;
      if (session.payment_intent) {
        paymentIntentId = session.payment_intent as string;
      } else if (session.subscription) {
        // For subscriptions, get the latest invoice's payment intent
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const latestInvoice = subscription.latest_invoice;
          if (latestInvoice && typeof latestInvoice === 'string') {
            const invoice = await stripe.invoices.retrieve(latestInvoice);
            paymentIntentId = invoice.payment_intent as string || null;
          }
        } catch (err) {
          console.log("Could not retrieve payment intent from subscription:", err);
        }
      }

      // Create payment record
      const paymentData: any = {
        user_id: userId,
        stripe_payment_intent_id: paymentIntentId, // May be null for subscriptions
        amount: session.amount_total || 0, // Amount in cents
        currency: session.currency || "eur",
        status: "succeeded",
        payment_type: session.mode === "payment" ? "one_time" : "subscription",
        description: session.metadata?.planType === "early_adopter" 
          ? "Early Adopter Pack" 
          : "Payment",
        metadata: {
          planType: session.metadata?.planType || "early_adopter",
          paymentType: session.mode === "payment" ? "one_time" : "subscription",
          checkout_session_id: sessionId, // Use this for duplicate detection
        },
      };

      const { data: newPayment, error: paymentError } = await supabase
        .from("payments")
        .insert(paymentData)
        .select()
        .single();

      if (paymentError) {
        console.error("❌ Error creating payment record:", paymentError);
        // Don't fail - continue with profile update
        payment = null;
      } else {
        payment = newPayment;
        console.log("✅ Payment record created:", payment.id);
      }
    } else {
      payment = existingPaymentBySession;
      console.log("ℹ️ Using existing payment record:", payment.id);
    }

    // Update user profile for ANY successful payment (early adopter pack or subscription)
    // Always update profile if payment succeeded, regardless of mode or plan type
    console.log("🔄 Processing profile update for successful payment");
    console.log("   Session mode:", session.mode);
    console.log("   Plan type from metadata:", session.metadata?.planType);
    
    // Update or create subscription record first to get subscription_id
    let subscriptionId: string | null = null;
      
      if (session.customer) {
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        // Determine plan type - use "early_adopter" for one-time payments, or use metadata planType
        const planType = session.mode === "payment" 
          ? "early_adopter"  // One-time payment = early adopter pack
          : (session.metadata?.planType || "early_adopter");  // Subscription = use metadata or default
        
        const subscriptionData = {
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string || null,
          stripe_price_id: session.metadata?.priceId || null,
          status: "active",
          plan_type: planType,
          current_period_start: new Date().toISOString(),
          current_period_end: null, // One-time payment, no period (or subscription period if applicable)
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        };
        
        console.log("   Subscription data:", {
          plan_type: planType,
          stripe_subscription_id: subscriptionData.stripe_subscription_id,
          status: subscriptionData.status,
        });

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
      console.log("🔄 Updating profile for user:", userId);
      console.log("   Subscription ID:", subscriptionId);
      
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({
          subscription_tier: "premium",
          unlimited_access: false, // Not unlimited, 10 CVs per day
          cv_generations_remaining: 10, // 10 CVs per day quota
          subscription_id: subscriptionId,
          user_status: "active", // Update status to active
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (profileError) {
        console.error("❌ Error updating profile:", profileError);
        console.error("   Error details:", JSON.stringify(profileError, null, 2));
        return NextResponse.json(
          { 
            error: "Payment processed but profile update failed", 
            details: profileError.message,
            payment_id: payment?.id,
          },
          { status: 500 }
        );
      }
      
      // Verify the update worked
      if (!updatedProfile) {
        console.error("❌ Profile update returned no data, fetching again...");
        // Try to fetch it again
        const { data: fetchedProfile } = await supabase
          .from("profiles")
          .select("subscription_tier, unlimited_access, cv_generations_remaining, subscription_id, user_status")
          .eq("id", userId)
          .single();
        
        if (fetchedProfile) {
          console.log("✅ Profile fetched after update:", fetchedProfile);
          return NextResponse.json({
            success: true,
            message: "Payment verified and database updated",
            session_id: sessionId,
            payment_id: payment?.id,
            profile_updated: fetchedProfile,
          });
        } else {
          return NextResponse.json(
            { 
              error: "Payment processed but could not verify profile update", 
              payment_id: payment?.id,
            },
            { status: 500 }
          );
        }
      }
      
      console.log("✅ Profile updated successfully:", {
        subscription_tier: updatedProfile.subscription_tier,
        cv_generations_remaining: updatedProfile.cv_generations_remaining,
        unlimited_access: updatedProfile.unlimited_access,
        subscription_id: updatedProfile.subscription_id,
        user_status: updatedProfile.user_status,
      });
      
      return NextResponse.json({
        success: true,
        message: "Payment verified and database updated",
        session_id: sessionId,
        payment_id: payment?.id,
        profile_updated: {
          subscription_tier: updatedProfile.subscription_tier,
          unlimited_access: updatedProfile.unlimited_access,
          cv_generations_remaining: updatedProfile.cv_generations_remaining,
          subscription_id: updatedProfile.subscription_id,
          user_status: updatedProfile.user_status,
        },
      });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}

