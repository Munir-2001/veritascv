"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import OnboardingModal from "@/components/OnboardingModal";
import ResumePreview from "@/components/ResumePreview";

interface Resume {
  id: string;
  name?: string;
  file_path: string;
  raw_text: string;
  structured: any;
  parsed_at: string;
}

type TailorStep = "select-resume" | "upload-resume" | "job-description" | "tailoring" | "result";

export default function TailorResume() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [step, setStep] = useState<TailorStep>("select-resume");
  const [jobDescription, setJobDescription] = useState("");
  const [tailoredResume, setTailoredResume] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      
      // Fetch user's resumes using API
      if (session.user.id) {
        try {
          const response = await fetch(`/api/resumes/list?user_id=${session.user.id}`);
          if (response.ok) {
            const data = await response.json();
            setResumes(data.resumes || []);
            // If no resumes, go to upload step
            if (data.resumes.length === 0) {
              setStep("upload-resume");
            }
          }
        } catch (err) {
          console.error("Failed to fetch resumes:", err);
        }
      }

      setLoading(false);
    };

    checkSession();
  }, [router]);

  const handleResumeSelect = (resume: Resume) => {
    setSelectedResume(resume);
    setStep("job-description");
  };

  const handleResumeUploadComplete = async (resumeId?: string) => {
    setShowUploadModal(false);
    // Refresh resumes list using API
    if (user?.id) {
      try {
        const response = await fetch(`/api/resumes/list?user_id=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setResumes(data.resumes || []);
          if (resumeId) {
            const newResume = data.resumes?.find((r: Resume) => r.id === resumeId);
            if (newResume) {
              setSelectedResume(newResume);
              setStep("job-description");
            }
          }
        }
      } catch (err) {
        console.error("Failed to refresh resumes:", err);
      }
    }
  };

  const handleTailor = async () => {
    if (!selectedResume || !jobDescription.trim()) {
      setError("Please select a resume and enter a job description");
      return;
    }

    setStep("tailoring");
    setError(null);

    try {
      // Call API to tailor resume
      const response = await fetch("/api/resumes/tailor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume_id: selectedResume.id,
          resume_text: selectedResume.raw_text,
          structured_data: selectedResume.structured,
          job_description: jobDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to tailor resume");
      }

      const data = await response.json();
      setTailoredResume(data.tailored_resume);
      setStep("result");
    } catch (err: any) {
      console.error("Tailor error:", err);
      setError(err.message || "Failed to tailor resume");
      setStep("job-description");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
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

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2">AI Resume Tailoring</h2>
          <p className="text-steel-light">
            Tailor your resume to match any job description in seconds
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center gap-4">
          {["Select Resume", "Job Description", "Get Tailored Resume"].map((label, idx) => {
            const stepIndex = step === "select-resume" || step === "upload-resume" ? 0 :
                              step === "job-description" ? 1 :
                              step === "tailoring" || step === "result" ? 2 : 0;
            const isActive = idx === stepIndex;
            const isCompleted = idx < stepIndex;
            
            return (
              <div key={idx} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                    isCompleted ? "bg-accent text-background" :
                    isActive ? "bg-accent text-background" :
                    "bg-steel/20 text-steel-light"
                  }`}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span className={`text-sm ${isActive ? "text-foreground font-semibold" : "text-steel-light"}`}>
                    {label}
                  </span>
                </div>
                {idx < 2 && <div className={`w-full h-0.5 mx-2 ${isCompleted ? "bg-accent" : "bg-steel/20"}`} />}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Step 1: Select Resume */}
        {(step === "select-resume" || step === "upload-resume") && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            {step === "select-resume" ? (
              <>
                <h3 className="text-2xl font-bold mb-6">Select a Resume</h3>
                
                {resumes.length > 0 ? (
                  <div className="space-y-4 mb-6">
                    {resumes.map((resume) => (
                      <div
                        key={resume.id}
                        className="w-full p-4 bg-steel/10 rounded-xl border border-steel/20 hover:border-accent/50 hover:bg-steel/20 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">
                              {resume.name || `Resume from ${resume.parsed_at ? new Date(resume.parsed_at).toLocaleDateString() : 'Recently uploaded'}`}
                            </p>
                            <p className="text-sm text-steel-light mt-1">
                              {resume.parsed_at ? new Date(resume.parsed_at).toLocaleDateString() : 'Recently uploaded'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewResume(resume);
                              }}
                              className="p-2 hover:bg-steel/20 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <svg className="w-5 h-5 text-steel-light hover:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleResumeSelect(resume)}
                              className="p-2 hover:bg-steel/20 rounded-lg transition-colors"
                              title="Select"
                            >
                              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-steel-light">
                    <p className="mb-4">No resumes found</p>
                  </div>
                )}

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="w-full py-3 px-6 border-2 border-dashed border-accent/40 rounded-xl text-accent hover:border-accent/60 hover:bg-accent/5 transition-colors font-semibold"
                >
                  + Upload New Resume
                </button>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-6">Upload Resume</h3>
                <button
                  onClick={() => setStep("select-resume")}
                  className="mb-4 px-4 py-2 border border-steel/30 rounded-lg text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
                >
                  ← Back to Resume Selection
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Job Description */}
        {step === "job-description" && selectedResume && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Enter Job Description</h3>
            
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-steel-light mb-2">Selected Resume:</p>
                <p className="text-foreground font-medium">
                  {selectedResume.name || selectedResume.file_path.split("/").pop()} • {selectedResume.parsed_at ? new Date(selectedResume.parsed_at).toLocaleDateString() : 'Recently uploaded'}
                </p>
              </div>
              <button
                onClick={() => setPreviewResume(selectedResume)}
                className="px-4 py-2 bg-steel/10 hover:bg-steel/20 text-foreground rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                Paste the job description here
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the complete job description including requirements, responsibilities, and qualifications..."
                className="w-full h-64 p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50 resize-none"
              />
              <p className="text-xs text-steel-light mt-2">
                {jobDescription.length} characters
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("select-resume")}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleTailor}
                disabled={!jobDescription.trim()}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tailor Resume →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Tailoring in Progress */}
        {step === "tailoring" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-12 text-center">
            <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-2xl font-bold mb-2">Tailoring Your Resume...</h3>
            <p className="text-steel-light">
              Our AI is analyzing the job description and optimizing your resume
            </p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && tailoredResume && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Your Tailored Resume</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tailoredResume);
                  alert("Copied to clipboard!");
                }}
                className="px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm font-semibold"
              >
                Copy
              </button>
            </div>

            <div className="bg-background rounded-xl p-6 border border-steel/20 mb-6">
              <pre className="whitespace-pre-wrap text-foreground text-sm font-mono">
                {tailoredResume}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep("job-description");
                  setTailoredResume("");
                }}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Tailor Again
              </button>
              <button
                onClick={() => setStep("select-resume")}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                Select Different Resume
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && user?.id && (
        <OnboardingModal
          userId={user.id}
          onComplete={handleResumeUploadComplete}
        />
      )}

      {/* Preview Modal */}
      {previewResume && (
        <ResumePreview
          resume={previewResume}
          onClose={() => setPreviewResume(null)}
        />
      )}
    </div>
  );
}

