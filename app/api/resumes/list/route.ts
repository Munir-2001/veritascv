import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: GET /api/resumes/list
 * 
 * Fetches all resumes for the authenticated user.
 * Requires user_id as query parameter.
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

    const { data: resumes, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user_id)
      .order("parsed_at", { ascending: false });

    if (error) {
      console.error("Resumes fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch resumes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resumes: resumes || [],
      count: resumes?.length || 0,
    });
  } catch (error: any) {
    console.error("List resumes error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list resumes" },
      { status: 500 }
    );
  }
}

