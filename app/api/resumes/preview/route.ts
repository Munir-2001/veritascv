import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: GET /api/resumes/preview
 * 
 * Gets the public URL for a resume file from Supabase Storage.
 * Requires resume_id as query parameter.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const resume_id = searchParams.get("resume_id");

    if (!resume_id) {
      return NextResponse.json(
        { error: "Missing resume_id parameter" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get resume record to find file_path
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("file_path, user_id")
      .eq("id", resume_id)
      .single();

    if (resumeError || !resume) {
      console.error("Resume fetch error:", resumeError);
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    // Extract storage path (remove "resumes/" prefix if present)
    let storagePath = resume.file_path;
    if (storagePath.startsWith("resumes/")) {
      storagePath = storagePath.substring(8); // Remove "resumes/" prefix
    }

    // Get public URL from storage
    const { data: urlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: "Failed to generate preview URL" },
        { status: 500 }
      );
    }

    // Get signed URL for better security (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("resumes")
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    return NextResponse.json({
      public_url: urlData.publicUrl,
      signed_url: signedUrlData?.signedUrl || urlData.publicUrl,
      file_path: resume.file_path,
      storage_path: storagePath,
    });
  } catch (error: any) {
    console.error("Preview URL error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get preview URL" },
      { status: 500 }
    );
  }
}


