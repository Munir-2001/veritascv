import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: POST /api/profiles/create
 * 
 * Creates a new profile for a user.
 * Requires user_id and profile data in request body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, ...profileData } = body;

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

    const dataToInsert = {
      id: user_id,
      onboarding_completed: false,
      has_uploaded_resume: false,
      user_status: "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...profileData,
    };

    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error("Profile creation error:", error);
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: newProfile,
    });
  } catch (error: any) {
    console.error("Create profile error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create profile" },
      { status: 500 }
    );
  }
}

