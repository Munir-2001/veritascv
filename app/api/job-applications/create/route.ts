import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: POST /api/job-applications/create
 * 
 * Creates a new job application record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      resume_id,
      job_title,
      job_description,
      job_level,
      domain,
      company_name,
      company_description,
      recruiter_name,
      recruiter_email,
      additional_notes,
      tailored_resume_text,
      tailored_sections, // Structured JSON data for CV regeneration
      template, // CV template used
      cv_name, // Custom name on CV
    } = body;

    if (!user_id || !resume_id || !job_title || !job_description || !tailored_resume_text) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: application, error } = await supabase
      .from("job_applications")
      .insert({
        user_id,
        resume_id,
        job_title,
        job_description,
        job_level: job_level || null,
        domain: domain || null,
        company_name: company_name || null,
        company_description: company_description || null,
        recruiter_name: recruiter_name || null,
        recruiter_email: recruiter_email || null,
        additional_notes: additional_notes || null,
        tailored_resume_text,
        tailored_sections: tailored_sections || null, // Store structured data for CV regeneration
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("Job application create error:", error);
      return NextResponse.json(
        { error: "Failed to create job application", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      application_id: application.id,
      application,
    });
  } catch (error: any) {
    console.error("Create job application error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create job application" },
      { status: 500 }
    );
  }
}


