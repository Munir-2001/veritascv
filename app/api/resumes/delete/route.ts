import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Route: DELETE /api/resumes/delete
 * 
 * Deletes a resume for the authenticated user.
 * Requires resume_id and user_id in the request body.
 * Also deletes the file from storage if it exists.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { resume_id, user_id } = body;

    if (!resume_id || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields: resume_id and user_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First, verify the resume belongs to the user
    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("id, user_id, file_path")
      .eq("id", resume_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !resume) {
      console.error("Resume fetch error:", fetchError);
      return NextResponse.json(
        { error: "Resume not found or access denied" },
        { status: 404 }
      );
    }

    // Delete the file from storage if it exists
    if (resume.file_path) {
      try {
        // Extract storage path (remove "resumes/" prefix if present)
        const storagePath = resume.file_path.startsWith("resumes/")
          ? resume.file_path.substring(8) // Remove "resumes/" prefix
          : resume.file_path;

        const { error: storageError } = await supabase.storage
          .from("resumes")
          .remove([storagePath]);

        if (storageError) {
          console.warn("Storage deletion error (non-critical):", storageError);
          // Continue with database deletion even if storage deletion fails
        } else {
          console.log(`[Delete] Successfully deleted file from storage: ${storagePath}`);
        }
      } catch (storageErr) {
        console.warn("Storage deletion exception (non-critical):", storageErr);
        // Continue with database deletion
      }
    }

    // Delete the resume from database
    const { error: deleteError } = await supabase
      .from("resumes")
      .delete()
      .eq("id", resume_id)
      .eq("user_id", user_id); // Extra safety check

    if (deleteError) {
      console.error("Resume deletion error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete resume", details: deleteError.message },
        { status: 500 }
      );
    }

    // Check if this was the user's primary resume (in profiles table)
    const { data: profile } = await supabase
      .from("profiles")
      .select("resume_id, has_uploaded_resume")
      .eq("id", user_id)
      .single();

    // If this was the primary resume, update the profile
    if (profile && profile.resume_id === resume_id) {
      // Check if user has other resumes
      const { data: otherResumes } = await supabase
        .from("resumes")
        .select("id")
        .eq("user_id", user_id)
        .limit(1);

      const hasOtherResumes = otherResumes && otherResumes.length > 0;
      const newResumeId = hasOtherResumes ? otherResumes[0].id : null;

      await supabase
        .from("profiles")
        .update({
          resume_id: newResumeId,
          has_uploaded_resume: hasOtherResumes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user_id);
    }

    console.log(`[Delete] Successfully deleted resume ${resume_id} for user ${user_id}`);

    return NextResponse.json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete resume error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete resume" },
      { status: 500 }
    );
  }
}

