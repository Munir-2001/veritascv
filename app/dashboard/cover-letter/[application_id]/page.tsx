"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

interface JobApplication {
  id: string;
  job_title: string;
  job_description: string;
  company_name?: string;
  company_description?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  job_level?: string;
  domain?: string;
  cover_letter?: string;
  resumes?: {
    id: string;
    name?: string;
    raw_text?: string;
    structured?: any;
  };
}

export default function CoverLetterPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.application_id as string;
  
  const [user, setUser] = useState<any>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cover letter state
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  
  // Optional fields (if missing)
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [optionalRecruiterName, setOptionalRecruiterName] = useState("");
  const [optionalRecruiterEmail, setOptionalRecruiterEmail] = useState("");
  const [optionalCompanyName, setOptionalCompanyName] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      if (session.user.id && applicationId) {
        try {
          const response = await fetch(`/api/job-applications/get?application_id=${applicationId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch job application");
          }
          const data = await response.json();
          
          // Verify user owns this application
          if (data.application.user_id !== session.user.id) {
            router.push("/dashboard");
            return;
          }
          
          setApplication(data.application);
          
          // Check if optional fields are missing
          if (!data.application.recruiter_name && !data.application.recruiter_email && !data.application.company_name) {
            setShowOptionalFields(true);
          }
          
          // Load existing cover letter if available
          if (data.application.cover_letter) {
            setCoverLetter(data.application.cover_letter);
            setWordCount(data.application.cover_letter.split(/\s+/).length);
          }
        } catch (err: any) {
          console.error("Error fetching application:", err);
          setError(err.message || "Failed to load job application");
        } finally {
          setLoading(false);
        }
      }
    };

    checkSession();
  }, [router, applicationId]);

  // Update word count when cover letter changes
  useEffect(() => {
    const count = coverLetter.trim().split(/\s+/).filter(w => w.length > 0).length;
    setWordCount(count);
  }, [coverLetter]);

  const handleGenerate = async () => {
    if (!application || !application.resumes) {
      setError("Missing application or resume data");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Extract candidate name and email from resume
      const candidateName = extractNameFromResume(application.resumes.raw_text || "");
      const candidateEmail = extractEmailFromResume(application.resumes.raw_text || "");

      const response = await fetch("/api/cover-letter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: application.id,
          job_title: application.job_title,
          job_description: application.job_description,
          company_name: optionalCompanyName || application.company_name,
          company_description: application.company_description,
          recruiter_name: optionalRecruiterName || application.recruiter_name,
          recruiter_email: optionalRecruiterEmail || application.recruiter_email,
          job_level: application.job_level,
          domain: application.domain,
          resume_raw_text: application.resumes.raw_text,
          resume_structured_data: application.resumes.structured,
          candidate_name: candidateName,
          candidate_email: candidateEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate cover letter");
      }

      const data = await response.json();
      setCoverLetter(data.cover_letter);
      setWordCount(data.word_count);
    } catch (err: any) {
      console.error("Generate cover letter error:", err);
      setError(err.message || "Failed to generate cover letter");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!coverLetter.trim()) {
      setError("Cover letter cannot be empty");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/job-applications/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          cover_letter: coverLetter,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save cover letter");
      }

      // Update local state
      if (application) {
        setApplication({ ...application, cover_letter: coverLetter });
      }

      // Show success message
      alert("Cover letter saved successfully!");
      
      // Optionally redirect back to application detail or dashboard
      // router.push(`/dashboard/applications/${applicationId}`);
    } catch (err: any) {
      console.error("Save cover letter error:", err);
      setError(err.message || "Failed to save cover letter");
    } finally {
      setIsSaving(false);
    }
  };

  const extractNameFromResume = (text: string): string => {
    // Try to extract name from first few lines
    const lines = text.split("\n").slice(0, 5);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 2 && trimmed.length < 50 && !trimmed.includes("@")) {
        return trimmed;
      }
    }
    return "";
  };

  const extractEmailFromResume = (text: string): string => {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return emailMatch ? emailMatch[1] : "";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-300 mb-4">{error}</p>
          <Link href="/dashboard" className="text-accent hover:text-accent/80">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!application) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="w-full border-b border-steel/20 sticky top-0 bg-background/95 backdrop-blur-md z-50 shadow-sm">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-lg">V</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">
              VeritasCV
            </h1>
          </Link>
          <Link
            href={`/dashboard/applications/${applicationId}`}
            className="px-4 py-2 text-steel-light hover:text-accent transition-colors text-sm font-medium"
          >
            ← Back to Application
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Cover Letter</h1>
          <p className="text-xl text-steel-light">
            {application.job_title}
            {application.company_name && ` at ${application.company_name}`}
          </p>
        </div>

        {/* Optional Fields (if missing) */}
        {showOptionalFields && (
          <div className="mb-6 p-6 bg-steel/5 rounded-2xl border border-steel/20">
            <h3 className="text-lg font-semibold mb-4">Optional: Add Missing Information</h3>
            <p className="text-sm text-steel-light mb-4">
              Adding recruiter or company details will help personalize your cover letter. You can skip this if you prefer.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Company Name (optional)</label>
                <input
                  type="text"
                  value={optionalCompanyName}
                  onChange={(e) => setOptionalCompanyName(e.target.value)}
                  placeholder="e.g., Google, Microsoft"
                  className="w-full p-3 bg-background border border-steel/20 rounded-lg text-foreground focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Recruiter Name (optional)</label>
                <input
                  type="text"
                  value={optionalRecruiterName}
                  onChange={(e) => setOptionalRecruiterName(e.target.value)}
                  placeholder="e.g., John Smith"
                  className="w-full p-3 bg-background border border-steel/20 rounded-lg text-foreground focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Recruiter Email (optional)</label>
                <input
                  type="email"
                  value={optionalRecruiterEmail}
                  onChange={(e) => setOptionalRecruiterEmail(e.target.value)}
                  placeholder="e.g., recruiter@company.com"
                  className="w-full p-3 bg-background border border-steel/20 rounded-lg text-foreground focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Cover Letter Editor */}
        <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your Cover Letter</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-steel-light">
                {wordCount} words {wordCount < 250 ? "(too short)" : wordCount > 400 ? "(too long)" : "(good)"}
              </span>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? "Generating..." : coverLetter ? "Regenerate" : "Generate"}
              </button>
            </div>
          </div>

          {isGenerating ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-steel-light">Generating personalized cover letter...</span>
            </div>
          ) : (
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder={coverLetter ? "" : "Click 'Generate' to create a personalized cover letter..."}
              className="w-full h-96 p-4 bg-background border border-steel/20 rounded-lg text-foreground focus:outline-none focus:border-accent/50 resize-none font-serif text-sm leading-relaxed"
              style={{ fontFamily: "Georgia, serif" }}
            />
          )}
        </div>

        {/* Preview Section */}
        {coverLetter && !isGenerating && (
          <div className="bg-background rounded-2xl border border-steel/20 p-8 mb-6">
            <h3 className="text-lg font-semibold mb-6">Preview</h3>
            <div className="prose prose-invert max-w-none">
              <div className="text-foreground leading-relaxed font-serif text-sm space-y-4">
                {coverLetter.split(/\n\s*\n/).map((paragraph, idx) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return null;
                  return (
                    <p key={idx} className="mb-4 text-justify">
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href={`/dashboard/applications/${applicationId}`}
            className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={!coverLetter.trim() || isSaving || isGenerating}
            className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Cover Letter"}
          </button>
        </div>
      </main>
    </div>
  );
}


