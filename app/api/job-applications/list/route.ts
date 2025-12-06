import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: GET /api/job-applications/list
 * 
 * Fetches all job applications for a user
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

    const { data: applications, error } = await supabase
      .from("job_applications")
      .select(`
        *,
        resumes (
          id,
          name,
          file_path
        )
      `)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Job applications list error:", error);
      return NextResponse.json(
        { error: "Failed to fetch job applications", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      applications: applications || [],
      count: applications?.length || 0,
    });
  } catch (error: any) {
    console.error("List job applications error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch job applications" },
      { status: 500 }
    );
  }
}


