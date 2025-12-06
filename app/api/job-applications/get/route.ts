import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: GET /api/job-applications/get
 * 
 * Fetches a single job application by ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const application_id = searchParams.get("application_id");

    if (!application_id) {
      return NextResponse.json(
        { error: "Missing application_id parameter" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: application, error } = await supabase
      .from("job_applications")
      .select(`
        *,
        resumes (
          id,
          name,
          file_path,
          raw_text,
          structured
        )
      `)
      .eq("id", application_id)
      .single();

    if (error) {
      console.error("Job application get error:", error);
      return NextResponse.json(
        { error: "Failed to fetch job application", details: error.message },
        { status: 500 }
      );
    }

    if (!application) {
      return NextResponse.json(
        { error: "Job application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      application,
    });
  } catch (error: any) {
    console.error("Get job application error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch job application" },
      { status: 500 }
    );
  }
}


