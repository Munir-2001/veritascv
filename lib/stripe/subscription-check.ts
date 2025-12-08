/**
 * Subscription Check Utilities
 * 
 * Functions to check user subscription status and limits
 */

import { createClient } from "@supabase/supabase-js";
import { SubscriptionTier, SUBSCRIPTION_LIMITS } from "./config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  tier: SubscriptionTier;
  cvGenerationsRemaining: number;
  unlimited: boolean;
  subscriptionId?: string;
  subscriptionEndDate?: Date;
}

/**
 * Check user's subscription status
 */
export async function checkSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier, cv_generations_remaining, unlimited_access, subscription_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return {
        hasActiveSubscription: false,
        tier: "free",
        cvGenerationsRemaining: SUBSCRIPTION_LIMITS.free.cvGenerations,
        unlimited: false,
      };
    }

    // If user has unlimited access, return early
    if (profile.unlimited_access) {
      return {
        hasActiveSubscription: true,
        tier: "premium",
        cvGenerationsRemaining: -1,
        unlimited: true,
        subscriptionId: profile.subscription_id || undefined,
      };
    }

    // Check active subscription
    if (profile.subscription_id) {
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, plan_type")
        .eq("id", profile.subscription_id)
        .single();

      if (!subError && subscription) {
        const isActive = ["active", "trialing"].includes(subscription.status);
        const tier = profile.subscription_tier as SubscriptionTier || "free";

        return {
          hasActiveSubscription: isActive,
          tier,
          cvGenerationsRemaining: profile.cv_generations_remaining || 0,
          unlimited: false,
          subscriptionId: profile.subscription_id,
          subscriptionEndDate: subscription.current_period_end
            ? new Date(subscription.current_period_end)
            : undefined,
        };
      }
    }

    // Default to free tier
    return {
      hasActiveSubscription: false,
      tier: (profile.subscription_tier as SubscriptionTier) || "free",
      cvGenerationsRemaining: profile.cv_generations_remaining || SUBSCRIPTION_LIMITS.free.cvGenerations,
      unlimited: false,
    };
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return {
      hasActiveSubscription: false,
      tier: "free",
      cvGenerationsRemaining: SUBSCRIPTION_LIMITS.free.cvGenerations,
      unlimited: false,
    };
  }
}

/**
 * Check if user can generate a CV
 */
export async function canGenerateCV(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
}> {
  const status = await checkSubscriptionStatus(userId);

  // Unlimited access
  if (status.unlimited) {
    return { allowed: true };
  }

  // Check remaining generations
  if (status.cvGenerationsRemaining > 0) {
    return {
      allowed: true,
      remaining: status.cvGenerationsRemaining,
    };
  }

  // No remaining generations
  return {
    allowed: false,
    reason: "No CV generations remaining. Please upgrade your plan.",
    remaining: 0,
  };
}

/**
 * Decrement CV generations remaining
 */
export async function decrementCVGenerations(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_generations_remaining, unlimited_access")
      .eq("id", userId)
      .single();

    if (!profile) return false;

    // Don't decrement if unlimited
    if (profile.unlimited_access) {
      return true;
    }

    // Decrement if > 0
    if (profile.cv_generations_remaining > 0) {
      const { error } = await supabase
        .from("profiles")
        .update({
          cv_generations_remaining: profile.cv_generations_remaining - 1,
        })
        .eq("id", userId);

      return !error;
    }

    return false;
  } catch (error) {
    console.error("Error decrementing CV generations:", error);
    return false;
  }
}

