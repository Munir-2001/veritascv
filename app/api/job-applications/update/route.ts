import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: PATCH /api/job-applications/update
 * 
 * Updates a job application (e.g., status, applied_at)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { application_id, status, applied_at } = body;

    if (!application_id) {
      return NextResponse.json(
        { error: "Missing application_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updateData: any = {};
    if (status) updateData.status = status;
    if (applied_at !== undefined) updateData.applied_at = applied_at;
    if (body.cover_letter !== undefined) updateData.cover_letter = body.cover_letter;

    const { data: application, error } = await supabase
      .from("job_applications")
      .update(updateData)
      .eq("id", application_id)
      .select()
      .single();

    if (error) {
      console.error("Job application update error:", error);
      return NextResponse.json(
        { error: "Failed to update job application", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      application,
    });
  } catch (error: any) {
    console.error("Update job application error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update job application" },
      { status: 500 }
    );
  }
}

