import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: GET /api/resumes/check
 * 
 * Debug endpoint to check all resumes for a user.
 * Returns detailed information about resumes found.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id parameter" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get ALL resumes for this user
    const { data: resumes, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user_id)
      .order("parsed_at", { ascending: false });

    if (error) {
      console.error("Resumes check error:", error);
      return NextResponse.json(
        { 
          error: "Failed to check resumes",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    // Get profile to compare
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    return NextResponse.json({
      success: true,
      user_id,
      resume_count: resumes?.length || 0,
      resumes: resumes || [],
      profile: profile || null,
      profile_has_resume: profile?.has_uploaded_resume || false,
      profile_resume_id: profile?.resume_id || null,
      needs_sync: (resumes && resumes.length > 0) && (!profile || !profile.has_uploaded_resume),
    });
  } catch (error: any) {
    console.error("Check resumes error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check resumes" },
      { status: 500 }
    );
  }
}

