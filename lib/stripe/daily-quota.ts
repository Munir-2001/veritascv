/**
 * Daily CV Generation Quota Management
 * Tracks and enforces daily CV generation limits
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  dailyLimit: number;
  resetTime?: Date;
  message?: string;
}

/**
 * Get daily CV generation limit for a user based on their subscription tier
 */
export function getDailyLimit(subscriptionTier?: string, unlimitedAccess?: boolean): number {
  if (unlimitedAccess) {
    return -1; // Unlimited
  }

  switch (subscriptionTier) {
    case "premium":
      return 10; // 10 CVs per day for premium
    case "basic":
      return 5; // 5 CVs per day for basic
    case "free":
    default:
      return 3; // 3 CVs per day for free tier
  }
}

/**
 * Check if user can generate a CV today
 * Returns remaining quota and whether generation is allowed
 */
export async function checkDailyQuota(userId: string): Promise<QuotaCheckResult> {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier, unlimited_access, cv_generations_remaining")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return {
        allowed: false,
        remaining: 0,
        dailyLimit: 0,
        message: "User profile not found",
      };
    }

    const dailyLimit = getDailyLimit(profile.subscription_tier, profile.unlimited_access);

    // Unlimited access - always allow
    if (dailyLimit === -1) {
      return {
        allowed: true,
        remaining: -1,
        dailyLimit: -1,
        message: "Unlimited access",
      };
    }

    // Get today's date (UTC, start of day)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const todayEndISO = todayEnd.toISOString();

    // Count CVs generated today (from job_applications table)
    const { count: todayCount, error: countError } = await supabase
      .from("job_applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart)
      .lte("created_at", todayEndISO);

    if (countError) {
      console.error("Error counting today's CVs:", countError);
      // Allow generation if we can't count (fail open)
      return {
        allowed: true,
        remaining: dailyLimit - (todayCount || 0),
        dailyLimit,
        message: "Could not verify quota, allowing generation",
      };
    }

    const used = todayCount || 0;
    const remaining = Math.max(0, dailyLimit - used);
    const allowed = remaining > 0;

    // Calculate reset time (midnight UTC tomorrow)
    const resetTime = new Date(today);
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);

    return {
      allowed,
      remaining,
      dailyLimit,
      resetTime,
      message: allowed
        ? `You have ${remaining} CV generation${remaining === 1 ? "" : "s"} remaining today`
        : `Daily limit reached (${dailyLimit} CVs per day). Resets at midnight UTC.`,
    };
  } catch (error: any) {
    console.error("Error checking daily quota:", error);
    // Fail open - allow generation if check fails
    return {
      allowed: true,
      remaining: 10,
      dailyLimit: 10,
      message: "Quota check failed, allowing generation",
    };
  }
}

/**
 * Record a CV generation (called after successful generation)
 */
export async function recordCVGeneration(userId: string): Promise<void> {
  try {
    // The CV generation is already recorded in job_applications table
    // This function is for future use if we need separate tracking
    // For now, we rely on job_applications.created_at for daily counting
    console.log(`[Quota] CV generation recorded for user ${userId}`);
  } catch (error: any) {
    console.error("Error recording CV generation:", error);
    // Don't throw - this is just for tracking
  }
}

