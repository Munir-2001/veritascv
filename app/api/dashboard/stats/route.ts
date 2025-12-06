import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: GET /api/dashboard/stats
 * 
 * Returns dashboard statistics for a user
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

    // Count job applications (tailored resumes created)
    const { count: resumesCount, error: resumesError } = await supabase
      .from("job_applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id);

    if (resumesError) {
      console.error("Error counting resumes:", resumesError);
    }

    // Count uploaded resumes
    const { count: uploadedResumesCount, error: uploadedError } = await supabase
      .from("resumes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id);

    if (uploadedError) {
      console.error("Error counting uploaded resumes:", uploadedError);
    }

    // For now, CV Audits and Cover Letters are 0 (not implemented yet)
    // These can be added when those features are implemented

    return NextResponse.json({
      success: true,
      stats: {
        resumesCreated: resumesCount || 0, // Tailored CVs created (job applications)
        uploadedResumes: uploadedResumesCount || 0, // Original resumes uploaded
        cvAudits: 0, // TODO: Implement when CV audit feature is ready
        coverLetters: 0, // TODO: Implement when cover letter feature is ready
      },
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}


