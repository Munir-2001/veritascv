"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

interface JobApplication {
  id: string;
  job_title: string;
  job_description: string;
  job_level?: string;
  domain?: string;
  company_name?: string;
  company_description?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  additional_notes?: string;
  status: string;
  created_at: string;
  applied_at?: string;
  tailored_resume_text?: string;
  tailored_sections?: any;
  template?: string;
  cv_name?: string;
  resumes?: {
    id: string;
    name?: string;
    raw_text?: string;
    structured?: any;
  };
}

export default function JobApplicationDetail() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  
  const [user, setUser] = useState<any>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

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

  const handleRegenerateCV = async () => {
    if (!application || !application.resumes) {
      setError("Missing application or resume data");
      return;
    }

    setRegenerating(true);
    setError(null);

    try {
      const cvResponse = await fetch("/api/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: application.resumes.id,
          tailored_sections: application.tailored_sections, // Use stored structured data
          tailored_text: application.tailored_resume_text, // Fallback
          structured_data: application.tailored_sections || application.resumes.structured,
          raw_text: application.resumes.raw_text,
          template: application.template || "modern",
          job_title: application.job_title,
          job_level: application.job_level || "mid",
          domain: application.domain || "general",
          job_description: application.job_description,
          cv_name: application.cv_name,
        }),
      });

      if (!cvResponse.ok) {
        throw new Error("Failed to regenerate CV");
      }

      const cvData = await cvResponse.json();

      // Download the regenerated CV
      const downloadUrl = cvData.pdf_url || cvData.docx_url;
      if (downloadUrl) {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${application.job_title || "resume"}-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error("Regenerate CV error:", err);
      setError(err.message || "Failed to regenerate CV");
    } finally {
      setRegenerating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!application) return;

    try {
      const response = await fetch("/api/job-applications/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: application.id,
          status: newStatus,
          applied_at: newStatus === "applied" ? new Date().toISOString() : application.applied_at,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setApplication({ ...application, ...data.application });
      }
    } catch (err: any) {
      console.error("Update status error:", err);
      setError(err.message || "Failed to update status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "applied":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "interview":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "accepted":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "rejected":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-steel/20 text-steel-light border-steel/30";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
            href="/dashboard"
            className="px-4 py-2 text-steel-light hover:text-accent transition-colors text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Application Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{application.job_title}</h1>
              {application.company_name && (
                <p className="text-2xl text-steel-light">{application.company_name}</p>
              )}
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(application.status)}`}
            >
              {application.status || "Draft"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-steel-light mb-6">
            {application.job_level && (
              <span className="capitalize">Level: {application.job_level}</span>
            )}
            {application.domain && (
              <span className="capitalize">Domain: {application.domain}</span>
            )}
            <span>Created: {formatDate(application.created_at)}</span>
            {application.applied_at && (
              <span>Applied: {formatDate(application.applied_at)}</span>
            )}
          </div>

          {/* Status Update */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => handleUpdateStatus("draft")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                application.status === "draft"
                  ? "bg-accent text-background"
                  : "bg-steel/10 text-steel-light hover:bg-steel/20"
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => handleUpdateStatus("applied")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                application.status === "applied"
                  ? "bg-blue-500 text-white"
                  : "bg-steel/10 text-steel-light hover:bg-steel/20"
              }`}
            >
              Applied
            </button>
            <button
              onClick={() => handleUpdateStatus("interview")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                application.status === "interview"
                  ? "bg-purple-500 text-white"
                  : "bg-steel/10 text-steel-light hover:bg-steel/20"
              }`}
            >
              Interview
            </button>
            <button
              onClick={() => handleUpdateStatus("accepted")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                application.status === "accepted"
                  ? "bg-green-500 text-white"
                  : "bg-steel/10 text-steel-light hover:bg-steel/20"
              }`}
            >
              Accepted
            </button>
            <button
              onClick={() => handleUpdateStatus("rejected")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                application.status === "rejected"
                  ? "bg-red-500 text-white"
                  : "bg-steel/10 text-steel-light hover:bg-steel/20"
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6">
              <h2 className="text-xl font-bold mb-4">Job Description</h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-steel-light whitespace-pre-wrap">{application.job_description}</p>
              </div>
            </div>

            {/* Company Description */}
            {application.company_description && (
              <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6">
                <h2 className="text-xl font-bold mb-4">Company Description</h2>
                <p className="text-steel-light whitespace-pre-wrap">{application.company_description}</p>
              </div>
            )}

            {/* Additional Notes */}
            {application.additional_notes && (
              <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6">
                <h2 className="text-xl font-bold mb-4">Additional Notes</h2>
                <p className="text-steel-light whitespace-pre-wrap">{application.additional_notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recruiter Info */}
            {(application.recruiter_name || application.recruiter_email) && (
              <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6">
                <h2 className="text-xl font-bold mb-4">Recruiter Information</h2>
                {application.recruiter_name && (
                  <p className="text-foreground font-semibold mb-2">{application.recruiter_name}</p>
                )}
                {application.recruiter_email && (
                  <a
                    href={`mailto:${application.recruiter_email}`}
                    className="text-accent hover:text-accent/80 transition-colors break-all"
                  >
                    {application.recruiter_email}
                  </a>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6">
              <h2 className="text-xl font-bold mb-4">Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={handleRegenerateCV}
                  disabled={regenerating || !application.tailored_sections}
                  className="w-full px-4 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating ? "Regenerating..." : "Regenerate CV"}
                </button>
                {!application.tailored_sections && (
                  <p className="text-xs text-steel-light">
                    CV regeneration not available (structured data not saved)
                  </p>
                )}
              </div>
            </div>

            {/* Resume Used */}
            {application.resumes && (
              <div className="bg-steel/5 rounded-2xl border border-steel/20 p-6">
                <h2 className="text-xl font-bold mb-4">Resume Used</h2>
                <p className="text-steel-light">{application.resumes.name || "Resume"}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


