import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: POST /api/profiles/sync
 * 
 * Syncs the user's profile with their actual resume data.
 * Useful if a resume was uploaded but the profile wasn't updated.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user has any resumes - get ALL resumes to ensure we find them
    const { data: resumesData, error: resumesError } = await supabase
      .from("resumes")
      .select("id, parsed_at, file_path, user_id")
      .eq("user_id", user_id)
      .order("parsed_at", { ascending: false });

    if (resumesError) {
      console.error("Resumes fetch error:", resumesError);
      return NextResponse.json(
        { error: "Failed to fetch resumes", details: resumesError.message },
        { status: 500 }
      );
    }

    const hasResume = resumesData && resumesData.length > 0;
    const latestResume = hasResume ? resumesData[0] : null;

    console.log(`[Sync] User ${user_id}: Found ${resumesData?.length || 0} resume(s)`);

    // Get current profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    // Determine if we need to update the profile
    const needsUpdate = hasResume && (!profileData || !profileData.has_uploaded_resume);
    const needsResumeIdUpdate = hasResume && profileData && profileData.resume_id !== latestResume?.id;

    if (needsUpdate || needsResumeIdUpdate) {
      console.log(`[Sync] Updating profile for user ${user_id}: hasResume=${hasResume}, needsUpdate=${needsUpdate}, needsResumeIdUpdate=${needsResumeIdUpdate}`);
      
      const updateData: any = {
        id: user_id,
        has_uploaded_resume: hasResume,
        resume_id: latestResume?.id || null,
        updated_at: new Date().toISOString(),
      };

      // Only add these fields if creating a new profile
      if (!profileData) {
        updateData.onboarding_completed = false;
        updateData.user_status = "new";
        updateData.created_at = new Date().toISOString();
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .upsert(updateData, {
          onConflict: "id",
        })
        .select()
        .single();

      if (updateError) {
        console.error("[Sync] Profile update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update profile", details: updateError.message },
          { status: 500 }
        );
      }

      console.log(`[Sync] Successfully updated profile for user ${user_id}`);
      return NextResponse.json({
        success: true,
        profile: updatedProfile,
        synced: true,
        resume_count: resumesData?.length || 0,
        message: `Profile synced with ${resumesData?.length || 0} resume(s)`,
      });
    }

    // Profile is already in sync
    console.log(`[Sync] Profile already in sync for user ${user_id}`);
    return NextResponse.json({
      success: true,
      profile: profileData,
      synced: false,
      resume_count: resumesData?.length || 0,
      message: hasResume ? "Profile already in sync" : "No resumes found",
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync profile" },
      { status: 500 }
    );
  }
}

